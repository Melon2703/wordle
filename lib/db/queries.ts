import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

type Client = SupabaseClient<Database>;

// These helpers are placeholders. They throw so we do not silently ship incomplete logic.
function notImplemented(name: string): never {
  throw new Error(`${name} is not implemented`);
}

export async function getTodayPuzzle(client: Client): Promise<never> {
  void client;
  return notImplemented('getTodayPuzzle');
}

export async function upsertDailySession(
  client: Client,
  params: Record<string, unknown>
): Promise<never> {
  void client;
  void params;
  return notImplemented('upsertDailySession');
}

export async function recordDailyGuess(
  client: Client,
  params: Record<string, unknown>
): Promise<never> {
  void client;
  void params;
  return notImplemented('recordDailyGuess');
}

export async function fetchDailyLeaderboard(
  client: Client,
  puzzleId: string
): Promise<never> {
  void client;
  void puzzleId;
  return notImplemented('fetchDailyLeaderboard');
}

export async function listShopProducts(client: Client): Promise<never> {
  void client;
  return notImplemented('listShopProducts');
}
