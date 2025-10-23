import type {
  ArcadeGuessResponse,
  ArcadeStartResponse,
  DailyGuessResponse,
  DailyLeaderboard,
  DailyPuzzlePayload,
  ShopCatalog
} from './contracts';

// Helper to get Telegram init data from window
function getTelegramInitData(): string | null {
  if (typeof window === 'undefined') return null;
  
  const tg = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
  return tg?.initData || null;
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
