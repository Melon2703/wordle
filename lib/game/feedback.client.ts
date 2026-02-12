// Client-side evaluation logic for Arcade mode
// Uses client-specific evaluateGuess (uppercase letters for UI) while sharing
// normalizeGuess / validateHardMode with server via policies.ts
import type { LetterState, TileFeedback } from '../types';

// Re-export shared logic from the canonical source (policies.ts)
export { normalizeGuess, validateHardMode } from './policies';
export type { HardModeContext } from './policies';

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
    letter: letter.toUpperCase(), // why: uppercase for UI display
    state: states[index]
  }));
}

export function validateDictionary(word: string, dictionary: Set<string>): boolean {
  // why: normalize word to lowercase to match Storage wordlist format
  const normalizedWord = word.trim().toLowerCase();
  return dictionary.has(normalizedWord);
}
