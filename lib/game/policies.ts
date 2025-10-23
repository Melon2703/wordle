import type { GuessLine } from '@/lib/contracts';

export interface HardModeContext {
  previousLines: GuessLine[];
  nextGuess: string;
}

export function normalizeGuess(raw: string, treatYoAsYe: boolean): string {
  const upper = raw.trim().toUpperCase();
  if (!treatYoAsYe) {
    return upper;
  }
  // why: optional ё=е toggle for validation only (docs/general/Product_Spec.md §3.2)
  return upper.replaceAll('Ё', 'Е');
}

export function validateHardMode(context: HardModeContext): never {
  void context;
  throw new Error('Hard mode checks not implemented');
}
