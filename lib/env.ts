const requiredKeys = [
  'BOT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'DICTIONARY_BUCKET'
] satisfies Array<keyof NodeJS.ProcessEnv>;

const optionalKeys = ['DICTIONARY_URL', 'WEBHOOK_SECRET_PATH'] satisfies Array<keyof NodeJS.ProcessEnv>;

let cache: Record<string, string | undefined> | null = null;

export type Env = Record<(typeof requiredKeys)[number], string> &
  Partial<Record<(typeof optionalKeys)[number], string>>;

export function env(): Env {
  if (cache) {
    return cache as Env;
  }

  const values: Record<string, string | undefined> = {};

  for (const key of requiredKeys) {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required env var: ${key}`);
    }
    values[key] = value;
  }

  for (const key of optionalKeys) {
    const value = process.env[key];
    if (value) {
      values[key] = value;
    }
  }

  cache = values;
  return values as Env;
}

export function resetEnvCache(): void {
  cache = null;
}
