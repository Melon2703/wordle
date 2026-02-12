import { NextResponse, type NextRequest } from 'next/server';
import { getServiceClient } from '../../../../lib/db/client';
import { loadPuzzleAnswers, loadUsedWords, updateUsedWords } from '../../../../lib/dict/loader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  // --- Auth guard (Vercel Cron sends Authorization: Bearer <CRON_SECRET>) ---
  const auth = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (auth !== expected) {
    console.log('Nightly rollover rejected', { hasAuth: !!auth });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  const startedAt = new Date().toISOString();
  console.log('Nightly rollover started', { startedAt, dryRun });

  try {
    const client = getServiceClient();

    // --- Tomorrow (UTC) ---
    const now = new Date();
    const tomorrowUTC = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
    ));
    const tomorrowStr = tomorrowUTC.toISOString().slice(0, 10);
    const yesterdayUTC = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1
    ));
    const yesterdayStr = yesterdayUTC.toISOString().slice(0, 10);
    const twoDaysAgoUTC = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2
    ));
    const twoDaysAgoStr = twoDaysAgoUTC.toISOString().slice(0, 10);

    // --- Check if tomorrow's puzzle exists ---
    const { data: existingPuzzle, error: existingErr } = await client
      .from('puzzles')
      .select('puzzle_id')
      .eq('mode', 'daily')
      .eq('date', tomorrowStr)
      .eq('status', 'published')
      .maybeSingle();

    if (existingErr) {
      console.error('Check existing puzzle error', existingErr);
      return NextResponse.json({ error: 'check_failed' }, { status: 500 });
    }

    let created = false;
    let answer: string | null = null;
    let usedBefore = 0;
    let usedAfter = 0;
    let poolSize = 0;
    let resetCycle = false;

    if (!existingPuzzle) {
      const [puzzleAnswers, usedWords] = await Promise.all([
        loadPuzzleAnswers(),
        loadUsedWords(),
      ]);

      usedBefore = usedWords.size;

      const candidates = puzzleAnswers.filter(w => !usedWords.has(w));
      resetCycle = candidates.length === 0;
      const pool = resetCycle ? puzzleAnswers : candidates;
      poolSize = pool.length;
      answer = pool[Math.floor(Math.random() * pool.length)];

      if (!dryRun) {
        const { error: insertErr } = await client.from('puzzles').insert({
          mode: 'daily',
          date: tomorrowStr,
          letters: 5,
          solution_text: answer,
          status: 'published',
          seed: `daily-${tomorrowStr}`,
        });

        if (insertErr) {
          // Unique violation / race: another instance inserted it
          if ((insertErr as { code?: string }).code !== '23505') {
            console.error('Insert puzzle failed', insertErr);
            return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
          } else {
            console.warn('Race: puzzle already exists after insert attempt');
          }
        }

        // Update used words (reset if exhausted)
        if (resetCycle) {
          await updateUsedWords([answer!]);
          usedAfter = 1;
        } else {
          await updateUsedWords([...usedWords, answer!]);
          usedAfter = usedBefore + 1;
        }
      }

      created = true;
      console.log('Planned tomorrow puzzle', {
        date: tomorrowStr,
        answer,
        poolSize,
        resetCycle,
      });
    } else {
      console.log('Puzzle already exists', { date: tomorrowStr });
    }

    // --- Reset arcade credits for all users (with count) ---
    let profilesUpdated: number | null = null;
    let creditsError: string | null = null;
    let streakResetUpdated: number | null = null;
    let streakResetError: string | null = null;
    let dailyCleanupDeleted: number | null = null;
    let dailyCleanupError: string | null = null;

    if (!dryRun) {
      const { count, error: updErr } = await client
        .from('profiles')
        .update(
          { arcade_credits: 3 },
          { count: 'exact' }
        )
        .neq('profile_id', ''); // force a WHERE that matches all real rows

      if (updErr) {
        console.error('Reset arcade credits failed', updErr);
        creditsError = 'profiles_update_failed';
      } else {
        profilesUpdated = count ?? null;
        console.log('Reset arcade credits', { profilesUpdated });
      }
    }

    // --- Reset streaks for users who missed yesterday's puzzle ---
    if (!dryRun) {
      // First, find yesterday's puzzle
      const { data: yesterdayPuzzle, error: yesterdayPuzzleErr } = await client
        .from('puzzles')
        .select('puzzle_id')
        .eq('mode', 'daily')
        .eq('date', yesterdayStr)
        .eq('status', 'published')
        .maybeSingle();

      if (yesterdayPuzzleErr) {
        console.error('Failed to find yesterday puzzle for streak reset', yesterdayPuzzleErr);
        streakResetError = 'yesterday_puzzle_lookup_failed';
      } else if (!yesterdayPuzzle) {
        console.warn('Yesterday puzzle not found, skipping streak reset', { yesterdayStr });
        streakResetError = 'yesterday_puzzle_not_found';
      } else {
        // First, get all profile_ids that won yesterday's puzzle
        const { data: winningSessions, error: winningSessionsErr } = await client
          .from('sessions')
          .select('profile_id')
          .eq('puzzle_id', yesterdayPuzzle.puzzle_id)
          .eq('mode', 'daily')
          .eq('result', 'win');

        if (winningSessionsErr) {
          console.error('Failed to query winning sessions for streak reset', winningSessionsErr);
          streakResetError = 'winning_sessions_query_failed';
        } else {
          // Extract unique profile IDs that won
          const winningProfileIds = [...new Set((winningSessions || []).map(s => s.profile_id))];

          // Build query to reset streaks for profiles with streak > 0 that didn't win
          let streakResetQuery = client
            .from('profiles')
            .update(
              { streak_current: 0 },
              { count: 'exact' }
            )
            .gt('streak_current', 0);

          // If there are winners, exclude them from the reset
          if (winningProfileIds.length > 0) {
            // Filter to exclude winning profiles using not().in()
            // Format UUIDs properly for SQL IN clause
            const quotedIds = winningProfileIds.map(id => `"${id}"`).join(',');
            streakResetQuery = streakResetQuery.not('profile_id', 'in', `(${quotedIds})`);
          }
          // If no winners, reset all streaks > 0 (all users missed it)

          const { count: streakResetCount, error: streakResetErr } = await streakResetQuery;

          if (streakResetErr) {
            console.error('Streak reset failed', streakResetErr);
            streakResetError = 'streak_reset_failed';
          } else {
            streakResetUpdated = streakResetCount ?? null;
            console.log('Streak reset completed', { 
              streakResetUpdated, 
              yesterdayDate: yesterdayStr,
              puzzleId: yesterdayPuzzle.puzzle_id,
              winningProfileCount: winningProfileIds.length
            });
          }
        }
      }
    }

    // Delete T-2 daily, not T-1 — keep yesterday's for users in slower timezones.
    if (!dryRun) {
      const { error: cleanupDailyErr, count: dailyDeletedCount } = await client
        .from('puzzles')
        .delete({ count: 'exact' })
        .eq('mode', 'daily')
        .eq('status', 'published')
        .eq('date', twoDaysAgoStr);

      if (cleanupDailyErr) {
        dailyCleanupError = 'daily_cleanup_failed';
        console.error('Daily cleanup failed', { cleanupTargetDate: twoDaysAgoStr, error: cleanupDailyErr });
      } else {
        dailyCleanupDeleted = dailyDeletedCount ?? null;
        console.log('Daily cleanup OK', { dailyCleanupDeleted, cleanupTargetDate: twoDaysAgoStr });
      }
    }

    const finishedAt = new Date().toISOString();
    const summary = {
      ok: true,
      dryRun,
      date: tomorrowStr,
      created,
      answer,
      usedBefore,
      usedAfter,
      poolSize,
      resetCycle,
      profilesUpdated,
      creditsError,
      streakResetUpdated,
      streakResetError,
      dailyCleanupDeleted,
      dailyCleanupError,
      cleanupTargetDate: twoDaysAgoStr,
      startedAt,
      finishedAt,
    };

    console.log('Nightly rollover completed', summary);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Nightly rollover error', error);
    return NextResponse.json({ error: 'Nightly rollover failed' }, { status: 500 });
  }
}
