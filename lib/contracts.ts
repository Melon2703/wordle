import type {
  ArcadeGuessResponse,
  ArcadeStartResponse,
  DailyBoardEntry,
  DailyGuessResponse,
  DailyLeaderboard,
  DailyPuzzlePayload,
  GuessLine,
  LetterState,
  Product,
  ProductType,
  ShopCatalog,
  TileFeedback
} from './types';

export type {
  ArcadeGuessResponse,
  ArcadeStartResponse,
  DailyBoardEntry,
  DailyGuessResponse,
  DailyLeaderboard,
  DailyPuzzlePayload,
  GuessLine,
  LetterState,
  Product,
  ProductType,
  ShopCatalog,
  TileFeedback
};

const createLine = (guess: string, states: LetterState[]): GuessLine => ({
  guess,
  submittedAt: new Date().toISOString(),
  feedback: states.map<TileFeedback>((state, index) => ({
    index,
    letter: guess[index] ?? '',
    state
  }))
});

export const sampleDailyPuzzle: DailyPuzzlePayload = {
  puzzleId: '00000000-0000-0000-0000-000000000001',
  mode: 'daily',
  length: 5,
  maxAttempts: 6,
  serverNow: new Date().toISOString(),
  opensAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
  keyboard: 'ru',
  hardModeAvailable: true,
  yourState: {
    status: 'playing',
    attemptsUsed: 2,
    lines: [
      createLine('КРАСК', ['present', 'absent', 'absent', 'absent', 'absent']),
      createLine('СЛОВО', ['correct', 'absent', 'present', 'absent', 'present'])
    ]
  }
};

export const sampleLeaderboard: DailyLeaderboard = {
  puzzleId: sampleDailyPuzzle.puzzleId,
  asOf: new Date().toISOString(),
  entries: [
    { rank: 1, userId: '1', displayName: 'Аня', attempts: 3, timeMs: 95000 },
    { rank: 2, userId: '2', displayName: 'Илья', attempts: 3, timeMs: 123000 },
    { rank: 3, userId: '3', displayName: 'Вера', attempts: 4, timeMs: 140000 }
  ],
  you: { rank: 8, userId: 'me', displayName: 'Вы', attempts: 4, timeMs: 170000 }
};

export const sampleShopCatalog: ShopCatalog = {
  asOf: new Date().toISOString(),
  products: [
    {
      id: 'supporter-pass',
      type: 'season_pass',
      title: 'Supporter Pass',
      subtitle: 'Архивы и расширенная аналитика',
      priceStars: 149,
      recurring: 'monthly',
      badge: 'popular'
    },
    {
      id: 'arcade-ticket-pack',
      type: 'ticket',
      title: 'Билеты в аркаду',
      subtitle: '5 попыток',
      priceStars: 49
    },
    {
      id: 'analysis-day-pass',
      type: 'analysis',
      title: 'День расширенного разбора',
      priceStars: 29
    }
  ]
};

export const sampleArcadeStart: ArcadeStartResponse = {
  puzzleId: '00000000-0000-0000-0000-0000000000aa',
  mode: 'arcade',
  length: 5,
  maxAttempts: 6,
  serverNow: new Date().toISOString()
};

export const sampleArcadeGuess: ArcadeGuessResponse = {
  puzzleId: sampleArcadeStart.puzzleId,
  line: sampleDailyPuzzle.yourState.lines[0],
  status: 'playing',
  attemptsUsed: 1
};
