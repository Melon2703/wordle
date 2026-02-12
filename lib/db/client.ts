import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';

// TODO: replace with `supabase gen types typescript` output once schema stabilizes.
// db/types.ts exists but is incomplete (missing entitlements, saved_words, telegram_users,
// notification_prefs tables and Supabase GenericSchema fields).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

let cachedClient: SupabaseClient<Database> | null = null;

export function getServiceClient(): SupabaseClient<Database> {
  if (cachedClient) {
    return cachedClient;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env();
  // why: service-role key required for backend-only routes (docs/backend/Backend_Documentation.md §B)
  cachedClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false
    }
  });

  return cachedClient;
}
