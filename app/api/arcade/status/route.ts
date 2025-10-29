import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../lib/db/queries';
import { TEMP_ARCADE_UNLIMITED } from '../../../../lib/env';
import type { ArcadeStatusResponse } from '../../../../lib/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Get or create user profile
    const profile = await getOrCreateProfile(
      client, 
      parseInt(auth.userId), 
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );
    
    // Get arcade_new_game entitlements count
    const { count: newGameEntitlementsCount } = await client
      .from('entitlements')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_new_game');
    
    // Derive remaining credits (capped between 0 and 3); unlimited mode keeps the UI unlocked
    const rawCredits = profile.arcade_credits ?? 0;
    const arcadeCredits = TEMP_ARCADE_UNLIMITED ? 3 : Math.max(0, Math.min(rawCredits, 3));
    
    const response: ArcadeStatusResponse = {
      arcadeCredits,
      newGameEntitlements: newGameEntitlementsCount || 0
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Arcade status GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get arcade status' },
      { status: 500 }
    );
  }
}
