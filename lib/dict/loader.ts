// Dictionary loader that fetches words from database
// See docs/backend/Backend_Documentation.md §B.5 for requirements.
import { getServiceClient } from '../db/client';

export interface DictionarySets {
  allowed: Set<string>;
  answers: Set<string>;
}

let cache: DictionarySets | null = null;

export async function loadDictionary(): Promise<DictionarySets> {
  if (cache) {
    return cache;
  }

  // Load words from database
  const client = getServiceClient();
  
  const { data: words, error } = await client
    .from('dictionary_words')
    .select('text_norm, is_solution, is_allowed_guess');

  if (error) {
    console.error('Failed to load dictionary from database:', error);
    throw new Error('Failed to load dictionary');
  }

  if (!words || words.length === 0) {
    console.warn('No words found in dictionary_words table');
    throw new Error('Dictionary is empty');
  }

  // Build sets from database results
  const allowed = new Set<string>();
  const answers = new Set<string>();

  for (const word of words) {
    if (word.is_allowed_guess) {
      allowed.add(word.text_norm);
    }
    if (word.is_solution) {
      answers.add(word.text_norm);
    }
  }

  cache = { allowed, answers };
  return cache;
}

export function resetDictionary(): void {
  cache = null;
}
