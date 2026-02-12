import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../../lib/db/queries';
import type { ExtraTryUseResponse } from '../../../../../lib/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Parse request body
    const body = await request.json();
    const { sessionId } = body as {
      sessionId?: string;
      // failedAttempt is ignored but kept for backward compatibility with older clients
    };
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }
    
    // Get or create user profile
    const profile = await getOrCreateProfile(
      client, 
      parseInt(auth.userId), 
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );
    
    // Get session
    const { data: session, error: sessionError } = await client
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('profile_id', profile.profile_id)
      .single();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    // Check if user has entitlements
    const { data: entitlements, error: entitlementsError } = await client
      .from('entitlements')
      .select('*')
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_extra_try');
    
    if (entitlementsError || !entitlements || entitlements.length === 0) {
      return NextResponse.json(
        { error: 'No extra try entitlements available' },
        { status: 409 }
      );
    }
    
    // Consume 1 entitlement
    const { error: deleteError } = await client
      .from('entitlements')
      .delete()
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_extra_try')
      .limit(1);
    
    if (deleteError) {
      console.error('Failed to delete entitlement');
      return NextResponse.json(
        { error: 'Failed to consume entitlement' },
        { status: 500 }
      );
    }
    
    // Delete all guesses for this session
    const { error: deleteGuessesError } = await client
      .from('guesses')
      .delete()
      .eq('session_id', sessionId);
    
    if (deleteGuessesError) {
      console.error('Failed to delete guesses');
      return NextResponse.json(
        { error: 'Failed to reset guesses' },
        { status: 500 }
      );
    }
    
    const now = new Date().toISOString();
    
    // Reset session for a fresh attempt
    const { error: updateError } = await client
      .from('sessions')
      .update({
        attempts_used: 0,
        result: null,
        ended_at: null,
        time_ms: null,
        started_at: now,
      })
      .eq('session_id', sessionId)
      .eq('profile_id', profile.profile_id);
    
    if (updateError) {
      console.error('Failed to update session');
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }
    
    const response: ExtraTryUseResponse = { ok: true };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Extra try use error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to use extra try' },
      { status: 500 }
    );
  }
}
