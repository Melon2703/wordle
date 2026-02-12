import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getServiceClient } from '@/lib/db/client';
import { getOrCreateProfile, listSavedWords, getTodayPuzzle } from '@/lib/db/queries';
import {
  sendTelegramMessage,
  setMenuButton,
  buildWebAppUrl,
  type InlineKeyboardMarkup,
  TelegramApiError
} from '@/lib/server/telegram';
import { loadDictionary, loadUsedWords } from '@/lib/dict/loader';
import { upsertTelegramUser } from '@/lib/db/bot';
import {
  START_MESSAGE,
  HELP_MESSAGE,
  DICTIONARY_EMPTY_MESSAGE,
  buildStartKeyboard,
  buildStartFallbackKeyboard,
  buildHelpKeyboard,
  buildHelpFallbackKeyboard,
  buildDictionaryKeyboard,
  buildDictionaryFallbackKeyboard
} from '@/lib/bot/messaging';

export const runtime = 'nodejs';

type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

type TelegramChat = {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
};

type TelegramMessageEntity = {
  offset: number;
  length: number;
  type: string;
};

type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  entities?: TelegramMessageEntity[];
  date: number;
};

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

const DICTIONARY_SAMPLE_LIMIT = 8;

export async function POST(request: NextRequest): Promise<Response> {
  const { WEBHOOK_SECRET, MINI_APP_URL } = env();

  const secretToken = getSecretToken(request);
  if (!secretToken || secretToken !== WEBHOOK_SECRET) {
    console.warn('Telegram webhook rejected: invalid secret header', {
      hasHeader: Boolean(secretToken),
      method: request.method,
      url: request.url
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    const body = await request.json();
    update = parseUpdate(body);
  } catch (error) {
    console.error('Failed to parse request body', error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await handleUpdate(update, MINI_APP_URL);
  } catch (error) {
    console.error('Telegram webhook handler error', error);
  }

  return NextResponse.json({ ok: true });
}

function getSecretToken(request: NextRequest): string | undefined {
  const value = request.headers.get('x-telegram-bot-api-secret-token');
  if (!value) {
    return undefined;
  }
  return value;
}

function parseUpdate(body: unknown): TelegramUpdate {
  if (typeof body === 'object' && body !== null) {
    return body as TelegramUpdate;
  }

  try {
    return JSON.parse(String(body)) as TelegramUpdate;
  } catch (error) {
    console.error('Failed to parse Telegram update', error);
    return { update_id: 0 };
  }
}

async function handleUpdate(update: TelegramUpdate, miniAppUrl: string): Promise<void> {
  const message = update.message ?? update.edited_message;
  if (!message?.text) {
    return;
  }

  if (message.chat.type !== 'private') {
    return;
  }

  const command = extractCommand(message);
  if (!command) {
    return;
  }

  const user = message.from;
  if (!user || user.is_bot) {
    return;
  }

  const client = getServiceClient();

  const profile = await getOrCreateProfile(
    client,
    user.id,
    user.username,
    user.first_name,
    user.last_name
  );

  try {
    await upsertTelegramUser(client, {
      profileId: profile.profile_id,
      telegramId: user.id,
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      languageCode: user.language_code ?? null
    });
  } catch (error) {
    console.error('Failed to upsert telegram_users row', error);
  }

  switch (command) {
    case '/start':
      await handleStartCommand(message.chat.id, miniAppUrl);
      break;
    case '/help':
      await handleHelpCommand(message.chat.id, miniAppUrl);
      break;
    case '/dictionary':
      await handleDictionaryCommand(message.chat.id, client, profile.profile_id, miniAppUrl);
      break;
    case '/random':
      await handleRandomCommand(message.chat.id, client, miniAppUrl);
      break;
    default:
      await handleHelpCommand(message.chat.id, miniAppUrl);
      break;
  }
}

function extractCommand(message: TelegramMessage): string | null {
  const text = message.text?.trim();
  if (!text) {
    return null;
  }

  const entity = message.entities?.find(
    (item) => item.offset === 0 && item.type === 'bot_command'
  );

  const rawCommand = entity
    ? text.slice(entity.offset, entity.offset + entity.length)
    : text.split(/\s+/)[0];

  if (!rawCommand.startsWith('/')) {
    return null;
  }

  const lowercase = rawCommand.toLowerCase();
  return lowercase.includes('@') ? lowercase.split('@')[0] : lowercase;
}

async function handleStartCommand(chatId: number, miniAppUrl: string): Promise<void> {
  const dailyUrl = buildWebAppUrl(miniAppUrl, 'daily');

  await sendMessageWithFallback({
    chatId,
    text: START_MESSAGE,
    keyboard: buildStartKeyboard(miniAppUrl),
    fallbackKeyboard: buildStartFallbackKeyboard(miniAppUrl)
  });

  try {
    await setMenuButton({
      chatId,
      text: 'Открыть игру',
      url: dailyUrl
    });
  } catch (error) {
    if (isWebAppButtonError(error)) {
      console.warn('Skipping menu button: Telegram rejected web_app configuration');
      return;
    }
    console.error('Failed to set chat menu button', error);
  }
}

async function handleHelpCommand(chatId: number, miniAppUrl: string): Promise<void> {
  await sendMessageWithFallback({
    chatId,
    text: HELP_MESSAGE,
    keyboard: buildHelpKeyboard(miniAppUrl),
    fallbackKeyboard: buildHelpFallbackKeyboard(miniAppUrl)
  });
}

async function handleDictionaryCommand(
  chatId: number,
  client: ReturnType<typeof getServiceClient>,
  profileId: string,
  miniAppUrl: string
): Promise<void> {
  try {
    const rows = await listSavedWords(client, profileId);
    const lastWords = rows.slice(0, DICTIONARY_SAMPLE_LIMIT).map((row) => row.word_text);

    const message =
      lastWords.length > 0
        ? `Твой словарь (последние ${lastWords.length}): ${lastWords.join(', ')}

Полный список доступен в игре`
        : DICTIONARY_EMPTY_MESSAGE;

    await sendMessageWithFallback({
      chatId,
      text: message,
      keyboard: buildDictionaryKeyboard(miniAppUrl),
      fallbackKeyboard: buildDictionaryFallbackKeyboard(miniAppUrl)
    });
  } catch (error) {
    console.error('Failed to handle /dictionary command', error);
    await sendTelegramMessage({
      chatId,
      text: 'Не удалось загрузить словарь. Попробуй позже'
    });
  }
}

async function handleRandomCommand(
  chatId: number,
  client: ReturnType<typeof getServiceClient>,
  miniAppUrl: string
): Promise<void> {
  try {
    const [dictionary, usedWordsSet, todayPuzzle] = await Promise.all([
      loadDictionary(),
      loadUsedWords(),
      getTodayPuzzle(client).catch(() => null)
    ]);

    if (todayPuzzle?.solution_text) {
      usedWordsSet.add(todayPuzzle.solution_text.toLowerCase());
    }

    const pool = Array.from(dictionary.allowed).filter((word) => !usedWordsSet.has(word));

    if (pool.length === 0) {
      await sendMessageWithFallback({
        chatId,
        text: `Пока твой словарь пуст.

Играй еще, чтобы пополнить словарь!`,
        keyboard: buildStartKeyboard(miniAppUrl),
        fallbackKeyboard: buildStartFallbackKeyboard(miniAppUrl)
      });
      return;
    }

    const randomWord = pool[Math.floor(Math.random() * pool.length)]?.toUpperCase();

    await sendMessageWithFallback({
      chatId,
      text: `Случайное слово из твоего словаря: ${randomWord}

Играй еще, чтобы пополнить словарь!`,
      keyboard: buildStartKeyboard(miniAppUrl),
      fallbackKeyboard: buildStartFallbackKeyboard(miniAppUrl)
    });
  } catch (error) {
    console.error('Failed to handle /random command', error);
    await sendTelegramMessage({
      chatId,
      text: 'Не удалось выбрать слово. Попробуй позже'
    });
  }
}

async function sendMessageWithFallback(params: {
  chatId: number;
  text: string;
  keyboard: InlineKeyboardMarkup;
  fallbackKeyboard?: InlineKeyboardMarkup;
}): Promise<void> {
  try {
    await sendTelegramMessage({
      chatId: params.chatId,
      text: params.text,
      replyMarkup: params.keyboard
    });
  } catch (error) {
    if (params.fallbackKeyboard && isWebAppButtonError(error)) {
      console.warn('WebApp keyboard rejected, retrying with URL fallback');
      await sendTelegramMessage({
        chatId: params.chatId,
        text: params.text,
        replyMarkup: params.fallbackKeyboard
      });
      return;
    }

    throw error;
  }
}

function isWebAppButtonError(error: unknown): error is TelegramApiError {
  if (!(error instanceof TelegramApiError)) {
    return false;
  }

  if (error.status !== 400) {
    return false;
  }

  const description = error.description?.toLowerCase() ?? '';
  return description.includes('webapp') || description.includes('web_app');
}
