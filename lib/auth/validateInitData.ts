import { parse, validate } from '@tma.js/init-data-node';
import type { InitData } from '@tma.js/types';
import { env } from '../env';

export interface AuthContext {
  raw: string;
  parsed: InitData;
  userId: string;
}

function pickInitDataSource(request: Request): string | null {
  const headerValue = request.headers.get('x-telegram-init-data');
  
  if (headerValue) {
    return headerValue;
  }

  const url = new URL(request.url);
  const queryValue = url.searchParams.get('init_data');
  
  if (queryValue) {
    return queryValue;
  }

  return null;
}

export function requireAuthContext(request: Request): AuthContext {
  const raw = pickInitDataSource(request);
  if (!raw) {
    throw new Error('Telegram init data missing');
  }

  const rawTrimmed = raw.trim();
  const { BOT_TOKEN } = env();


  try {
    // why: server must verify signature per Telegram guidance (docs/backend/Backend_Documentation.md §A.3)
    validate(rawTrimmed, BOT_TOKEN, { expiresIn: 60 * 60 });
    const parsed = parse(rawTrimmed);

    const userId = parsed.user?.id ?? parsed.chat?.id;
    if (!userId) {
      throw new Error('Telegram init data missing user context');
    }

    console.log('✅ Telegram auth successful');
    return {
      raw: rawTrimmed,
      parsed,
      userId: String(userId)
    };
  } catch (error) {
    console.log('❌ Telegram auth validation failed');
    throw error;
  }
}
