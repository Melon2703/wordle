import type {
  ArcadeGuessResponse,
  ArcadeStartResponse,
  DailyGuessResponse,
  DailyLeaderboard,
  DailyPuzzlePayload,
  ShopCatalog
} from './contracts';
import {
  sampleArcadeGuess,
  sampleArcadeStart,
  sampleDailyPuzzle,
  sampleLeaderboard,
  sampleShopCatalog
} from './contracts';

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function getDailyPuzzle(): Promise<DailyPuzzlePayload> {
  return clone(sampleDailyPuzzle);
}

export async function submitDailyGuess(): Promise<DailyGuessResponse> {
  throw new Error('submitDailyGuess not wired yet');
}

export async function startArcade(): Promise<ArcadeStartResponse> {
  return clone(sampleArcadeStart);
}

export async function submitArcadeGuess(): Promise<ArcadeGuessResponse> {
  return clone(sampleArcadeGuess);
}

export async function getDailyLeaderboard(): Promise<DailyLeaderboard> {
  return clone(sampleLeaderboard);
}

export async function getShopCatalog(): Promise<ShopCatalog> {
  return clone(sampleShopCatalog);
}
