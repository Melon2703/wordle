// Dictionary loader stub. Real implementation will pull curated word lists from Supabase Storage.
// See docs/backend/Backend_Documentation.md §B.5 for requirements.
export interface DictionarySets {
  allowed: Set<string>;
  answers: Set<string>;
}

let cache: DictionarySets | null = null;

export async function loadDictionary(): Promise<DictionarySets> {
  if (cache) {
    return cache;
  }

  throw new Error('Dictionary loader not implemented');
}

export function resetDictionary(): void {
  cache = null;
}
