import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getTodayPuzzle, getOrCreateProfile, getSessionGuesses } from '../../../../lib/db/queries';
import type { DailyPuzzlePayload, GuessLine } from '../../../../lib/contracts';

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
    
    // Get today's puzzle
    const puzzle = await getTodayPuzzle(client);
    
    // Check if user has an existing session
    const { data: session } = await client
      .from('sessions')
      .select('*')
      .eq('profile_id', profile.profile_id)
      .eq('puzzle_id', puzzle.puzzle_id)
      .eq('mode', 'daily')
      .single();
    
    let lines: GuessLine[] = [];
    let status: 'playing' | 'won' | 'lost' = 'playing';
    let attemptsUsed = 0;
    let timeMs: number | undefined;
    
    if (session) {
      // Get existing guesses
      const guesses = await getSessionGuesses(client, session.session_id);
      lines = guesses.map(guess => ({
        guess: guess.text_norm,
        submittedAt: guess.created_at,
        feedback: JSON.parse(guess.feedback_mask).map((state: string, index: number) => ({
          index,
          letter: guess.text_norm[index],
          state: state as 'correct' | 'present' | 'absent'
        }))
      }));
      
      attemptsUsed = session.attempts_used;
      // Map database result values to frontend status values
      status = session.result === 'win' ? 'won' : session.result === 'lose' ? 'lost' : 'playing';
      
      // Use time_ms from session if available
      if (session.time_ms) {
        timeMs = session.time_ms;
      }
    }
    
    const payload: DailyPuzzlePayload = {
      puzzleId: puzzle.puzzle_id,
      mode: 'daily',
      length: puzzle.letters as 5,
      maxAttempts: 6,
      serverNow: new Date().toISOString(),
      opensAt: puzzle.date ? new Date(puzzle.date).toISOString() : new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      keyboard: 'ru',
      hardModeAvailable: true,
      // Include answer when game is lost or won (for display)
      answer: status !== 'playing' ? puzzle.solution_text : undefined,
      yourState: {
        status,
        attemptsUsed,
        lines,
        timeMs
      }
    };
    
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Daily puzzle GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily puzzle' },
      { status: 500 }
    );
  }
}
