import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './client';

type Client = SupabaseClient<Database>;

export interface TelegramUserPayload {
  profileId: string;
  telegramId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
}

export interface ReminderCandidate {
  profileId: string;
  telegramId: number;
  languageCode: string | null;
  tzOffsetMinutes: number;
  lastDailySent: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertTelegramUser(
  client: Client,
  payload: TelegramUserPayload
): Promise<{ created: boolean }> {
  const { telegramId, profileId } = payload;
  const now = nowIso();

  const insertPayload = {
    telegram_id: telegramId,
    profile_id: profileId,
    username: payload.username ?? null,
    first_name: payload.firstName ?? null,
    last_name: payload.lastName ?? null,
    language_code: payload.languageCode ?? null
    // started_at and last_seen_at have defaults, so we don't need to set them on insert
  };

  const insertResult = await client
    .from('telegram_users')
    .insert(insertPayload)
    .select('started_at')
    .single();

  let created = true;

  if (insertResult.error) {
    if (insertResult.error.code !== '23505') {
      throw new Error(`Failed to insert telegram_users: ${insertResult.error.message}`);
    }

    created = false;

    // Update existing user - preserve started_at, update last_seen_at
    const updateResult = await client
      .from('telegram_users')
      .update({
        profile_id: profileId,
        username: payload.username ?? null,
        first_name: payload.firstName ?? null,
        last_name: payload.lastName ?? null,
        language_code: payload.languageCode ?? null,
        last_seen_at: now
        // Don't update started_at - preserve the original timestamp
      })
      .eq('telegram_id', telegramId);

    if (updateResult.error) {
      throw new Error(`Failed to update telegram_users: ${updateResult.error.message}`);
    }
  }

  const prefsResult = await client
    .from('notification_prefs')
    .upsert(
      {
        profile_id: profileId,
        daily_reminder_enabled: true,
        tz_offset_minutes: 0,
        last_daily_sent: null
      },
      { onConflict: 'profile_id', ignoreDuplicates: true }
    );

  if (prefsResult.error) {
    throw new Error(
      `Failed to upsert notification_prefs: ${prefsResult.error.message}`
    );
  }

  return { created };
}

export async function getReminderCandidates(
  client: Client,
  limit: number,
  now: Date
): Promise<ReminderCandidate[]> {
  // 20 hours ago. This ensures we don't send reminders too frequently,
  // but allows for some drift in the cron schedule.
  const cutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  const result = await client
    .from('notification_prefs')
    .select(
      `
        profile_id,
        daily_reminder_enabled,
        last_daily_sent,
        tz_offset_minutes,
        profiles!inner(
          is_banned,
          telegram_users!inner(
            telegram_id,
            language_code
          )
        )
      `
    )
    .eq('daily_reminder_enabled', true)
    .or(`last_daily_sent.is.null,last_daily_sent.lt.${cutoff.toISOString()}`)
    .order('last_daily_sent', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (result.error) {
    throw new Error(`Failed to load reminder candidates: ${result.error.message}`);
  }

  // Supabase might return relations as arrays or single objects depending on schema detection.
  // We type it loosely here to handle both, but expect it to be consistent.
  const rows = (result.data ?? []) as Array<{
    profile_id: string;
    daily_reminder_enabled: boolean;
    last_daily_sent: string | null;
    tz_offset_minutes: number;
    profiles: {
      is_banned: boolean | null;
      telegram_users: Array<{
        telegram_id: number;
        language_code: string | null;
      }> | null;
    } | Array<{
      is_banned: boolean | null;
      telegram_users: Array<{
        telegram_id: number;
        language_code: string | null;
      }> | null;
    }> | null;
  }>;

  const candidates: ReminderCandidate[] = [];

  for (const row of rows) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    if (!profile || profile.is_banned) {
      continue;
    }

    const telegramUsers = profile.telegram_users ?? [];
    for (const user of telegramUsers) {
      candidates.push({
        profileId: row.profile_id,
        telegramId: user.telegram_id,
        languageCode: user.language_code ?? null,
        tzOffsetMinutes: row.tz_offset_minutes,
        lastDailySent: row.last_daily_sent
      });
    }
  }

  return candidates;
}

export async function markReminderSent(
  client: Client,
  profileId: string,
  sentAt: Date
): Promise<void> {
  const result = await client
    .from('notification_prefs')
    .update({
      last_daily_sent: sentAt.toISOString()
    })
    .eq('profile_id', profileId);

  if (result.error) {
    throw new Error(`Failed to mark reminder sent: ${result.error.message}`);
  }


}
