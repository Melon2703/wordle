import { env } from '../env';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

const { BOT_TOKEN } = env();

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  parameters?: { retry_after?: number };
};

export interface InlineKeyboardButton {
  text: string;
  web_app?: { url: string };
  url?: string;
  callback_data?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export class TelegramApiError extends Error {
  readonly status: number;
  readonly description?: string;
  readonly retryAfter?: number;

  constructor(message: string, status: number, description?: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.description = description;
    this.retryAfter = retryAfter;
  }
}

async function callTelegramMethod<T>(
  method: string,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let data: TelegramResponse<T> | null = null;

  try {
    data = (await response.json()) as TelegramResponse<T>;
  } catch (error) {
    // Telegram sometimes returns HTML for 500s; fall through to error handling below.
  }

  if (!response.ok || !data?.ok) {
    const retryAfter = data?.parameters?.retry_after ?? parseRetryAfterHeader(response);
    const description = data?.description;
    throw new TelegramApiError(
      `Telegram API ${method} failed`,
      response.status,
      description,
      retryAfter
    );
  }

  return data.result as T;
}

function parseRetryAfterHeader(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) {
    return undefined;
  }

  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function sendTelegramMessage(params: {
  chatId: number;
  text: string;
  replyMarkup?: InlineKeyboardMarkup;
  disableWebPagePreview?: boolean;
  parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown';
}): Promise<void> {
  await callTelegramMethod('sendMessage', {
    chat_id: params.chatId,
    text: params.text,
    parse_mode: params.parseMode,
    disable_web_page_preview: params.disableWebPagePreview ?? true,
    reply_markup: params.replyMarkup
  });
}

export async function setMenuButton(params: {
  chatId?: number;
  text: string;
  url: string;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    menu_button: {
      type: 'web_app',
      text: params.text,
      web_app: { url: params.url }
    }
  };

  if (params.chatId) {
    payload.chat_id = params.chatId;
  }

  await callTelegramMethod('setChatMenuButton', payload);
}

export function buildWebAppUrl(baseUrl: string, route: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedRoute = route.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedRoute}`;
}

export function createWebAppButton(text: string, url: string): InlineKeyboardButton {
  return {
    text,
    web_app: { url }
  };
}

export function createUrlButton(text: string, url: string): InlineKeyboardButton {
  return {
    text,
    url
  };
}

export function createInlineKeyboard(
  rows: Array<Array<InlineKeyboardButton>>
): InlineKeyboardMarkup {
  return {
    inline_keyboard: rows
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
