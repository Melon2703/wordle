import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../../lib/db/queries';
import type { ExtraTryUseResponse, GuessLine } from '../../../../../lib/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Parse request body
    const body = await request.json();
    const { sessionId, failedAttempt } = body as {
      sessionId: string;
      failedAttempt: GuessLine;
    };
    
    if (!sessionId || !failedAttempt) {
      return NextResponse.json(
        { error: 'Missing sessionId or failedAttempt' },
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
      return NextResponse.json(
        { error: 'Failed to consume entitlement' },
        { status: 500 }
      );
    }
    
    // Get the last guess (highest guess_index) for this session
    const { data: lastGuess } = await client
      .from('guesses')
      .select('*')
      .eq('session_id', sessionId)
      .order('guess_index', { ascending: false })
      .limit(1)
      .single();
    
    if (lastGuess) {
      // Delete the last guess from guesses table
      const { error: deleteGuessError } = await client
        .from('guesses')
        .delete()
        .eq('guess_id', lastGuess.guess_id);
      
      if (deleteGuessError) {
        console.error('Failed to delete last guess:', deleteGuessError);
      }
    }
    
    // Append failed attempt to hidden_attempts array
    const currentHidden = (session.hidden_attempts || []) as Array<GuessLine>;
    const updatedHidden = [...currentHidden, failedAttempt];
    
    // Update session: add to hidden_attempts and decrement attempts_used
    const { error: updateError } = await client
      .from('sessions')
      .update({ 
        hidden_attempts: updatedHidden,
        attempts_used: session.attempts_used - 1
      })
      .eq('session_id', sessionId);
    
    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }
    
    const response: ExtraTryUseResponse = {
      hiddenAttempts: updatedHidden
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Extra try use POST error:', error);
    return NextResponse.json(
      { error: 'Failed to use extra try' },
      { status: 500 }
    );
  }
}

