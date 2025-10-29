import type {
  ArcadeGuessResponse,
  ArcadeHintRequest,
  ArcadeHintResponse,
  ArcadeStartResponse,
  ArcadeTheme,
  DailyGuessResponse,
  DailyPuzzlePayload,
  GuessLine,
  Hint,
  LetterState,
  Product,
  ProductType,
  ShopCatalog,
  TileFeedback
} from './types';

export type {
  ArcadeGuessResponse,
  ArcadeHintRequest,
  ArcadeHintResponse,
  ArcadeStartResponse,
  ArcadeTheme,
  DailyGuessResponse,
  DailyPuzzlePayload,
  GuessLine,
  Hint,
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
  sessionId: '00000000-0000-0000-0000-0000000000bb',
  mode: 'arcade',
  length: 5,
  maxAttempts: 6,
  serverNow: new Date().toISOString(),
  solution: 'СЛОВО',
  theme: 'common',
  hintsUsed: [],
  hintEntitlementsAvailable: 0,
  extraTryEntitlementsAvailable: 0
};

export const sampleArcadeGuess: ArcadeGuessResponse = {
  puzzleId: sampleArcadeStart.puzzleId,
  line: sampleDailyPuzzle.yourState.lines[0],
  status: 'playing',
  attemptsUsed: 1
};
