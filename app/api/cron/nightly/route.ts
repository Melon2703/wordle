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

    if (!dryRun) {
      const { count, error: updErr } = await client
        .from('profiles')
        .update(
          { arcade_credits: 3 },
          { count: 'exact' }
        );

      if (updErr) {
        console.error('Reset arcade credits failed', updErr);
        creditsError = 'profiles_update_failed';
      } else {
        profilesUpdated = count ?? null;
        console.log('Reset arcade credits', { profilesUpdated });
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
