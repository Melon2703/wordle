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
import { loadDictionary, loadThemeWordSet } from '../../../../lib/dict/loader';
import type { ArcadeGuessResponse, GuessLine } from '../../../../lib/contracts';
import type { ArcadeTheme } from '../../../../lib/types';
import { ARCADE_THEMES } from '../../../../lib/types';

function parseArcadeTheme(seed: string | null): ArcadeTheme {
  if (!seed) {
    return 'common';
  }

  const [, candidate] = seed.split('-');
  if (candidate && (ARCADE_THEMES as readonly string[]).includes(candidate)) {
    return candidate as ArcadeTheme;
  }

  return 'common';
}

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
    const profile = await getOrCreateProfile(
      client, 
      parseInt(auth.userId), 
      auth.parsed.user?.username,
      auth.parsed.user?.first_name,
      auth.parsed.user?.last_name
    );
    
    // Get arcade puzzle
    const { data: puzzle, error: puzzleError } = await client
      .from('puzzles')
      .select('*')
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
    
    // Normalize guess
    const normalizedGuess = normalizeGuess(guess, false);
    
    // Validate guess length
    if (normalizedGuess.length !== puzzle.letters) {
      return NextResponse.json(
        { error: 'Неверная длина слова' },
        { status: 400 }
      );
    }
    
    // Validate dictionary membership using Storage wordlist
    const guessForLookup = normalizedGuess.toLowerCase().replace(/ё/g, 'е'); // Convert to lowercase and normalize ё→е for lookup

    const theme = parseArcadeTheme(puzzle.seed);

    let wordIsAllowed: boolean;
    if (theme === 'common') {
      const dictionary = await loadDictionary();
      wordIsAllowed = dictionary.allowed.has(guessForLookup);
    } else {
      const themeWords = await loadThemeWordSet(theme);
      wordIsAllowed = themeWords.has(guessForLookup);
    }

    if (!wordIsAllowed) {
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
    
    // Check for duplicate words (case-insensitive)
    const guessForComparison = guessForLookup.toLowerCase();
    const isDuplicate = existingGuesses.some(g => g.text_norm.toLowerCase() === guessForComparison);
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'Вы уже пробовали это слово' },
        { status: 400 }
      );
    }
    
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
          { error: 'Hard mode validation failed' },
          { status: 400 }
        );
      }
    }
    
    // Evaluate guess against puzzle solution
    const feedback = evaluateGuess(guessForLookup, puzzle.solution_norm);
    const feedbackMask = JSON.stringify(feedback.map(f => f.state));
    
    // Record guess
    let guessRecord;
    try {
      guessRecord = await recordDailyGuess(client, {
        sessionId: session.session_id,
        guessIndex: session.attempts_used + 1,
        textInput: guess,
        textNorm: normalizedGuess,
        feedbackMask
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_GUESS') {
        return NextResponse.json(
          { error: 'Вы уже пробовали это слово' },
          { status: 400 }
        );
      }
      throw error;
    }
    
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
        isWin ? 'win' : 'lose',
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
      attemptsUsed: newAttemptsUsed
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
