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

export interface ArcadeStartResponse {
  puzzleId: string;
  mode: 'arcade';
  length: 4 | 5 | 6 | 7;
  maxAttempts: number;
  serverNow: string;
  solution: string;
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
