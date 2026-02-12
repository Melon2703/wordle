import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { ensureUserTracked } from '../../../../lib/db/queries';
import { loadPuzzleAnswers } from '../../../../lib/dict/loader';
import { TEMP_ARCADE_UNLIMITED } from '../../../../lib/env';
import type { ArcadeStartResponse } from '@/lib/types';
import { ARCADE_THEMES } from '../../../../lib/types';
import type { ArcadeTheme } from '../../../../lib/types';

function isArcadeTheme(value: unknown): value is ArcadeTheme {
  return typeof value === 'string' && (ARCADE_THEMES as readonly string[]).includes(value);
}

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Parse request body
    const body = await request.json();
    const { length, theme, hardMode = false } = body;
    
    if (!length || ![4, 5, 6].includes(length)) {
      return NextResponse.json(
        { error: 'Invalid length. Must be 4, 5, or 6' },
        { status: 400 }
      );
    }

    if (!isArcadeTheme(theme)) {
      return NextResponse.json(
        { error: 'Invalid theme. Must be one of: common, music' },
        { status: 400 }
      );
    }
    const arcadeTheme: ArcadeTheme = theme;
    
    // Ensure user profile exists and is tracked
    const { profile } = await ensureUserTracked(client, parseInt(auth.userId), {
      username: auth.parsed.user?.username,
      firstName: auth.parsed.user?.first_name,
      lastName: auth.parsed.user?.last_name,
      languageCode: auth.parsed.user?.language_code
    });
    
    const startingCredits = profile.arcade_credits ?? 0;
    
    if (!TEMP_ARCADE_UNLIMITED && startingCredits <= 0) {
      return NextResponse.json(
        { error: 'Нет доступных аркад. Купите новую игру.' },
        { status: 403 }
      );
    }
    
    // Clean up any orphaned arcade sessions (sessions where puzzle doesn't exist)
    const { data: incompleteSessions } = await client
      .from('sessions')
      .select('session_id, puzzle_id')
      .eq('profile_id', profile.profile_id)
      .eq('mode', 'arcade')
      .is('result', null);
    
    if (incompleteSessions && incompleteSessions.length > 0) {
      for (const sess of incompleteSessions) {
        // Check if puzzle exists
        const { data: puzzleExists } = await client
          .from('puzzles')
          .select('puzzle_id')
          .eq('puzzle_id', sess.puzzle_id)
          .single();
        
        if (!puzzleExists) {
          console.log('Cleaning up orphaned session:', sess.session_id);
          // Delete the orphaned session
          await client
            .from('sessions')
            .delete()
            .eq('session_id', sess.session_id);
        }
      }
    }
    
    // Load puzzle answers from Storage and filter by length
    const puzzleAnswers = await loadPuzzleAnswers(arcadeTheme);
    const wordsOfLength = puzzleAnswers.filter(word => word.length === length);
    
    if (wordsOfLength.length === 0) {
      return NextResponse.json(
        { error: 'No words available for this length' },
        { status: 400 }
      );
    }
    
    // Pick random word from the results
    const randomWord = wordsOfLength[Math.floor(Math.random() * wordsOfLength.length)];
    
    // Create arcade puzzle
    const { data: puzzle, error: puzzleError } = await client
      .from('puzzles')
      .insert({
        mode: 'arcade',
        profile_id: profile.profile_id,
        letters: length,
        solution_text: randomWord,
        status: 'published',
        seed: `arcade-${arcadeTheme}-${Date.now()}`
      })
      .select()
      .single();
    
    if (puzzleError || !puzzle) {
      return NextResponse.json(
        { error: 'Failed to create arcade puzzle' },
        { status: 500 }
      );
    }
    
    // Create arcade session
    const { data: session, error: sessionError } = await client
      .from('sessions')
      .insert({
        profile_id: profile.profile_id,
        puzzle_id: puzzle.puzzle_id,
        mode: 'arcade',
        hard_mode: hardMode,
        started_at: new Date().toISOString(),
        hints_used: []
      })
      .select()
      .single();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Failed to create arcade session' },
        { status: 500 }
      );
    }

    // Delete older arcade puzzles for this profile; cascade clears sessions/guesses
    const { error: puzzleCleanupError } = await client
      .from('puzzles')
      .delete()
      .eq('mode', 'arcade')
      .eq('profile_id', profile.profile_id)
      .neq('puzzle_id', puzzle.puzzle_id);

    if (puzzleCleanupError) {
      console.error('Failed to clean up older arcade puzzles', puzzleCleanupError);
    }
    
    // Get entitlements counts
    const [hintResult, extraTryResult] = await Promise.all([
      client
        .from('entitlements')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profile.profile_id)
        .eq('product_id', 'arcade_hint'),
      client
        .from('entitlements')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profile.profile_id)
        .eq('product_id', 'arcade_extra_try')
    ]);
    
    const hintEntitlementsAvailable = hintResult.count || 0;
    const extraTryEntitlementsAvailable = extraTryResult.count || 0;
    
    // Consume one credit unless unlimited mode is enabled
    if (!TEMP_ARCADE_UNLIMITED) {
      const remainingCredits = Math.max(startingCredits - 1, 0);
      await client
        .from('profiles')
        .update({ arcade_credits: remainingCredits })
        .eq('profile_id', profile.profile_id);
    }
    
    const response: ArcadeStartResponse = {
      puzzleId: puzzle.puzzle_id,
      sessionId: session.session_id,
      mode: 'arcade',
      length: length as 4 | 5 | 6,
      maxAttempts: length + 1, // Allow one extra attempt for arcade
      serverNow: new Date().toISOString(),
      solution: randomWord.toLowerCase().replace(/ё/g, 'е'), // normalized for client validation
      theme: arcadeTheme,
      hintsUsed: [],
      hintEntitlementsAvailable,
      extraTryEntitlementsAvailable
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Arcade start POST error:', error);
    return NextResponse.json(
      { error: 'Failed to start arcade game' },
      { status: 500 }
    );
  }
}
