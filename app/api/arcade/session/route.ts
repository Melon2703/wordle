import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile, getIncompleteArcadeSession, getHintEntitlementsCount } from '../../../../lib/db/queries';
import type { ArcadeStartResponse, GuessLine, ArcadeSessionCheckResponse } from '../../../../lib/types';

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
    
    // Check for incomplete arcade session
    const incompleteSession = await getIncompleteArcadeSession(client, profile.profile_id);
    
    if (!incompleteSession) {
      return NextResponse.json({
        hasIncomplete: false
      } as ArcadeSessionCheckResponse);
    }
    
    const { session, puzzle, guesses } = incompleteSession;
    
    // Validate that puzzle exists and has required data
    if (!puzzle || !puzzle.solution_norm) {
      console.error('Invalid puzzle data for session:', session.session_id);
      return NextResponse.json(
        { error: 'Invalid session data', hasIncomplete: false },
        { status: 500 }
      );
    }
    
    // Convert guesses to GuessLine format
    const lines: GuessLine[] = guesses.map(guess => ({
      guess: guess.text_norm,
      submittedAt: guess.created_at,
      feedback: JSON.parse(guess.feedback_mask).map((state: string, index: number) => ({
        index,
        letter: guess.text_norm[index] || '',
        state: state as 'correct' | 'present' | 'absent'
      }))
    }));
    
    // Get hint entitlements count
    const hintEntitlementsAvailable = await getHintEntitlementsCount(client, profile.profile_id);
    
    // Get extra try entitlements count
    const { count: extraTryCount } = await client
      .from('entitlements')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_extra_try');
    
    const extraTryEntitlementsAvailable = extraTryCount || 0;
    
    // Build response
    const arcadeSession: ArcadeStartResponse = {
      puzzleId: puzzle.puzzle_id,
      sessionId: session.session_id,
      mode: 'arcade',
      length: puzzle.letters as 4 | 5 | 6,
      maxAttempts: puzzle.letters + 1,
      serverNow: new Date().toISOString(),
      solution: puzzle.solution_norm, // normalized solution for client-side evaluation
      hintsUsed: (session.hints_used as Array<{letter: string; position: number}>) || [],
      hintEntitlementsAvailable,
      extraTryEntitlementsAvailable
    };
    
    return NextResponse.json({
      hasIncomplete: true,
      session: arcadeSession,
      lines,
      startedAt: session.started_at
    } as ArcadeSessionCheckResponse);
    
  } catch (error) {
    console.error('Arcade session GET error:', error);
    // If it's an orphaned session error, return hasIncomplete: false instead of 500
    if (error instanceof Error && error.message.includes('Failed to fetch puzzle for session')) {
      return NextResponse.json({
        hasIncomplete: false
      } as ArcadeSessionCheckResponse);
    }
    return NextResponse.json(
      { error: 'Failed to check arcade session', hasIncomplete: false },
      { status: 500 }
    );
  }
}
