import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../lib/db/queries';
import type { ArcadeUnlockResponse } from '../../../../lib/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
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
    
    // Check if user has entitlements
    const { data: entitlements, error: entitlementsError } = await client
      .from('entitlements')
      .select('*')
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_new_game');
    
    if (entitlementsError || !entitlements || entitlements.length === 0) {
      return NextResponse.json(
        { error: 'No new game entitlements available' },
        { status: 409 }
      );
    }
    
    // Consume 1 entitlement
    const { error: deleteError } = await client
      .from('entitlements')
      .delete()
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_new_game')
      .limit(1);
    
    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to consume entitlement' },
        { status: 500 }
      );
    }
    
    // Restore credits to the full allotment
    const { data: updatedProfile, error: updateError } = await client
      .from('profiles')
      .update({ arcade_credits: 3 })
      .eq('profile_id', profile.profile_id)
      .select('arcade_credits')
      .single();
    
    if (updateError || !updatedProfile) {
      return NextResponse.json(
        { error: 'Failed to unlock arcade' },
        { status: 500 }
      );
    }
    
    const response: ArcadeUnlockResponse = {
      ok: true,
      arcadeCredits: updatedProfile.arcade_credits ?? 0
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Arcade unlock POST error:', error);
    return NextResponse.json(
      { error: 'Failed to unlock arcade' },
      { status: 500 }
    );
  }
}
