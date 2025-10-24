import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { getOrCreateProfile } from '../../../../lib/db/queries';
import { loadDictionary } from '../../../../lib/dict/loader';
import type { ArcadeStartResponse } from '../../../../lib/contracts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Parse request body
    const body = await request.json();
    const { length, hardMode = false } = body;
    
    if (!length || ![4, 5, 6, 7].includes(length)) {
      return NextResponse.json(
        { error: 'Invalid length. Must be 4, 5, 6, or 7' },
        { status: 400 }
      );
    }
    
    // Get or create user profile
    const profile = await getOrCreateProfile(client, parseInt(auth.userId), auth.parsed.user?.username);
    
    // Load dictionary
    const dictionary = await loadDictionary();
    
    // Pick random word of specified length
    const answers = Array.from(dictionary.answers).filter(word => word.length === length);
    if (answers.length === 0) {
      return NextResponse.json(
        { error: 'No words available for this length' },
        { status: 400 }
      );
    }
    
    const randomAnswer = answers[Math.floor(Math.random() * answers.length)];
    
    // Get the word from database
    const { data: solutionWord } = await client
      .from('dictionary_words')
      .select('word_id')
      .eq('text_norm', randomAnswer)
      .eq('is_solution', true)
      .single();
    
    if (!solutionWord) {
      return NextResponse.json(
        { error: 'Solution word not found in database' },
        { status: 500 }
      );
    }
    
    // Create arcade puzzle
    const { data: puzzle, error: puzzleError } = await client
      .from('puzzles')
      .insert({
        mode: 'arcade',
        letters: length,
        solution_word_id: solutionWord.word_id,
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
      length: length as 4 | 5 | 6 | 7,
      maxAttempts: length + 1, // Allow one extra attempt for arcade
      serverNow: new Date().toISOString(),
      solution: randomAnswer
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
