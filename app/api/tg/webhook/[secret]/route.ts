import { NextResponse } from 'next/server';
import { env } from '../../../../../lib/env';
import { getServiceClient } from '../../../../../lib/db/client';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: { secret: string } }
): Promise<Response> {
  try {
    console.log('🔔 Webhook Debug - Starting webhook processing');
    
    const { secret } = context.params;
    const { WEBHOOK_SECRET_PATH } = env();

    console.log('🔔 Webhook Debug - Secret validation:', {
      provided_secret: secret,
      expected_secret: WEBHOOK_SECRET_PATH ? 'configured' : 'not_configured'
    });

    // Validate secret path
    if (!WEBHOOK_SECRET_PATH) {
      console.log('❌ Webhook Debug - Webhook secret not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    if (secret !== WEBHOOK_SECRET_PATH) {
      console.log('❌ Webhook Debug - Invalid webhook secret');
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }

    console.log('✅ Webhook Debug - Secret validation passed');

    // Parse webhook payload
    const body = await request.json();
    
    console.log('🔔 Webhook Debug - Raw webhook payload:', JSON.stringify(body, null, 2));

    // Log webhook for debugging
    console.log('🔔 Webhook Debug - Webhook summary:', {
      updateId: body.update_id,
      type: Object.keys(body).filter(key => key !== 'update_id')[0],
      timestamp: new Date().toISOString(),
      payload_size: JSON.stringify(body).length
    });

    // Handle successful payment
    if (body.message?.successful_payment) {
      console.log('💰 Payment Webhook Debug - Processing successful payment');
      console.log('💰 Payment Webhook Debug - Payment details:', {
        currency: body.message.successful_payment.currency,
        total_amount: body.message.successful_payment.total_amount,
        invoice_payload: body.message.successful_payment.invoice_payload,
        telegram_payment_charge_id: body.message.successful_payment.telegram_payment_charge_id,
        provider_payment_charge_id: body.message.successful_payment.provider_payment_charge_id
      });
      
      try {
        // Parse invoice payload to find the purchase
        const payload = JSON.parse(body.message.successful_payment.invoice_payload);
        console.log('💰 Payment Webhook Debug - Parsed payload:', payload);
        
        const client = getServiceClient();
        
        // Find the pending purchase record by purchase_id
        const { data: purchase, error: purchaseError } = await client
          .from('purchases')
          .select('*')
          .eq('purchase_id', payload.purchase_id)
          .eq('status', 'pending')
          .single();
        
        if (purchaseError || !purchase) {
          console.log('❌ Payment Webhook Debug - Purchase not found:', purchaseError);
          return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
        }
        
        console.log('✅ Payment Webhook Debug - Found purchase:', purchase.purchase_id);
        
        // Update purchase status to paid
        const { error: updateError } = await client
          .from('purchases')
          .update({
            status: 'paid',
            telegram_payment_charge_id: body.message.successful_payment.telegram_payment_charge_id,
            provider_payment_charge_id: body.message.successful_payment.provider_payment_charge_id,
            provider_payload: {
              ...purchase.provider_payload,
              successful_payment: {
                currency: body.message.successful_payment.currency,
                total_amount: body.message.successful_payment.total_amount,
                telegram_payment_charge_id: body.message.successful_payment.telegram_payment_charge_id,
                provider_payment_charge_id: body.message.successful_payment.provider_payment_charge_id,
                payment_timestamp: new Date().toISOString()
              }
            }
          })
          .eq('purchase_id', purchase.purchase_id);
        
        if (updateError) {
          console.log('❌ Payment Webhook Debug - Failed to update purchase:', updateError);
          return NextResponse.json({ error: 'Failed to update purchase' }, { status: 500 });
        }
        
        // Grant entitlement idempotently
        const { error: entitlementError } = await client
          .from('entitlements')
          .upsert({
            profile_id: purchase.profile_id,
            product_id: purchase.product_id,
            is_equipped: false,
            granted_at: new Date().toISOString()
          }, {
            onConflict: 'profile_id,product_id'
          });
        
        if (entitlementError) {
          console.log('❌ Payment Webhook Debug - Failed to grant entitlement:', entitlementError);
          // Don't fail the webhook - payment was successful, entitlement can be granted later
        } else {
          console.log('✅ Payment Webhook Debug - Entitlement granted successfully');
        }
        
        console.log('✅ Payment Webhook Debug - Payment processed successfully');
        
      } catch (error) {
        console.error('❌ Payment Webhook Debug - Error processing payment:', error);
        return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
      }
    }

    // Handle pre-checkout query
    if (body.pre_checkout_query) {
      console.log('🔍 Pre-checkout Debug - Processing pre-checkout query');
      console.log('🔍 Pre-checkout Debug - Query details:', {
        id: body.pre_checkout_query.id,
        from: body.pre_checkout_query.from,
        currency: body.pre_checkout_query.currency,
        total_amount: body.pre_checkout_query.total_amount,
        invoice_payload: body.pre_checkout_query.invoice_payload
      });
      
      try {
        // Parse invoice payload to validate purchase
        const payload = JSON.parse(body.pre_checkout_query.invoice_payload);
        console.log('🔍 Pre-checkout Debug - Parsed payload:', payload);
        
        // Validate the purchase request
        const { BOT_TOKEN } = env();
        
        // For now, approve all valid Stars payments
        // In production, you might want to validate product availability, user eligibility, etc.
        const answerResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pre_checkout_query_id: body.pre_checkout_query.id,
            ok: true
          })
        });
        
        if (!answerResponse.ok) {
          const errorText = await answerResponse.text();
          console.log('❌ Pre-checkout Debug - Failed to answer query:', errorText);
        } else {
          console.log('✅ Pre-checkout Debug - Query answered successfully');
        }
        
      } catch (error) {
        console.error('❌ Pre-checkout Debug - Error processing query:', error);
        
        // Answer with error if validation fails
        try {
          const { BOT_TOKEN } = env();
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pre_checkout_query_id: body.pre_checkout_query.id,
              ok: false,
              error_message: 'Ошибка валидации покупки'
            })
          });
        } catch (answerError) {
          console.error('❌ Pre-checkout Debug - Failed to answer with error:', answerError);
        }
      }
    }

    console.log('✅ Webhook Debug - Webhook processing completed successfully');

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('❌ Webhook Debug - Webhook POST error:', error);
    console.error('❌ Webhook Debug - Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
