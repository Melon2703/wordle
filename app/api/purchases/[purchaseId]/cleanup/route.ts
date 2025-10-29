import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../../lib/db/client';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  context: { params: { purchaseId: string } }
): Promise<Response> {
  try {
    const auth = requireAuthContext(request);
    const { purchaseId } = context.params;
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
      return NextResponse.json({ error: 'Purchase not found or not cancellable' }, { status: 404 });
    }
    
    // Delete the pending purchase
    const { error: deleteError } = await client
      .from('purchases')
      .delete()
      .eq('purchase_id', purchaseId);
    
    if (deleteError) {
      console.error('Failed to delete purchase');
      return NextResponse.json({ error: 'Failed to cleanup purchase' }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Cleanup error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cleanup purchase' },
      { status: 500 }
    );
  }
}
