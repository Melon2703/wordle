import type {
  ArcadeStartResponse,
  ArcadeTheme,
  DailyGuessResponse,
  DailyPuzzlePayload,
  ShopCatalog
} from './types';
import type { UserStatus, Banner, ArcadeSessionCheckResponse, SavedWord } from './types';



// Telegram WebApp types (internal to this module)
interface TelegramWebApp {
  initData?: string;
}

interface TelegramWindow {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
  tg?: {
    WebApp?: TelegramWebApp;
  };
}

// Helper to get Telegram init data from window with comprehensive detection
function getTelegramInitData(): string | null {
  // why: use mock auth in local development for testing (AGENTS.md)
  if (process.env.NODE_ENV === 'development') {
    return 'mock-init-data';
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const tg = (window as TelegramWindow).Telegram?.WebApp
    ?? (window as TelegramWindow).tg?.WebApp;

  if (!tg) {
    return null;
  }

  return tg.initData || null;
}

// Helper to create headers with auth
function createHeaders(): HeadersInit {
  const initData = getTelegramInitData();

  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };

  if (initData) {
    headers['x-telegram-init-data'] = initData;
  }

  return headers;
}

// Helper to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getDailyPuzzle(): Promise<DailyPuzzlePayload> {
  // Try to get init data with retry mechanism
  let initData = getTelegramInitData();

  // If no init data, wait a bit and try again (Telegram WebApp might be loading)
  if (!initData && typeof window !== 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 100));
    initData = getTelegramInitData();
  }

  const response = await fetch('/api/puzzle/daily', {
    headers: createHeaders()
  });

  return handleResponse<DailyPuzzlePayload>(response);
}

export async function submitDailyGuess(
  puzzleId: string,
  guess: string,
  hardMode = false
): Promise<DailyGuessResponse> {
  const response = await fetch('/api/puzzle/daily/guess', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ puzzleId, guess, hardMode })
  });

  return handleResponse<DailyGuessResponse>(response);
}

export async function startArcade(
  length: 4 | 5 | 6,
  theme: ArcadeTheme,
  hardMode = false
): Promise<ArcadeStartResponse> {
  const response = await fetch('/api/arcade/start', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ length, theme, hardMode })
  });

  return handleResponse<ArcadeStartResponse>(response);
}



export async function getShopCatalog(): Promise<ShopCatalog> {
  // Try to get init data with retry mechanism
  let initData = getTelegramInitData();

  // If no init data, wait a bit and try again (Telegram WebApp might be loading)
  if (!initData && typeof window !== 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 100));
    initData = getTelegramInitData();
  }

  const response = await fetch('/api/shop/catalog', {
    headers: createHeaders()
  });

  return handleResponse<ShopCatalog>(response);
}



export async function getDictionaryWords(length: 4 | 5 | 6 | 7, theme: ArcadeTheme): Promise<Set<string>> {
  const response = await fetch(`/api/dict/words?length=${length}&theme=${theme}`, {
    headers: createHeaders()
  });

  const data = await handleResponse<{ words: string[] }>(response);
  return new Set(data.words);
}

export async function completeArcadeSession(
  puzzleId: string,
  result: 'won' | 'lost',
  attemptsUsed: number,
  timeMs: number
): Promise<{ ok: boolean }> {
  const response = await fetch('/api/arcade/complete', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ puzzleId, result, attemptsUsed, timeMs })
  });

  return handleResponse<{ ok: boolean }>(response);
}

export async function callArcadeHint(sessionId: string): Promise<{
  hints: Array<{ letter: string; position: number }>;
  entitlementsRemaining: number;
}> {
  const response = await fetch('/api/arcade/hint', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ sessionId })
  });

  return handleResponse<{
    hints: Array<{ letter: string; position: number }>;
    entitlementsRemaining: number;
  }>(response);
}

export async function checkArcadeSession(): Promise<ArcadeSessionCheckResponse> {
  const response = await fetch('/api/arcade/session', {
    headers: createHeaders()
  });

  return handleResponse<ArcadeSessionCheckResponse>(response);
}

