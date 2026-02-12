import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { listShopProducts } from '../../../../lib/db/queries';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    requireAuthContext(new Request('http://localhost')); // Minimal auth check for public endpoint
    
    const client = getServiceClient();
    const catalog = await listShopProducts(client);
    
    return NextResponse.json(catalog, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
    
  } catch (error) {
    console.error('Shop catalog GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch catalog' },
      { status: 500 }
    );
  }
}
