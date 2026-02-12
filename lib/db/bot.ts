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
  const result = await client
    .from('telegram_users')
    .select(
      `
        telegram_id,
        profile_id,
        language_code,
        profiles!inner(
          is_banned,
          notification_prefs(daily_reminder_enabled, tz_offset_minutes, last_daily_sent)
        )
      `
    )
    .limit(limit * 4);

  if (result.error) {
    throw new Error(`Failed to load reminder candidates: ${result.error.message}`);
  }

  const rows = (result.data ?? []) as Array<{
    telegram_id: number | null;
    profile_id: string | null;
    language_code?: string | null;
    profiles?: {
      is_banned?: boolean;
      notification_prefs?: Array<{
        daily_reminder_enabled?: boolean | null;
        tz_offset_minutes?: number | null;
        last_daily_sent?: string | null;
      }> | null;
    } | null;
  }>;

  const candidates: ReminderCandidate[] = [];

  for (const row of rows) {
    if (!row.telegram_id || !row.profile_id) {
      continue;
    }

    if (row.profiles?.is_banned) {
      continue;
    }

    const prefs = row.profiles?.notification_prefs?.[0];
    const enabled = prefs?.daily_reminder_enabled ?? true;
    if (!enabled) {
      continue;
    }

    const tzOffset = prefs?.tz_offset_minutes ?? 0;
    const lastSent = prefs?.last_daily_sent ?? null;

    if (!isReminderDue(now, tzOffset, lastSent)) {
      continue;
    }

    candidates.push({
      profileId: row.profile_id,
      telegramId: row.telegram_id,
      languageCode: row.language_code ?? null,
      tzOffsetMinutes: tzOffset,
      lastDailySent: lastSent
    });

    if (candidates.length >= limit) {
      break;
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

function isReminderDue(now: Date, tzOffsetMinutes: number, lastSent: string | null): boolean {
  if (!lastSent) {
    return true;
  }

  const offsetMs = tzOffsetMinutes * 60 * 1000;

  const userNow = new Date(now.getTime() + offsetMs);
  const userLast = new Date(new Date(lastSent).getTime() + offsetMs);

  const currentDay = userNow.toISOString().slice(0, 10);
  const lastDay = userLast.toISOString().slice(0, 10);

  return currentDay !== lastDay;
}
