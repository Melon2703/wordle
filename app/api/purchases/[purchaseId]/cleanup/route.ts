import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../../lib/db/client';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  context: { params: { purchaseId: string } }
): Promise<Response> {
  try {
    console.log('🧹 Cleanup Debug - Starting cleanup for cancelled purchase');
    
    const auth = requireAuthContext(request);
    const { purchaseId } = context.params;
    
    console.log('🧹 Cleanup Debug - Purchase ID:', purchaseId);
    console.log('🧹 Cleanup Debug - User ID:', auth.userId);
    
    const client = getServiceClient();
    
    // Only allow cleanup of pending purchases owned by the user
    const { data: purchase, error: fetchError } = await client
      .from('purchases')
      .select('*, profiles!inner(telegram_id)')
      .eq('purchase_id', purchaseId)
      .eq('status', 'pending')
      .eq('profiles.telegram_id', parseInt(auth.userId))
      .single();
    
    if (fetchError || !purchase) {
      console.log('❌ Cleanup Debug - Purchase not found or not pending:', fetchError);
      return NextResponse.json({ error: 'Purchase not found or not cancellable' }, { status: 404 });
    }
    
    console.log('✅ Cleanup Debug - Found pending purchase:', {
      purchase_id: purchase.purchase_id,
      product_id: purchase.product_id,
      stars_amount: purchase.stars_amount
    });
    
    // Delete the pending purchase
    const { error: deleteError } = await client
      .from('purchases')
      .delete()
      .eq('purchase_id', purchaseId);
    
    if (deleteError) {
      console.log('❌ Cleanup Debug - Failed to delete purchase:', deleteError);
      return NextResponse.json({ error: 'Failed to cleanup purchase' }, { status: 500 });
    }
    
    console.log('✅ Cleanup Debug - Purchase cleaned up successfully');
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('❌ Cleanup Debug - DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cleanup purchase' },
      { status: 500 }
    );
  }
}
