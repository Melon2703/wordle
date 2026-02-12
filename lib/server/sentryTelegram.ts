import { delay } from './telegram';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const MAX_ATTEMPTS = 2;
const BACKOFF_MS = 750;

type TelegramApiResponse = {
  ok: boolean;
  result?: unknown;
  description?: string;
  error_code?: number;
};

export class SentryTelegramError extends Error {
  readonly status: number;
  readonly description?: string;
  readonly errorCode?: number;
  readonly response?: unknown;
  readonly payload?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    description?: string,
    errorCode?: number,
    response?: unknown,
    payload?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.description = description;
    this.errorCode = errorCode;
    this.response = response;
    this.payload = payload;
  }
}

export async function sendSentryTelegramMessage(message: string): Promise<void> {
  const token = process.env.SENTRY_TELEGRAM_BOT_TOKEN;
  const chatIdValue = process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    throw new Error('Missing SENTRY_TELEGRAM_BOT_TOKEN env var');
  }

  if (!chatIdValue) {
    throw new Error('Missing TELEGRAM_CHAT_ID env var');
  }

  const chatId = Number(chatIdValue);
  if (!Number.isInteger(chatId)) {
    throw new Error('Invalid TELEGRAM_CHAT_ID env var');
  }

  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML' as const,
    disable_web_page_preview: true
  };

  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;

    try {
      const response = await fetch(
        `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const data = (await safeParseJson(response)) as TelegramApiResponse | null;

      if (!response.ok || !data?.ok) {
        const description = data?.description;
        const errorCode = data?.error_code;
        throw new SentryTelegramError(
          `Telegram sendMessage failed`,
          response.status,
          description,
          errorCode,
          data,
          payload
        );
      }

      return;
    } catch (error) {
      lastError = error;
      if (error instanceof SentryTelegramError) {
        console.error('Telegram alert send attempt failed', {
          attempt,
          status: error.status,
          description: error.description,
          errorCode: error.errorCode
        });
      } else {
        console.error('Telegram alert send attempt failed', {
          attempt,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      if (attempt >= MAX_ATTEMPTS) {
        break;
      }

      await delay(BACKOFF_MS);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to deliver Telegram alert');
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
