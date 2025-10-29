import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../../lib/db/client';
import { getOrCreateProfile, refundPurchase } from '../../../../../lib/db/queries';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: { purchaseId: string } }
): Promise<Response> {
  try {
    const auth = requireAuthContext(request);
    const { purchaseId } = context.params;
    const client = getServiceClient();
    
    // Get or create user profile
    const profile = await getOrCreateProfile(
      client, 
      parseInt(auth.userId), 
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );
    
    // Process refund
    const refundedPurchase = await refundPurchase(client, purchaseId);
    
    return NextResponse.json({ 
      ok: true,
      purchase_id: refundedPurchase.purchase_id,
      status: refundedPurchase.status,
      refunded_at: refundedPurchase.refunded_at
    });
    
  } catch (error) {
    console.error('Refund error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process refund' },
      { status: 500 }
    );
  }
}
