// Dictionary loader that fetches words from Supabase Storage
// See docs/backend/Backend_Documentation.md §B.2a for requirements.
import { getServiceClient } from '../db/client';
import type { ArcadeTheme } from '../types';

export interface DictionarySets {
  allowed: Set<string>;
  answers: Set<string>;
}

let cache: DictionarySets | null = null;

// Storage URLs for wordlists
const GUESSES_URL = 'https://vsxtbhwfekvbwqupbgbd.supabase.co/storage/v1/object/public/wordlists/ru/v1/for-guesses.txt';
const PUZZLE_URLS: Record<ArcadeTheme, string> = {
  common: 'https://vsxtbhwfekvbwqupbgbd.supabase.co/storage/v1/object/public/wordlists/ru/v1/for-puzzles.txt',
  music: 'https://vsxtbhwfekvbwqupbgbd.supabase.co/storage/v1/object/public/wordlists/ru/v1/music-words.txt'
};
const USED_WORDS_URL = 'https://vsxtbhwfekvbwqupbgbd.supabase.co/storage/v1/object/public/wordlists/ru/v1/daily-used-words.txt';

const puzzleCache = new Map<ArcadeTheme, string[]>();
const puzzleSetCache = new Map<ArcadeTheme, Set<string>>();

export async function loadDictionary(): Promise<DictionarySets> {
  if (cache) {
    return cache;
  }

  try {
    // Load both wordlists in parallel with Next.js caching
    const guessesResponse = await fetch(GUESSES_URL, { next: { revalidate: 21600 } });
    if (!guessesResponse.ok) {
      throw new Error('Failed to fetch guesses wordlist from Storage');
    }

    const guessesText = await guessesResponse.text();
    const answersList = await loadPuzzleAnswers('common');

    // Parse newline-delimited text files into Sets
    const allowed = new Set(
      guessesText
        .split('\n')
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0)
    );

    const answers = new Set(answersList);

    cache = { allowed, answers };
    return cache;

  } catch (error) {
    console.error('Failed to load dictionary from Storage:', error);
    throw new Error('Failed to load dictionary');
  }
}

export async function loadPuzzleAnswers(theme: ArcadeTheme = 'common'): Promise<string[]> {
  try {
    if (puzzleCache.has(theme)) {
      return puzzleCache.get(theme)!;
    }

    const url = PUZZLE_URLS[theme];
    if (!url) {
      throw new Error(`Unsupported puzzle theme: ${theme}`);
    }

    const response = await fetch(url, { next: { revalidate: 21600 } });

    if (!response.ok) {
      throw new Error('Failed to fetch puzzle answers from Storage');
    }

    const text = await response.text();
    const words = text
      .split('\n')
      .map(word => word.trim().toLowerCase().replace(/ё/g, 'е'))
      .filter(word => word.length > 0);

    puzzleCache.set(theme, words);
    puzzleSetCache.set(theme, new Set(words));

    return words;

  } catch (error) {
    console.error('Failed to load puzzle answers:', error);
    throw new Error('Failed to load puzzle answers');
  }
}

export async function loadThemeWordSet(theme: ArcadeTheme): Promise<Set<string>> {
  if (puzzleSetCache.has(theme)) {
    return puzzleSetCache.get(theme)!;
  }

  const words = await loadPuzzleAnswers(theme);
  const set = new Set(words);
  puzzleSetCache.set(theme, set);
  return set;
}

export async function loadUsedWords(): Promise<Set<string>> {
  try {
    const response = await fetch(USED_WORDS_URL, { next: { revalidate: 60 } }); // 1 minute
    
    if (!response.ok) {
      // If file doesn't exist yet, return empty set
      if (response.status === 404) {
        return new Set();
      }
      throw new Error('Failed to fetch used words from Storage');
    }

    const text = await response.text();
    return new Set(
      text
        .split('\n')
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0)
    );

  } catch (error) {
    console.error('Failed to load used words:', error);
    // Return empty set on error to allow puzzle creation
    return new Set();
  }
}

export async function updateUsedWords(words: string[]): Promise<void> {
  try {
    const client = getServiceClient();
    const text = words.join('\n');
    
    // Upload/update the used words file in Storage
    const { error } = await client.storage
      .from('wordlists')
      .upload('ru/v1/daily-used-words.txt', text, {
        upsert: true,
        contentType: 'text/plain'
      });

    if (error) {
      throw new Error(`Failed to update used words: ${error.message}`);
    }

  } catch (error) {
    console.error('Failed to update used words:', error);
    throw new Error('Failed to update used words');
  }
}

export function resetDictionary(): void {
  cache = null;
  puzzleCache.clear();
  puzzleSetCache.clear();
}
