import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/validateInitData';
import { getServiceClient } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    // Validate Telegram init data
    const authContext = requireAuthContext(request);
    const userId = authContext.userId;
    const supabase = getServiceClient();

    // Get current date for daily puzzle
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Calculate next puzzle time (next day at 00:00 UTC)
    const nextPuzzleAt = new Date(now);
    nextPuzzleAt.setUTCDate(nextPuzzleAt.getUTCDate() + 1);
    nextPuzzleAt.setUTCHours(0, 0, 0, 0);

    // Get user's profile_id (UUID) from telegram_id (bigint)
    let profileId: string | null = null;
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('profile_id')
        .eq('telegram_id', userId)
        .single();
      
      if (profileError) {
        if (profileError.code === 'PGRST205') {
          console.warn('⚠️ profiles table not found, using defaults');
        } else {
          console.error('Error fetching profile:', profileError);
        }
      } else if (profile) {
        profileId = profile.profile_id;
      }
    } catch (error) {
      console.warn('⚠️ Failed to get profile_id');
    }

    // Try to get today's daily puzzle ID first
    let dailyPuzzleId = null;
    try {
      const { data: dailyPuzzle, error: dailyPuzzleError } = await supabase
        .from('puzzles')
        .select('puzzle_id')
        .eq('mode', 'daily')
        .eq('date', today)
        .eq('status', 'published')
        .single();
      
      if (dailyPuzzleError && dailyPuzzleError.code !== 'PGRST116') {
        if (dailyPuzzleError.code === 'PGRST205') {
          console.warn('⚠️ puzzles table not found, using defaults');
        } else {
          console.error('Error fetching daily puzzle:', dailyPuzzleError);
        }
      } else if (dailyPuzzle) {
        dailyPuzzleId = dailyPuzzle.puzzle_id;
      }
    } catch (error) {
      console.warn('⚠️ Failed to query puzzles table, using defaults');
    }

    // Try to get user's session for today's daily puzzle
    let dailySession = null;
    if (dailyPuzzleId && profileId) {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('result, attempts_used, time_ms, ended_at')
          .eq('profile_id', profileId)
          .eq('puzzle_id', dailyPuzzleId)
          .eq('mode', 'daily')
          .single();
        
        if (error && error.code !== 'PGRST116') {
          if (error.code === 'PGRST205') {
            console.warn('⚠️ sessions table not found, using defaults');
          } else {
            console.error('Error fetching daily session:', error);
          }
        } else if (data) {
          dailySession = data;
        }
      } catch (error) {
        console.warn('⚠️ Failed to query sessions table, using defaults');
      }
    }

    // Try to get user's streak
    let streak = 0;
    try {
      const { data: streakData, error: streakError } = await supabase
        .from('profiles')
        .select('streak_current')
        .eq('telegram_id', userId)
        .single();

      if (streakError) {
        if (streakError.code === 'PGRST205') {
          console.warn('⚠️ profiles table not found, using default streak');
        } else {
          console.error('Error fetching streak:', streakError);
        }
      } else {
        streak = streakData?.streak_current || 0;
      }
    } catch (error) {
      console.warn('⚠️ Failed to query profiles table, using default streak');
    }


    // Determine daily status from session data
    let dailyStatus: 'not_started' | 'playing' | 'won' | 'lost' = 'not_started';
    let dailyAttempts: number | undefined;
    let dailyTimeMs: number | undefined;

    if (dailySession) {
      if (dailySession.result === 'win') {
        dailyStatus = 'won';
        dailyAttempts = dailySession.attempts_used;
        dailyTimeMs = dailySession.time_ms;
      } else if (dailySession.result === 'lose') {
        dailyStatus = 'lost';
        dailyAttempts = dailySession.attempts_used;
        dailyTimeMs = dailySession.time_ms;
      } else {
        // result is null, meaning puzzle is in progress
        dailyStatus = 'playing';
      }
    }

    const response = {
      dailyStatus,
      dailyAttempts,
      dailyTimeMs,
      streak,
      nextPuzzleAt: nextPuzzleAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in user status endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
