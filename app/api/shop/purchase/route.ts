import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../lib/db/queries';
import { env } from '../../../../lib/env';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    const { BOT_TOKEN } = env();
    
    // Parse request body
    const body = await request.json();
    const { productId } = body;
    
    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId' },
        { status: 400 }
      );
    }
    
    // Get or create user profile
    const profile = await getOrCreateProfile(
      client, 
      parseInt(auth.userId), 
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );
    
    // Get product details
    const { data: product, error: productError } = await client
      .from('products')
      .select('*')
      .eq('product_id', productId)
      .eq('active', true)
      .single();
    
    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
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
        timestamp: new Date().toISOString()
      }
    };
    
    const { data: purchase, error: purchaseError } = await client
      .from('purchases')
      .insert(purchaseData)
      .select()
      .single();

    if (purchaseError || !purchase) {
      return NextResponse.json(
        { error: 'Failed to create purchase' },
        { status: 500 }
      );
    }
    
    // Create real Telegram invoice using Bot API with real purchase_id
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
      throw new Error(`Failed to create Telegram invoice: ${errorText}`);
    }
    
    const invoiceData = await invoiceResponse.json();
    const invoiceUrl = invoiceData.result;
    
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
      // Don't fail the request - invoice was created successfully
    }
    
    // Return the purchase details for frontend to handle Telegram invoice
    return NextResponse.json({
      ok: true,
      purchase_id: purchase.purchase_id,
      invoice_url: invoiceUrl,
      stars_amount: product.price_stars
    });
    
  } catch (error) {
    console.error('Purchase POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process purchase' },
      { status: 500 }
    );
  }
}
