// Client-side evaluation logic for Arcade mode
// Duplicated from server-side to ensure identical behavior without exposing Daily answers
import type { LetterState, TileFeedback, GuessLine } from '../contracts';

function createCounts(word: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const char of word) {
    result.set(char, (result.get(char) ?? 0) + 1);
  }
  return result;
}

export function evaluateGuess(guess: string, answer: string): TileFeedback[] {
  if (guess.length !== answer.length) {
    throw new Error('Guess length mismatch');
  }

  const letters = [...guess];
  const answerLetters = [...answer];
  const states: LetterState[] = Array(answer.length).fill('absent');
  const counts = createCounts(answer);

  // why: duplicates must respect occurrence counts (docs/general/Product_Spec.md §3.3)
  letters.forEach((letter, index) => {
    if (letter === answerLetters[index]) {
      states[index] = 'correct';
      counts.set(letter, (counts.get(letter) ?? 0) - 1);
    }
  });

  letters.forEach((letter, index) => {
    if (states[index] !== 'absent') {
      return;
    }
    const remaining = counts.get(letter) ?? 0;
    if (remaining > 0) {
      states[index] = 'present';
      counts.set(letter, remaining - 1);
    }
  });

  return letters.map((letter, index) => ({
    index,
    letter,
    state: states[index]
  }));
}

export function normalizeGuess(raw: string, treatYoAsYe: boolean): string {
  const upper = raw.trim().toUpperCase();
  if (!treatYoAsYe) {
    return upper;
  }
  // why: optional ё=е toggle for validation only (docs/general/Product_Spec.md §3.2)
  return upper.replaceAll('Ё', 'Е');
}

export interface HardModeContext {
  previousLines: GuessLine[];
  nextGuess: string;
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

export function validateDictionary(word: string, dictionary: Set<string>): boolean {
  // why: normalize word to match server logic in /api/dict/check (uppercase, trim)
  const normalizedWord = word.trim().toUpperCase();
  return dictionary.has(normalizedWord);
}
