import {
  buildWebAppUrl,
  createInlineKeyboard,
  createWebAppButton,
  createUrlButton
} from '@/lib/server/telegram';

const DAILY_ROUTE = 'daily';
const DICTIONARY_ROUTE = 'dictionary';
const SETTINGS_ROUTE = 'settings';

export const START_MESSAGE = `Привет! Готов(а) сыграть?

Правила: угадай слово за ≤6 попыток.
🟩 — буква и место совпадают
🟨 — буква есть, но в другом месте
⬛ — буквы нет в слове

Открой мини-приложение и попробуй разгадать сегодняшнее слово`;

export const HELP_MESSAGE = `Правила: угадай слово за ≤6 попыток.
🟩 — буква и место совпадают
🟨 — буква есть, но в другом месте
⬛ — буквы нет в слове

Попробуй сам(а)!`;

export const DICTIONARY_EMPTY_MESSAGE = `Твой словарь пока пуст.

Самое время наполнить его новыми словами!`;

export const REMINDER_MESSAGE = 'Новое слово уже доступно! 💡';

export function buildStartKeyboard(baseUrl: string) {
  const dailyUrl = buildWebAppUrl(baseUrl, DAILY_ROUTE);

  return createInlineKeyboard([[createWebAppButton('Играть', dailyUrl)]]);
}

export function buildStartFallbackKeyboard(baseUrl: string) {
  const dailyUrl = buildWebAppUrl(baseUrl, DAILY_ROUTE);

  return createInlineKeyboard([[createUrlButton('Играть', dailyUrl)]]);
}

export function buildHelpKeyboard(baseUrl: string) {
  return createInlineKeyboard([
    [createWebAppButton('Попробовать', buildWebAppUrl(baseUrl, DAILY_ROUTE))]
  ]);
}

export function buildHelpFallbackKeyboard(baseUrl: string) {
  return createInlineKeyboard([
    [createUrlButton('Попробовать', buildWebAppUrl(baseUrl, DAILY_ROUTE))]
  ]);
}

export function buildDictionaryKeyboard(baseUrl: string) {
  return createInlineKeyboard([
    [createWebAppButton('Открыть словарь', buildWebAppUrl(baseUrl, DICTIONARY_ROUTE))]
  ]);
}

export function buildDictionaryFallbackKeyboard(baseUrl: string) {
  return createInlineKeyboard([
    [createUrlButton('Открыть словарь', buildWebAppUrl(baseUrl, DICTIONARY_ROUTE))]
  ]);
}

export function buildReminderKeyboard(baseUrl: string) {
  return createInlineKeyboard([
    [createWebAppButton('Открыть игру', buildWebAppUrl(baseUrl, DAILY_ROUTE))],
    [createWebAppButton('Настройки уведомлений', buildWebAppUrl(baseUrl, SETTINGS_ROUTE))]
  ]);
}

export function buildReminderFallbackKeyboard(baseUrl: string) {
  return createInlineKeyboard([
    [createUrlButton('Открыть игру', buildWebAppUrl(baseUrl, DAILY_ROUTE))],
    [createUrlButton('Настройки уведомлений', buildWebAppUrl(baseUrl, SETTINGS_ROUTE))]
  ]);
}
