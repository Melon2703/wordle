import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../lib/db/queries';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
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
    const profile = await getOrCreateProfile(client, parseInt(auth.userId), auth.parsed.user?.username);
    
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
    
    // Create purchase record (stub for v0)
    const { error: purchaseError } = await client
      .from('purchases')
      .insert({
        profile_id: profile.profile_id,
        product_id: productId,
        status: 'pending',
        stars_amount: product.price_stars,
        provider_payload: {}
      });
    
    if (purchaseError) {
      return NextResponse.json(
        { error: 'Failed to create purchase' },
        { status: 500 }
      );
    }
    
    // TODO: In post-v0, integrate with Telegram Stars API
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Purchase POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process purchase' },
      { status: 500 }
    );
  }
}
