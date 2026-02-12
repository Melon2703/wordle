import type { ArcadeTheme } from '../types';
import { ARCADE_THEMES } from '../types';

/**
 * Parse arcade theme from a puzzle seed string (e.g. "arcade-music-1234" → "music").
 * Returns 'common' when the seed is missing or the extracted candidate is not a known theme.
 */
export function parseArcadeTheme(seed: string | null): ArcadeTheme {
  if (!seed) {
    return 'common';
  }

  const [, candidate] = seed.split('-');
  if (candidate && (ARCADE_THEMES as readonly string[]).includes(candidate)) {
    return candidate as ArcadeTheme;
  }

  return 'common';
}
