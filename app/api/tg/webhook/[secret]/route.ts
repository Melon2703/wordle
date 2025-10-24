import { NextResponse } from 'next/server';
import { env } from '../../../../../lib/env';
import { getServiceClient } from '../../../../../lib/db/client';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: { secret: string } }
): Promise<Response> {
  try {
    const { secret } = context.params;
    const { WEBHOOK_SECRET_PATH } = env();

    // Validate secret path
    if (!WEBHOOK_SECRET_PATH) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    if (secret !== WEBHOOK_SECRET_PATH) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const body = await request.json();

    // Handle successful payment
    if (body.message?.successful_payment) {
      try {
        // Parse invoice payload to find the purchase
        const payload = JSON.parse(body.message.successful_payment.invoice_payload);
        
        const client = getServiceClient();
        
        // Find the pending purchase record by purchase_id
        const { data: purchase, error: purchaseError } = await client
          .from('purchases')
          .select('*')
          .eq('purchase_id', payload.purchase_id)
          .eq('status', 'pending')
          .single();
        
        if (purchaseError || !purchase) {
          return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
        }
        
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
          // Don't fail the webhook - payment was successful, entitlement can be granted later
        }
        
      } catch (error) {
        console.error('Error processing payment:', error);
        return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
      }
    }

    // Handle pre-checkout query
    if (body.pre_checkout_query) {
      try {
        // Parse invoice payload to validate purchase
        JSON.parse(body.pre_checkout_query.invoice_payload);
        
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
          // Log error but don't expose details
        }
        
      } catch (error) {
        console.error('Error processing query:', error);
        
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
          console.error('Failed to answer with error:', answerError);
        }
      }
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Webhook POST error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