export async function getArcadeStatus(): Promise<{
  arcadeCredits: number;
  newGameEntitlements: number;
}> {
  const response = await fetch('/api/arcade/status', {
    headers: createHeaders()
  });

  return handleResponse<{
    arcadeCredits: number;
    newGameEntitlements: number;
  }>(response);
}

export async function unlockArcade(): Promise<{
  ok: boolean;
  arcadeCredits: number;
}> {
  const response = await fetch('/api/arcade/unlock', {
    method: 'POST',
    headers: createHeaders()
  });

  return handleResponse<{
    ok: boolean;
    arcadeCredits: number;
  }>(response);
}

export async function useExtraTry(sessionId: string): Promise<{ ok: boolean }> {
  const response = await fetch('/api/arcade/extra-try/use', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ sessionId })
  });

  return handleResponse<{ ok: boolean }>(response);
}

export async function finishExtraTry(sessionId: string): Promise<{ ok: boolean }> {
  const response = await fetch('/api/arcade/extra-try/finish', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ sessionId })
  });

  return handleResponse(response);
}

export async function recordArcadeGuess(
  sessionId: string,
  guessIndex: number,
  textInput: string,
  textNorm: string,
  feedbackMask: string
): Promise<{ ok: boolean }> {
  const response = await fetch('/api/arcade/guess/record', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({
      sessionId,
      guessIndex,
      textInput,
      textNorm,
      feedbackMask
    })
  });

  return handleResponse<{ ok: boolean }>(response);
}

export async function purchaseProduct(productId: string): Promise<{ ok: boolean; purchase_id: string; invoice_url: string; stars_amount: number }> {
  const response = await fetch('/api/shop/purchase', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ productId })
  });

  return handleResponse<{ ok: boolean; purchase_id: string; invoice_url: string; stars_amount: number }>(response);
}

export async function cleanupCancelledPurchase(purchaseId: string): Promise<void> {
  const response = await fetch(`/api/purchases/${purchaseId}/cleanup`, {
    method: 'DELETE',
    headers: createHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

export interface SaveWordResponse {
  word: SavedWord;
  alreadySaved: boolean;
}

export async function getSavedWords(): Promise<SavedWord[]> {
  const response = await fetch('/api/saved-words', {
    headers: createHeaders()
  });

  const data = await handleResponse<{ words: SavedWord[] }>(response);
  return data.words;
}

export async function saveWord(params: {
  wordText: string;
  source: 'daily' | 'arcade' | 'manual';
  puzzleId?: string | null;
  treatYoAsYe?: boolean;
}): Promise<SaveWordResponse> {
  const response = await fetch('/api/saved-words', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({
      wordText: params.wordText,
      source: params.source,
      puzzleId: params.puzzleId ?? null,
      treatYoAsYe: params.treatYoAsYe ?? false
    })
  });

  return handleResponse<SaveWordResponse>(response);
}

export async function deleteSavedWord(savedId: string): Promise<void> {
  const response = await fetch(`/api/saved-words/${savedId}`, {
    method: 'DELETE',
    headers: createHeaders()
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

// Purchase types
export interface Purchase {
  idx: number;
  purchase_id: string;
  profile_id: string;
  product_id: string;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  stars_amount: number;
  telegram_invoice_id: string | null;
  telegram_payment_charge_id: string | null;
  provider_payment_charge_id: string | null;
  provider_payload: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
  refunded_at: string | null;
  products: {
    product_id: string;
    title_ru: string;
    type: string;
    price_stars: number;
  };
}

export async function getUserPurchases(): Promise<Purchase[]> {
  const response = await fetch('/api/purchases', {
    headers: createHeaders()
  });

  return handleResponse<Purchase[]>(response);
}

export async function refundPurchase(purchaseId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`/api/purchases/${purchaseId}/refund`, {
    method: 'POST',
    headers: createHeaders()
  });

  return handleResponse<{ ok: boolean }>(response);
}

// User status and banners
export async function getUserStatus(): Promise<UserStatus> {
  const response = await fetch('/api/user/status', {
    headers: createHeaders()
  });

  return handleResponse<UserStatus>(response);
}

export async function getActiveBanners(): Promise<Banner[]> {
  const response = await fetch('/api/banners', {
    headers: createHeaders()
  });

  return handleResponse<Banner[]>(response);
}
