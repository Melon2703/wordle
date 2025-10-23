import { NextResponse } from 'next/server';
import { env } from '../../../../../lib/env';

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

    // Log webhook for debugging
    console.log('Telegram webhook received:', {
      updateId: body.update_id,
      type: Object.keys(body).filter(key => key !== 'update_id')[0],
      timestamp: new Date().toISOString()
    });

    // Handle successful payment (stub for v0)
    if (body.successful_payment) {
      console.log('Payment webhook:', body.successful_payment);
      // TODO: In post-v0, process payment and grant entitlements
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
