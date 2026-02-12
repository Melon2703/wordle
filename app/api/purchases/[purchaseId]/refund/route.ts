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
    console.log('💸 Refund Debug - Starting refund request');
    
    const auth = requireAuthContext(request);
    console.log('💸 Refund Debug - Auth successful for user:', auth.userId);
    
    const { purchaseId } = context.params;
    console.log('💸 Refund Debug - Purchase ID:', purchaseId);
    
    const client = getServiceClient();
    
    // Get or create user profile
    const profile = await getOrCreateProfile(
      client, 
      parseInt(auth.userId), 
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );
    console.log('💸 Refund Debug - Profile:', {
      profile_id: profile.profile_id,
      username: profile.username
    });
    
    // Process refund
    const refundedPurchase = await refundPurchase(client, purchaseId);
    console.log('💸 Refund Debug - Refund completed:', {
      purchase_id: refundedPurchase.purchase_id,
      status: refundedPurchase.status
    });
    
    return NextResponse.json({ 
      ok: true,
      purchase_id: refundedPurchase.purchase_id,
      status: refundedPurchase.status,
      refunded_at: refundedPurchase.refunded_at
    });
    
  } catch (error) {
    console.error('❌ Refund Debug - POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process refund' },
      { status: 500 }
    );
  }
}
