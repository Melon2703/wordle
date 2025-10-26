import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../lib/db/queries';
import { loadPuzzleAnswers } from '../../../../lib/dict/loader';
import type { ArcadeStartResponse } from '../../../../lib/contracts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Parse request body
    const body = await request.json();
    const { length, hardMode = false } = body;
    
    if (!length || ![4, 5, 6].includes(length)) {
      return NextResponse.json(
        { error: 'Invalid length. Must be 4, 5, or 6' },
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
    
    // Load puzzle answers from Storage and filter by length
    const puzzleAnswers = await loadPuzzleAnswers();
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
        letters: length,
        solution_text: randomWord,
        status: 'published',
        seed: `arcade-${Date.now()}`
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
    
    // Get hint entitlements count
    const { count: entitlementsCount } = await client
      .from('entitlements')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.profile_id)
      .eq('product_id', 'arcade_hint');
    
    const hintEntitlementsAvailable = entitlementsCount || 0;
    
    const response: ArcadeStartResponse = {
      puzzleId: puzzle.puzzle_id,
      sessionId: session.session_id,
      mode: 'arcade',
      length: length as 4 | 5 | 6,
      maxAttempts: length + 1, // Allow one extra attempt for arcade
      serverNow: new Date().toISOString(),
      solution: randomWord.toLowerCase().replace(/ё/g, 'е'), // normalized for client validation
      hintsUsed: [],
      hintEntitlementsAvailable
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
