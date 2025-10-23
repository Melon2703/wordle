// Dictionary loader with hardcoded test wordlist for v0 MVP
// See docs/backend/Backend_Documentation.md §B.5 for requirements.
export interface DictionarySets {
  allowed: Set<string>;
  answers: Set<string>;
}

let cache: DictionarySets | null = null;

// Minimal test wordlist for v0 MVP
const TEST_WORDS = {
  // 5-letter answers (common RU words)
  answers: [
    'СЛОВО', 'ЗЕМЛЯ', 'ТРАВА', 'ПТИЦА'
  ],
  // Additional allowed guesses
  allowed: [
    'СЛОВО', 'ЗЕМЛЯ', 'ТРАВА', 'ПТИЦА',
    'КРАСК', 'СТРОК', 'БУКВА', 'ТЕКСТ', 'ПЕЧАТ', 'ПИСЬМ', 'ЧИТАТ', 'СМОТР', 'СЛУША', 'ГОВОР'
  ]
};

export async function loadDictionary(): Promise<DictionarySets> {
  if (cache) {
    return cache;
  }

  // For v0 MVP: use hardcoded test words
  // TODO: Load from Supabase Storage in post-v0
  cache = {
    allowed: new Set(TEST_WORDS.allowed),
    answers: new Set(TEST_WORDS.answers)
  };

  return cache;
}

export function resetDictionary(): void {
  cache = null;
}
