import type {
  ArcadeGuessResponse,
  ArcadeStartResponse,
  DailyGuessResponse,
  DailyLeaderboard,
  DailyPuzzlePayload,
  ShopCatalog
} from './contracts';

// Debug logging helper - only logs in development
function debugLog(message: string, ...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log(message, ...args);
  }
}

// Telegram WebApp types
interface TelegramWebApp {
  initData?: string;
  version?: string;
  platform?: string;
  ready?: boolean;
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
  if (typeof window === 'undefined') {
    debugLog('🔍 API Debug - Running on server side, no window object');
    return null;
  }
  
  debugLog('🔍 API Debug - Checking Telegram WebApp availability...');
  debugLog('🔍 API Debug - window.Telegram:', !!(window as TelegramWindow).Telegram);
  debugLog('🔍 API Debug - window.Telegram.WebApp:', !!(window as TelegramWindow).Telegram?.WebApp);
  
  // Try multiple ways to access Telegram WebApp
  const tg1 = (window as TelegramWindow).Telegram?.WebApp;
  const tg2 = (window as TelegramWindow).Telegram?.WebApp;
  const tg3 = (window as TelegramWindow).tg?.WebApp;
  
  const tg = tg1 || tg2 || tg3;
  
  if (!tg) {
    debugLog('❌ API Debug - Telegram WebApp not available');
    debugLog('🔍 API Debug - Available window properties:', Object.keys(window).filter(key => key.toLowerCase().includes('telegram')));
    debugLog('🔍 API Debug - All window properties:', Object.keys(window).slice(0, 20)); // First 20 properties
    
    // Try to find any Telegram-related objects
    const telegramKeys = Object.keys(window).filter(key => 
      key.toLowerCase().includes('telegram') || 
      key.toLowerCase().includes('tg') ||
      key.toLowerCase().includes('webapp')
    );
    debugLog('🔍 API Debug - Telegram-related keys:', telegramKeys);
    
    return null;
  }
  
  debugLog('🔍 API Debug - Telegram WebApp found!');
  debugLog('🔍 API Debug - Telegram WebApp initData:', tg.initData ? 'present' : 'missing');
  debugLog('🔍 API Debug - Telegram WebApp version:', tg.version);
  debugLog('🔍 API Debug - Telegram WebApp platform:', tg.platform);
  debugLog('🔍 API Debug - Telegram WebApp ready:', tg.ready);
  
  // Check if WebApp is ready
  if (!tg.ready) {
    debugLog('⚠️ API Debug - Telegram WebApp not ready yet');
  }
  
  return tg.initData || null;
}

// Helper to create headers with auth and debug info
function createHeaders(): HeadersInit {
  debugLog('🔍 Shop Debug - Creating headers for shop request');
  const initData = getTelegramInitData();
  debugLog('🔍 Shop Debug - Init data result:', initData ? 'present' : 'missing');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  if (initData) {
    headers['x-telegram-init-data'] = initData;
    debugLog('✅ Shop Debug - Added init data to headers');
  } else {
    debugLog('❌ Shop Debug - No init data available, request will fail');
    
    // Send debug info to backend for troubleshooting
    const debugInfo = {
      userAgent: navigator.userAgent,
      telegramAvailable: !!(window as TelegramWindow).Telegram,
      webAppAvailable: !!(window as TelegramWindow).Telegram?.WebApp,
      webAppVersion: (window as TelegramWindow).Telegram?.WebApp?.version,
      webAppPlatform: (window as TelegramWindow).Telegram?.WebApp?.platform,
      windowKeys: Object.keys(window).filter(key => key.toLowerCase().includes('telegram'))
    };
    
    headers['x-debug-info'] = JSON.stringify(debugInfo);
    debugLog('🔍 Shop Debug - Sending debug info to backend:', debugInfo);
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
    debugLog('⏳ API Debug - No init data found, waiting for Telegram WebApp...');
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
  length: 4 | 5 | 6 | 7, 
  hardMode = false
): Promise<ArcadeStartResponse> {
  const response = await fetch('/api/arcade/start', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ length, hardMode })
  });
  
  return handleResponse<ArcadeStartResponse>(response);
}

export async function submitArcadeGuess(
  puzzleId: string, 
  guess: string
): Promise<ArcadeGuessResponse> {
  const response = await fetch('/api/arcade/guess', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ puzzleId, guess })
  });
  
  return handleResponse<ArcadeGuessResponse>(response);
}

export async function getDailyLeaderboard(puzzleId: string): Promise<DailyLeaderboard> {
  const response = await fetch(`/api/leaderboard/daily?puzzleId=${encodeURIComponent(puzzleId)}`, {
    headers: createHeaders()
  });
  
  return handleResponse<DailyLeaderboard>(response);
}

export async function getShopCatalog(): Promise<ShopCatalog> {
  debugLog('🔍 Shop Debug - Starting getShopCatalog');
  
  // Try to get init data with retry mechanism
  let initData = getTelegramInitData();
  
  // If no init data, wait a bit and try again (Telegram WebApp might be loading)
  if (!initData && typeof window !== 'undefined') {
    debugLog('⏳ Shop Debug - No init data found, waiting for Telegram WebApp...');
    await new Promise(resolve => setTimeout(resolve, 100));
    initData = getTelegramInitData();
  }
  
  const response = await fetch('/api/shop/catalog', {
    headers: createHeaders()
  });
  
  return handleResponse<ShopCatalog>(response);
}

export async function checkDictionaryWord(word: string): Promise<{ valid: boolean }> {
  const response = await fetch(`/api/dict/check?word=${encodeURIComponent(word)}`, {
    headers: createHeaders()
  });
  
  return handleResponse<{ valid: boolean }>(response);
}

export async function getDictionaryWords(length: 4 | 5 | 6 | 7): Promise<Set<string>> {
  const response = await fetch(`/api/dict/words?length=${length}`, {
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

export async function purchaseProduct(productId: string): Promise<{ ok: boolean; purchase_id: string; invoice_url: string; stars_amount: number }> {
  debugLog('🛒 Purchase Debug - Starting purchase for product:', productId);
  
  const response = await fetch('/api/shop/purchase', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ productId })
  });
  
  return handleResponse<{ ok: boolean; purchase_id: string; invoice_url: string; stars_amount: number }>(response);
}

export async function cleanupCancelledPurchase(purchaseId: string): Promise<void> {
  debugLog('🧹 Cleanup Debug - Cleaning up cancelled purchase:', purchaseId);
  
  const response = await fetch(`/api/purchases/${purchaseId}/cleanup`, {
    method: 'DELETE',
    headers: createHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  debugLog('✅ Cleanup Debug - Purchase cleanup successful');
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
  debugLog('💸 Refund Debug - Starting refund for purchase:', purchaseId);
  
  const response = await fetch(`/api/purchases/${purchaseId}/refund`, {
    method: 'POST',
    headers: createHeaders()
  });
  
  return handleResponse<{ ok: boolean }>(response);
}
