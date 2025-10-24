import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../lib/db/client';
import { getOrCreateProfile, getUserPurchases } from '../../../lib/db/queries';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    console.log('📦 Purchases Debug - Starting get user purchases');
    
    const auth = requireAuthContext(request);
    console.log('📦 Purchases Debug - Auth successful for user:', auth.userId);
    
    const client = getServiceClient();
    
    // Get or create user profile
    const profile = await getOrCreateProfile(client, parseInt(auth.userId), auth.parsed.user?.username);
    console.log('📦 Purchases Debug - Profile:', {
      profile_id: profile.profile_id,
      username: profile.username
    });
    
    // Get user purchases
    const purchases = await getUserPurchases(client, profile.profile_id);
    console.log('📦 Purchases Debug - Found purchases:', purchases.length);
    
    return NextResponse.json(purchases);
    
  } catch (error) {
    console.error('❌ Purchases Debug - GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    );
  }
}
