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
  console.log('🔍 Auth Debug - Header init data:', headerValue ? 'present' : 'missing');
  
  if (headerValue) {
    console.log('✅ Using header init data');
    return headerValue;
  }

  const url = new URL(request.url);
  const queryValue = url.searchParams.get('init_data');
  console.log('🔍 Auth Debug - Query init data:', queryValue ? 'present' : 'missing');
  
  if (queryValue) {
    console.log('✅ Using query init data');
    return queryValue;
  }

  // Check for debug info from frontend
  const debugInfo = request.headers.get('x-debug-info');
  if (debugInfo) {
    try {
      const debug = JSON.parse(debugInfo);
      console.log('🔍 Frontend Debug Info:');
      console.log('  - User Agent:', debug.userAgent);
      console.log('  - Telegram Available:', debug.telegramAvailable);
      console.log('  - WebApp Available:', debug.webAppAvailable);
      console.log('  - WebApp Version:', debug.webAppVersion);
      console.log('  - WebApp Platform:', debug.webAppPlatform);
      console.log('  - Window Keys:', debug.windowKeys);
    } catch (e) {
      console.log('❌ Failed to parse debug info:', e);
    }
  }

  console.log('❌ No init data found in headers or query params');
  console.log('📋 Available headers:', Array.from(request.headers.entries()).map(([key, value]) => `${key}: ${value.substring(0, 50)}...`));
  console.log('🔗 Request URL:', request.url);
  
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

    console.log('✅ Telegram auth successful for user:', userId);
    return {
      raw: rawTrimmed,
      parsed,
      userId: String(userId)
    };
  } catch (error) {
    console.log('❌ Telegram auth validation failed:', error);
    throw error;
  }
}
