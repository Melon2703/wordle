import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../lib/db/client';
import { 
  getOrCreateProfile, 
  recordDailyGuess, 
  updateSessionResult,
  getSessionGuesses 
} from '../../../../lib/db/queries';
import { evaluateGuess } from '../../../../lib/game/feedback';
import { normalizeGuess, validateHardMode } from '../../../../lib/game/policies';
import { consumeRateLimit } from '../../../../lib/rate-limit';
import type { ArcadeGuessResponse, GuessLine } from '../../../../lib/contracts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Rate limiting
    const rateLimitKey = `arcade-guess:${auth.userId}`;
    if (!consumeRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { puzzleId, guess } = body;
    
    if (!puzzleId || !guess) {
      return NextResponse.json(
        { error: 'Missing puzzleId or guess' },
        { status: 400 }
      );
    }
    
    // Get or create user profile
    const profile = await getOrCreateProfile(client, parseInt(auth.userId), auth.parsed.user?.username);
    
    // Get arcade puzzle and solution
    const { data: puzzle, error: puzzleError } = await client
      .from('puzzles')
      .select(`
        *,
        dictionary_words!solution_word_id(*)
      `)
      .eq('puzzle_id', puzzleId)
      .eq('mode', 'arcade')
      .eq('status', 'published')
      .single();
    
    if (puzzleError || !puzzle) {
      return NextResponse.json(
        { error: 'Arcade puzzle not found' },
        { status: 404 }
      );
    }
    
    const solution = puzzle.dictionary_words as { word: string; text_norm: string };
    
    // Normalize guess
    const normalizedGuess = normalizeGuess(guess, false);
    
    // Validate guess length
    if (normalizedGuess.length !== puzzle.letters) {
      return NextResponse.json(
        { error: 'Неверная длина слова' },
        { status: 400 }
      );
    }
    
    // Validate dictionary membership using database
    const { data: wordCheck } = await client
      .from('dictionary_words')
      .select('word_id, is_allowed_guess')
      .eq('text_norm', normalizedGuess)
      .eq('len', puzzle.letters)
      .single();
    
    if (!wordCheck || !wordCheck.is_allowed_guess) {
      return NextResponse.json(
        { error: 'Слово не найдено в словаре' },
        { status: 400 }
      );
    }
    
    // Get arcade session
    const { data: session, error: sessionError } = await client
      .from('sessions')
      .select('*')
      .eq('profile_id', profile.profile_id)
      .eq('puzzle_id', puzzleId)
      .eq('mode', 'arcade')
      .single();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Arcade session not found' },
        { status: 404 }
      );
    }
    
    // Check if session is already completed
    if (session.result) {
      return NextResponse.json(
        { error: 'Session already completed' },
        { status: 409 }
      );
    }
    
    // Check attempts limit
    if (session.attempts_used >= puzzle.letters + 1) {
      return NextResponse.json(
        { error: 'Maximum attempts reached' },
        { status: 409 }
      );
    }
    
    // Get existing guesses for hard mode validation
    const existingGuesses = await getSessionGuesses(client, session.session_id);
    const existingLines: GuessLine[] = existingGuesses.map(guess => ({
      guess: guess.text_norm,
      submittedAt: guess.created_at,
      feedback: JSON.parse(guess.feedback_mask).map((state: string, index: number) => ({
        index,
        letter: guess.text_norm[index],
        state: state as 'correct' | 'present' | 'absent'
      }))
    }));
    
    // Validate hard mode constraints
    if (session.hard_mode) {
      try {
        validateHardMode({
          previousLines: existingLines,
          nextGuess: normalizedGuess
        });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Hard mode validation failed' },
          { status: 400 }
        );
      }
    }
    
    // Evaluate guess
    const feedback = evaluateGuess(normalizedGuess, solution.text_norm);
    const feedbackMask = JSON.stringify(feedback.map(f => f.state));
    
    // Record guess
    const guessRecord = await recordDailyGuess(client, {
      sessionId: session.session_id,
      guessIndex: session.attempts_used + 1,
      textInput: guess,
      textNorm: normalizedGuess,
      feedbackMask
    });
    
    // Check if won
    const isWin = feedback.every(f => f.state === 'correct');
    const newAttemptsUsed = session.attempts_used + 1;
    const isLost = !isWin && newAttemptsUsed >= puzzle.letters + 1;
    
    // Update session result if game ended
    if (isWin || isLost) {
      const timeMs = Date.now() - new Date(session.started_at).getTime();
      await updateSessionResult(
        client,
        session.session_id,
        isWin ? 'win' : 'lost',
        newAttemptsUsed,
        timeMs
      );
    } else {
      // Update attempts count
      await client
        .from('sessions')
        .update({ attempts_used: newAttemptsUsed })
        .eq('session_id', session.session_id);
    }
    
    // Create response
    const line: GuessLine = {
      guess: normalizedGuess,
      submittedAt: guessRecord.created_at,
      feedback
    };
    
    const response: ArcadeGuessResponse = {
      puzzleId: puzzle.puzzle_id,
      line,
      status: isWin ? 'won' : isLost ? 'lost' : 'playing',
      attemptsUsed: newAttemptsUsed,
      mmrDelta: (isWin || isLost) ? 0 : undefined // Stub for v0
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Arcade guess POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process guess' },
      { status: 500 }
    );
  }
}
