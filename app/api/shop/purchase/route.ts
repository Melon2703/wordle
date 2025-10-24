import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../lib/db/queries';
import { env } from '../../../../lib/env';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    console.log('🛒 Payment Debug - Starting purchase request');
    
    const auth = requireAuthContext(request);
    console.log('🛒 Payment Debug - Auth successful for user:', auth.userId);
    
    const client = getServiceClient();
    const { BOT_TOKEN } = env();
    
    // Parse request body
    const body = await request.json();
    const { productId } = body;
    
    console.log('🛒 Payment Debug - Request body:', body);
    
    if (!productId) {
      console.log('❌ Payment Debug - Missing productId');
      return NextResponse.json(
        { error: 'Missing productId' },
        { status: 400 }
      );
    }
    
    console.log('🛒 Payment Debug - Product ID:', productId);
    
    // Get or create user profile
    console.log('🛒 Payment Debug - Getting/creating profile for user:', auth.userId);
    const profile = await getOrCreateProfile(client, parseInt(auth.userId), auth.parsed.user?.username);
    console.log('🛒 Payment Debug - Profile:', {
      profile_id: profile.profile_id,
      username: profile.username,
      telegram_id: profile.telegram_id
    });
    
    // Get product details
    console.log('🛒 Payment Debug - Fetching product details for:', productId);
    const { data: product, error: productError } = await client
      .from('products')
      .select('*')
      .eq('product_id', productId)
      .eq('active', true)
      .single();
    
    if (productError || !product) {
      console.log('❌ Payment Debug - Product not found:', productError);
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    console.log('🛒 Payment Debug - Product found:', {
      product_id: product.product_id,
      title: product.title_ru,
      price_stars: product.price_stars,
      type: product.type
    });
    
    // Create purchase record FIRST to get real purchase_id
    const purchaseData = {
      profile_id: profile.profile_id,
      product_id: productId,
      status: 'pending' as const,
      stars_amount: product.price_stars,
      provider_payload: {
        user_id: auth.userId,
        username: auth.parsed.user?.username,
        product_details: {
          title: product.title_ru,
          type: product.type,
          price_stars: product.price_stars
        },
        timestamp: new Date().toISOString(),
        request_headers: Object.fromEntries(request.headers.entries())
      }
    };
    
    console.log('🛒 Payment Debug - Creating purchase record:', purchaseData);
    
    const { data: purchase, error: purchaseError } = await client
      .from('purchases')
      .insert(purchaseData)
      .select()
      .single();

    if (purchaseError || !purchase) {
      console.log('❌ Payment Debug - Failed to create purchase:', purchaseError);
      console.log('❌ Payment Debug - Purchase data that failed:', purchaseData);
      console.log('❌ Payment Debug - Error details:', {
        code: purchaseError?.code,
        message: purchaseError?.message,
        details: purchaseError?.details,
        hint: purchaseError?.hint
      });
      return NextResponse.json(
        { error: 'Failed to create purchase', details: purchaseError?.message },
        { status: 500 }
      );
    }
    
    console.log('✅ Payment Debug - Purchase record created:', {
      purchase_id: purchase.purchase_id,
      status: purchase.status,
      stars_amount: purchase.stars_amount
    });
    
    // Create real Telegram invoice using Bot API with real purchase_id
    console.log('🛒 Payment Debug - Creating real Telegram invoice via Bot API');
    
    const invoiceResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: product.title_ru,
        description: `Покупка: ${product.title_ru}`,
        payload: JSON.stringify({
          purchase_id: purchase.purchase_id, // Use real UUID from DB
          product_id: productId,
          user_id: auth.userId
        }),
        provider_token: '', // Empty string for Telegram Stars (digital goods)
        currency: 'XTR', // Telegram Stars currency
        prices: [
          {
            label: product.title_ru,
            amount: product.price_stars // Raw Stars amount (not cents)
          }
        ]
      })
    });
    
    if (!invoiceResponse.ok) {
      const errorText = await invoiceResponse.text();
      console.log('❌ Payment Debug - Failed to create Telegram invoice:', errorText);
      throw new Error(`Failed to create Telegram invoice: ${errorText}`);
    }
    
    const invoiceData = await invoiceResponse.json();
    const invoiceUrl = invoiceData.result;
    console.log('✅ Payment Debug - Real Telegram invoice created:', invoiceUrl);
    
    // Update purchase record with invoice URL
    const { error: updateError } = await client
      .from('purchases')
      .update({
        provider_payload: {
          ...purchase.provider_payload,
          invoice_url: invoiceUrl
        }
      })
      .eq('purchase_id', purchase.purchase_id);
    
    if (updateError) {
      console.log('❌ Payment Debug - Failed to update purchase with invoice URL:', updateError);
      // Don't fail the request - invoice was created successfully
    }
    
    console.log('✅ Payment Debug - Purchase record updated with invoice URL');
    
    // Return the purchase details for frontend to handle Telegram invoice
    return NextResponse.json({
      ok: true,
      purchase_id: purchase.purchase_id,
      invoice_url: invoiceUrl,
      stars_amount: product.price_stars
    });
    
  } catch (error) {
    console.error('❌ Payment Debug - Purchase POST error:', error);
    console.error('❌ Payment Debug - Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('❌ Payment Debug - Error message:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to process purchase', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
