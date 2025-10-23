import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';
import type { Database } from './types';

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
