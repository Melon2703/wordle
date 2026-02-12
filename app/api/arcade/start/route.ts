import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../lib/db/queries';
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
    
    // Query database directly for random solution word of specified length
    const { data: solutionWords, error: wordError } = await client
      .from('dictionary_words')
      .select('word_id, text_norm')
      .eq('is_solution', true)
      .eq('len', length)
      .limit(1000); // Reasonable limit to avoid loading too many words
    
    if (wordError || !solutionWords || solutionWords.length === 0) {
      return NextResponse.json(
        { error: 'No words available for this length' },
        { status: 400 }
      );
    }
    
    // Pick random word from the results
    const randomWord = solutionWords[Math.floor(Math.random() * solutionWords.length)];
    
    // Create arcade puzzle
    const { data: puzzle, error: puzzleError } = await client
      .from('puzzles')
      .insert({
        mode: 'arcade',
        letters: length,
        solution_word_id: randomWord.word_id,
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
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Failed to create arcade session' },
        { status: 500 }
      );
    }
    
    const response: ArcadeStartResponse = {
      puzzleId: puzzle.puzzle_id,
      mode: 'arcade',
      length: length as 4 | 5 | 6,
      maxAttempts: length + 1, // Allow one extra attempt for arcade
      serverNow: new Date().toISOString(),
      solution: randomWord.text_norm
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
