import { NextResponse } from 'next/server';
import { requireAuthContext } from '../../../../../lib/auth/validateInitData';
import { getServiceClient } from '../../../../../lib/db/client';
import { 
  getTodayPuzzle, 
  getOrCreateProfile, 
  upsertDailySession, 
  recordDailyGuess, 
  updateSessionResult,
  getSessionGuesses 
} from '../../../../../lib/db/queries';
import { evaluateGuess } from '../../../../../lib/game/feedback';
import { normalizeGuess, validateHardMode } from '../../../../../lib/game/policies';
import { consumeRateLimit } from '../../../../../lib/rate-limit';
import { loadDictionary } from '../../../../../lib/dict/loader';
import type { DailyGuessResponse, GuessLine } from '../../../../../lib/contracts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = requireAuthContext(request);
    const client = getServiceClient();
    
    // Rate limiting
    const rateLimitKey = `daily-guess:${auth.userId}`;
    if (!consumeRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { puzzleId, guess, hardMode = false } = body;
    
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
    
    // Get today's puzzle
    const puzzle = await getTodayPuzzle(client);
    
    if (puzzle.puzzle_id !== puzzleId) {
      return NextResponse.json(
        { error: 'Invalid puzzle ID' },
        { status: 400 }
      );
    }
    
    // Normalize guess
    const normalizedGuess = normalizeGuess(guess, false); // TODO: get from user settings
    
    // Validate guess length
    if (normalizedGuess.length !== puzzle.letters) {
      return NextResponse.json(
        { error: 'Неверная длина слова' },
        { status: 400 }
      );
    }
    
    // Validate dictionary membership using Storage wordlist
    const dictionary = await loadDictionary();
    
    // Convert normalized guess to lowercase for dictionary lookup
    const guessForLookup = normalizedGuess.toLowerCase();
    
    if (!dictionary.allowed.has(guessForLookup)) {
      return NextResponse.json(
        { error: 'Слово не найдено в словаре' },
        { status: 400 }
      );
    }
    
    // Get or create session
    const session = await upsertDailySession(client, {
      profileId: profile.profile_id,
      puzzleId: puzzle.puzzle_id,
      hardMode
    });
    
    // Check if session is already completed
    if (session.result) {
      return NextResponse.json(
        { error: 'Session already completed' },
        { status: 409 }
      );
    }
    
    // Check attempts limit
    if (session.attempts_used >= 6) {
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
    if (hardMode) {
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
    const isLost = !isWin && newAttemptsUsed >= 6;
    
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
    }

    // Update streak ONLY on win
    if (isWin) {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get user's current streak and last solved date
        const { data: profileData, error: profileError } = await client
          .from('profiles')
          .select('streak_current, last_daily_played_at')
          .eq('profile_id', profile.profile_id)
          .single();
        
        if (!profileError && profileData) {
          let newStreak = 1;
          
          if (profileData.last_daily_played_at) {
            const lastSolved = new Date(profileData.last_daily_played_at);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            // If solved yesterday, increment streak
            if (lastSolved.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
              newStreak = (profileData.streak_current || 0) + 1;
            }
            // If solved today already, keep current streak
            else if (lastSolved.toISOString().split('T')[0] === today) {
              newStreak = profileData.streak_current || 1;
            }
            // Otherwise, reset to 1
          }
          
          // Update profile with new streak
          await client
            .from('profiles')
            .update({
              streak_current: newStreak,
              last_daily_played_at: new Date().toISOString()
            })
            .eq('profile_id', profile.profile_id);
        }
      } catch (error) {
        console.warn('⚠️ Failed to update streak:', error);
        // Don't fail the request if streak update fails
      }
    }

    // Reset streak on loss
    if (isLost) {
      try {
        await client
          .from('profiles')
          .update({
            streak_current: 0,
            last_daily_played_at: new Date().toISOString()
          })
          .eq('profile_id', profile.profile_id);
      } catch (error) {
        console.warn('⚠️ Failed to reset streak on loss:', error);
        // Don't fail the request if streak reset fails
      }
    }
    
    if (!isWin && !isLost) {
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
    
    const response: DailyGuessResponse = {
      puzzleId: puzzle.puzzle_id,
      line,
      status: isWin ? 'won' : isLost ? 'lost' : 'playing',
      attemptsUsed: newAttemptsUsed
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Daily guess POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process guess' },
      { status: 500 }
    );
  }
}
