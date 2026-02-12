const WINDOW_MS = 10_000;
const MAX_REQUESTS = 8;

interface Counter {
  count: number;
  expiresAt: number;
}

const store = new Map<string, Counter>();

export function consumeRateLimit(key: string): boolean {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.expiresAt < now) {
    store.set(key, { count: 1, expiresAt: now + WINDOW_MS });
    return true;
  }

  if (existing.count >= MAX_REQUESTS) {
    return false;
  }

  existing.count += 1;
  return true;
}

export function clearRateLimit(key: string): void {
  store.delete(key);
}
