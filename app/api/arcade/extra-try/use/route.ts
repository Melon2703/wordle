import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../../lib/db/queries';
import type { ExtraTryUseResponse } from '../../../../../lib/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    console.log('[extra-try/use] Starting request');
    
    const auth = requireAuthContext(request);
    console.log('[extra-try/use] Auth validated, userId:', auth.userId);
    
    const client = getServiceClient();
    console.log('[extra-try/use] DB client obtained');
    
    // Parse request body
    const body = await request.json();
    console.log('[extra-try/use] Request body parsed:', body);
    const { sessionId } = body as {
      sessionId?: string;
      // failedAttempt is ignored but kept for backward compatibility with older clients
    };
    
    if (!sessionId) {
      console.log('[extra-try/use] Missing sessionId');
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }
    
    console.log('[extra-try/use] Processing sessionId:', sessionId);
    
    // Get or create user profile
    const profile = await getOrCreateProfile(
      client, 
      parseInt(auth.userId), 
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );
    console.log('[extra-try/use] Profile obtained, profile_id:', profile.profile_id);
    
    // Get session
    const { data: session, error: sessionError } = await client
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('profile_id', profile.profile_id)
      .single();
    
    if (sessionError || !session) {
      console.error('[extra-try/use] Session lookup failed:', { sessionError, session });
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    console.log('[extra-try/use] Session found:', { session_id: session.session_id, attempts_used: session.attempts_used });
    
    // Check if user has entitlements
    const { data: entitlements, error: entitlementsError } = await client
      .from('entitlements')
      .select('*')
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_extra_try');
    
    if (entitlementsError || !entitlements || entitlements.length === 0) {
      console.error('[extra-try/use] Entitlements check failed:', { entitlementsError, entitlementsCount: entitlements?.length ?? 0 });
      return NextResponse.json(
        { error: 'No extra try entitlements available' },
        { status: 409 }
      );
    }
    console.log('[extra-try/use] Entitlements found, count:', entitlements.length);
    
    // Consume 1 entitlement
    const { error: deleteError } = await client
      .from('entitlements')
      .delete()
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_extra_try')
      .limit(1);
    
    if (deleteError) {
      console.error('[extra-try/use] Failed to delete entitlement:', deleteError);
      return NextResponse.json(
        { error: 'Failed to consume entitlement' },
        { status: 500 }
      );
    }
    console.log('[extra-try/use] Entitlement deleted successfully');
    
    // Delete all guesses for this session
    const { error: deleteGuessesError } = await client
      .from('guesses')
      .delete()
      .eq('session_id', sessionId);
    
    if (deleteGuessesError) {
      console.error('[extra-try/use] Failed to delete guesses:', deleteGuessesError);
      return NextResponse.json(
        { error: 'Failed to reset guesses' },
        { status: 500 }
      );
    }
    console.log('[extra-try/use] Guesses deleted successfully');
    
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
      console.error('[extra-try/use] Failed to update session:', updateError);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }
    console.log('[extra-try/use] Session updated successfully');
    
    const response: ExtraTryUseResponse = { ok: true };
    console.log('[extra-try/use] Request completed successfully');
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[extra-try/use] Unexpected error:', error);
    console.error('[extra-try/use] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[extra-try/use] Error details:', {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error.cause : undefined
    });
    return NextResponse.json(
      { error: 'Failed to use extra try' },
      { status: 500 }
    );
  }
}
