import type {
  ArcadeGuessResponse,
  ArcadeStartResponse,
  DailyGuessResponse,
  DailyLeaderboard,
  DailyPuzzlePayload,
  ShopCatalog
} from './contracts';

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
    console.log('🔍 API Debug - Running on server side, no window object');
    return null;
  }
  
  console.log('🔍 API Debug - Checking Telegram WebApp availability...');
  console.log('🔍 API Debug - window.Telegram:', !!(window as TelegramWindow).Telegram);
  console.log('🔍 API Debug - window.Telegram.WebApp:', !!(window as TelegramWindow).Telegram?.WebApp);
  
  // Try multiple ways to access Telegram WebApp
  const tg1 = (window as TelegramWindow).Telegram?.WebApp;
  const tg2 = (window as TelegramWindow).Telegram?.WebApp;
  const tg3 = (window as TelegramWindow).tg?.WebApp;
  
  const tg = tg1 || tg2 || tg3;
  
  if (!tg) {
    console.log('❌ API Debug - Telegram WebApp not available');
    console.log('🔍 API Debug - Available window properties:', Object.keys(window).filter(key => key.toLowerCase().includes('telegram')));
    console.log('🔍 API Debug - All window properties:', Object.keys(window).slice(0, 20)); // First 20 properties
    
    // Try to find any Telegram-related objects
    const telegramKeys = Object.keys(window).filter(key => 
      key.toLowerCase().includes('telegram') || 
      key.toLowerCase().includes('tg') ||
      key.toLowerCase().includes('webapp')
    );
    console.log('🔍 API Debug - Telegram-related keys:', telegramKeys);
    
    return null;
  }
  
  console.log('🔍 API Debug - Telegram WebApp found!');
  console.log('🔍 API Debug - Telegram WebApp initData:', tg.initData ? 'present' : 'missing');
  console.log('🔍 API Debug - Telegram WebApp version:', tg.version);
  console.log('🔍 API Debug - Telegram WebApp platform:', tg.platform);
  console.log('🔍 API Debug - Telegram WebApp ready:', tg.ready);
  
  // Check if WebApp is ready
  if (!tg.ready) {
    console.log('⚠️ API Debug - Telegram WebApp not ready yet');
  }
  
  return tg.initData || null;
}

// Helper to create headers with auth and debug info
function createHeaders(): HeadersInit {
  const initData = getTelegramInitData();
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  if (initData) {
    headers['x-telegram-init-data'] = initData;
    console.log('✅ API Debug - Added init data to headers');
  } else {
    console.log('❌ API Debug - No init data available, request will fail');
    
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
    console.log('🔍 API Debug - Sending debug info to backend:', debugInfo);
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
    console.log('⏳ API Debug - No init data found, waiting for Telegram WebApp...');
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
