import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { getServiceClient } from '@/lib/db/client';
import { delay, sendTelegramMessage, TelegramApiError } from '@/lib/server/telegram';
import {
  REMINDER_MESSAGE,
  buildReminderKeyboard,
  buildReminderFallbackKeyboard
} from '@/lib/bot/messaging';
import { getReminderCandidates, markReminderSent } from '@/lib/db/bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SEND_PER_RUN = 500;
const BATCH_SIZE = 20;
const TIMEOUT_MS = 9000; // 9 seconds (Vercel Hobby limit is 10s)

type Summary = {
  ok: boolean;
  dryRun: boolean;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  durationMs: number;
  errors: Array<{ chatId: number; reason: string }>;
};

export async function GET(request: NextRequest): Promise<Response> {
  const { MINI_APP_URL } = env();

  // --- Auth guard (Vercel Cron sends Authorization: Bearer <CRON_SECRET>) ---
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (auth !== expected) {
    console.log('Daily notify rejected', { hasAuth: !!auth });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const limitParam = request.nextUrl.searchParams.get('limit');
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Math.min(
    MAX_SEND_PER_RUN,
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : MAX_SEND_PER_RUN
  );

  const client = getServiceClient();
  let candidates: Awaited<ReturnType<typeof getReminderCandidates>>;

  try {
    candidates = await getReminderCandidates(client, limit, new Date());
  } catch (error) {
    console.error('Failed to load reminder candidates', error);
    return NextResponse.json({ error: 'Failed to load reminder candidates' }, { status: 500 });
  }

  const summary: Summary = {
    ok: true,
    dryRun,
    attempted: candidates.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    errors: []
  };

  // Process in batches to control concurrency
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    // Check timeout
    if (Date.now() - startedAt > TIMEOUT_MS) {
      console.warn('Daily notify timeout reached, stopping early');
      break;
    }

    const batch = candidates.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (candidate) => {
        if (dryRun) {
          summary.skipped += 1;
          return;
        }

        try {
          await sendReminder(candidate.telegramId, MINI_APP_URL);
          await markReminderSent(client, candidate.profileId, new Date());
          summary.sent += 1;
        } catch (error) {
          summary.failed += 1;
          const reason =
            error instanceof Error ? error.message : 'Unknown error while sending reminder';
          summary.errors.push({ chatId: candidate.telegramId, reason });
          console.error('Failed to send daily reminder', { chatId: candidate.telegramId, error });
        }
      })
    );
  }

  summary.durationMs = Date.now() - startedAt;
  return NextResponse.json(summary);
}

async function sendReminder(chatId: number, baseUrl: string): Promise<void> {
  try {
    await sendTelegramMessage({
      chatId,
      text: REMINDER_MESSAGE,
      replyMarkup: buildReminderKeyboard(baseUrl)
    });
  } catch (error) {
    if (error instanceof TelegramApiError) {
      if (error.retryAfter) {
        await delay(error.retryAfter * 1000);
        await sendTelegramMessage({
          chatId,
          text: REMINDER_MESSAGE,
          replyMarkup: buildReminderKeyboard(baseUrl)
        });
        return;
      }

      if (isWebAppError(error)) {
        console.warn('Reminder web_app keyboard rejected, falling back to URL button', {
          chatId
        });
        await sendTelegramMessage({
          chatId,
          text: REMINDER_MESSAGE,
          replyMarkup: buildReminderFallbackKeyboard(baseUrl)
        });
        return;
      }
    }

    throw error;
  }
}

function isWebAppError(error: TelegramApiError): boolean {
  const description = error.description?.toLowerCase() ?? '';
  return description.includes('webapp') || description.includes('web_app');
}
