// Types mirror docs/frontend/Frontend_Documentation.md §6 and contracts/backend_contract.yaml.
export type LetterState = 'correct' | 'present' | 'absent';

export interface TileFeedback {
  index: number;
  letter: string;
  state: LetterState;
}

export interface GuessLine {
  guess: string;
  feedback: TileFeedback[];
  submittedAt: string;
}

export interface DailyPuzzlePayload {
  puzzleId: string;
  mode: 'daily';
  length: 5;
  maxAttempts: 6;
  serverNow: string;
  opensAt: string;
  expiresAt: string;
  keyboard: 'ru';
  hardModeAvailable: boolean;
  answer?: string; // Include solution text when game is complete (for losses)
  yourState: {
    status: 'playing' | 'won' | 'lost';
    attemptsUsed: number;
    lines: GuessLine[];
    timeMs?: number;
  };
}

export interface DailyGuessResponse {
  puzzleId: string;
  line: GuessLine;
  status: 'playing' | 'won' | 'lost';
  attemptsUsed: number;
}

export interface Hint {
  letter: string;
  position: number;
}

export interface ArcadeStartResponse {
  puzzleId: string;
  sessionId: string;
  mode: 'arcade';
  length: 4 | 5 | 6;
  maxAttempts: number;
  serverNow: string;
  solution: string;
  hintsUsed: Hint[];
  hintEntitlementsAvailable: number;
}

export interface ArcadeGuessResponse {
  puzzleId: string;
  line: GuessLine;
  status: 'playing' | 'won' | 'lost';
  attemptsUsed: number;
  mmrDelta?: number;
}

export interface DailyBoardEntry {
  rank: number;
  userId: string;
  displayName: string;
  attempts: number;
  timeMs: number;
  country?: string;
  badges?: string[];
  profileUrl?: string;
}

export interface DailyLeaderboard {
  puzzleId: string;
  asOf: string;
  entries: DailyBoardEntry[];
  you?: DailyBoardEntry;
}

export type ProductType = 'ticket' | 'season_pass' | 'cosmetic' | 'analysis' | 'archive';

export interface Product {
  id: string;
  type: ProductType;
  title: string;
  subtitle?: string;
  priceStars: number;
  recurring?: 'monthly' | 'seasonal';
  badge?: 'new' | 'popular';
}

export interface ShopCatalog {
  products: Product[];
  asOf: string;
}

// User status for home page
export interface UserStatus {
  dailyStatus: 'not_started' | 'playing' | 'won' | 'lost';
  dailyAttempts?: number;
  dailyTimeMs?: number;
  streak: number;
  nextPuzzleAt: string;
  profileId?: string;  // User's profile ID for matching with leaderboard
  arcadeSolved: number;  // Total arcade puzzles solved
  lastMode?: 'daily' | 'arcade';
  lastArcadeLength?: 4 | 5 | 6;
}

// Banner system
export type BannerVariant = 'success' | 'info' | 'warning' | 'promo';

export interface Banner {
  id: string;
  variant: BannerVariant;
  message: string;
  ctaText?: string;
  ctaLink?: string;
  dismissible: boolean;
  expiresAt?: string; // ISO timestamp
}

// Share feature types
export interface SharePayload {
  v: 1;
  mode: 'daily' | 'arcade';
  date?: string; // YYYY-MM-DD for daily
  ref: string; // sharer's profile_id or telegram_id
  attempts: number;
  timeMs?: number;
  status: 'won' | 'lost';
  streak?: number;
  arcadeSolved?: number;
  length: number;
}

export interface PrepareShareRequest {
  mode: 'daily' | 'arcade';
  puzzleId: string;
  status: 'won' | 'lost';
  attemptsUsed: number;
  timeMs?: number;
  lines: GuessLine[];
  streak?: number;
  arcadeSolved?: number;
}

export interface PrepareShareResponse {
  ok: boolean;
  preparedMessageId: string;
}

// Hint system
export interface ArcadeHintRequest {
  sessionId: string;
}

export interface ArcadeHintResponse {
  hints: Hint[];
  entitlementsRemaining: number;
}

export interface ArcadeStatusResponse {
  isArcadeAvailable: boolean;
  newGameEntitlements: number;
}

export interface ArcadeUnlockResponse {
  ok: boolean;
  isArcadeAvailable: boolean;
}

export interface ArcadeSessionCheckResponse {
  hasIncomplete: boolean;
  session?: ArcadeStartResponse;
  lines?: GuessLine[];
  startedAt?: string;
}
