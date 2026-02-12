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

export function validateHardMode(context: HardModeContext): void {
  const { previousLines, nextGuess } = context;
  
  if (previousLines.length === 0) {
    return; // First guess, no constraints
  }

  // Collect all revealed information
  const greens: Record<number, string> = {}; // position -> letter
  const yellows: Set<string> = new Set(); // letters that must appear elsewhere

  for (const line of previousLines) {
    for (const feedback of line.feedback) {
      if (feedback.state === 'correct') {
        greens[feedback.index] = feedback.letter;
      } else if (feedback.state === 'present') {
        yellows.add(feedback.letter);
      }
    }
  }

  // Check green constraints: must reuse revealed greens in correct positions
  for (const [position, letter] of Object.entries(greens)) {
    const pos = parseInt(position);
    if (nextGuess[pos] !== letter) {
      throw new Error(`Используйте открытые буквы в новых попытках. Буква "${letter}" должна быть на позиции ${pos + 1}.`);
    }
  }

  // Check yellow constraints: must place known yellows somewhere else
  for (const yellowLetter of yellows) {
    let found = false;
    for (let i = 0; i < nextGuess.length; i++) {
      if (nextGuess[i] === yellowLetter && !greens[i]) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(`Используйте открытые буквы в новых попытках. Буква "${yellowLetter}" должна быть где-то в слове.`);
    }
  }
}
