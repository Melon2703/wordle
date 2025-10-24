import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../lib/db/client';
import { getOrCreateProfile, getUserPurchases } from '../../../lib/db/queries';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Get or create user profile
    const profile = await getOrCreateProfile(client, parseInt(auth.userId), auth.parsed.user?.username);
    
    // Get user purchases
    const purchases = await getUserPurchases(client, profile.profile_id);
    
    return NextResponse.json(purchases);
    
  } catch (error) {
    console.error('Purchases GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    );
  }
}
