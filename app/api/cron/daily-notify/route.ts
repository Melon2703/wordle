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

const MAX_SEND_PER_RUN = 60;
const DEFAULT_DELAY_MS = 40;

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

  const expectedSecret = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  const authHeader = request.headers.get('authorization');

  if (!expectedSecret || authHeader !== expectedSecret) {
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

  for (const candidate of candidates) {
    const chatId = candidate.telegramId;

    if (dryRun) {
      summary.skipped += 1;
      continue;
    }

    try {
      await sendReminder(chatId, MINI_APP_URL);
      await markReminderSent(client, candidate.profileId, new Date());
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      const reason =
        error instanceof Error ? error.message : 'Unknown error while sending reminder';
      summary.errors.push({ chatId, reason });
      console.error('Failed to send daily reminder', { chatId, error });
    }

    await delay(DEFAULT_DELAY_MS);
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
