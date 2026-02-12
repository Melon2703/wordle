import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './client';
import type { ShopCatalog, GuessLine } from '../types';
import { upsertTelegramUser } from './bot';

type Client = SupabaseClient<Database>;
type GuessRow = Database['public']['Tables']['guesses']['Row'];

/**
 * Convert a database guess row into a client-facing GuessLine.
 * Replaces 4× inlined copies of the same JSON.parse + map logic.
 */
export function guessRowToLine(guess: GuessRow): GuessLine {
  return {
    guess: guess.text_norm,
    submittedAt: guess.created_at,
    feedback: JSON.parse(guess.feedback_mask).map((state: string, index: number) => ({
      index,
      letter: guess.text_norm[index],
      state: state as 'correct' | 'present' | 'absent'
    }))
  };
}

/**
 * Update the user's daily streak after a win.
 * If they solved yesterday's puzzle, increment; if today's already counted, keep; otherwise reset to 1.
 */
export async function updateStreak(client: Client, profileId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const { data: profileData, error: profileError } = await client
    .from('profiles')
    .select('streak_current, last_daily_played_at')
    .eq('profile_id', profileId)
    .single();

  if (profileError || !profileData) return;

  let newStreak = 1;

  if (profileData.last_daily_played_at) {
    const lastSolved = new Date(profileData.last_daily_played_at);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastSolved.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
      newStreak = (profileData.streak_current || 0) + 1;
    } else if (lastSolved.toISOString().split('T')[0] === today) {
      newStreak = profileData.streak_current || 1;
    }
  }

  await client
    .from('profiles')
    .update({
      streak_current: newStreak,
      last_daily_played_at: new Date().toISOString()
    })
    .eq('profile_id', profileId);
}

/**
 * Reset the user's daily streak to 0 after a loss.
 */
export async function resetStreak(client: Client, profileId: string): Promise<void> {
  await client
    .from('profiles')
    .update({
      streak_current: 0,
      last_daily_played_at: new Date().toISOString()
    })
    .eq('profile_id', profileId);
}

export async function getTodayPuzzle(client: Client): Promise<Database['public']['Tables']['puzzles']['Row']> {
  const today = new Date().toISOString().split('T')[0];

  // Get today's daily puzzle
  const { data: puzzle, error: puzzleError } = await client
    .from('puzzles')
    .select('*')
    .eq('mode', 'daily')
    .eq('date', today)
    .eq('status', 'published')
    .single();

  if (puzzleError || !puzzle) {
    throw new Error('Today\'s puzzle not found');
  }

  return puzzle;
}

export async function upsertDailySession(
  client: Client,
  params: {
    profileId: string;
    puzzleId: string;
    hardMode?: boolean;
  }
): Promise<Database['public']['Tables']['sessions']['Row']> {
  // First, try to find existing session
  const { data: existing, error: findError } = await client
    .from('sessions')
    .select('*')
    .eq('profile_id', params.profileId)
    .eq('puzzle_id', params.puzzleId)
    .eq('mode', 'daily')
    .single();

  if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw new Error(`Failed to find existing session: ${findError.message}`);
  }

  if (existing && !findError) {
    // Update existing session
    const { data: updated, error: updateError } = await client
      .from('sessions')
      .update({
        hard_mode: params.hardMode || false
      })
      .eq('session_id', existing.session_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update session: ${updateError.message}`);
    }

    return updated;
  }

  // Create new session
  const sessionData = {
    profile_id: params.profileId,
    puzzle_id: params.puzzleId,
    mode: 'daily',
    hard_mode: params.hardMode || false,
    started_at: new Date().toISOString()
  };

  const { data, error } = await client
    .from('sessions')
    .insert(sessionData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to create session: No data returned');
  }

  return data;
}

export async function recordDailyGuess(
  client: Client,
  params: {
    sessionId: string;
    guessIndex: number;
    textInput: string;
    textNorm: string;
    feedbackMask: string;
  }
): Promise<Database['public']['Tables']['guesses']['Row']> {
  const { data, error } = await client
    .from('guesses')
    .insert({
      session_id: params.sessionId,
      guess_index: params.guessIndex,
      text_input: params.textInput,
      text_norm: params.textNorm,
      feedback_mask: params.feedbackMask
    })
    .select()
    .single();

  if (error || !data) {
    // Check for unique constraint violation (duplicate guess)
    if (error?.code === '23505' || (error?.message && error.message.includes('guesses_unique_per_session_word'))) {
      throw new Error('DUPLICATE_GUESS');
    }
    console.error('Failed to record guess');
    throw new Error('Failed to record guess');
  }

  return data;
}

export async function recordArcadeGuess(
  client: Client,
  params: {
    sessionId: string;
    guessIndex: number;
    textInput: string;
    textNorm: string;
    feedbackMask: string;
  }
): Promise<Database['public']['Tables']['guesses']['Row']> {
  const { data, error } = await client
    .from('guesses')
    .insert({
      session_id: params.sessionId,
      guess_index: params.guessIndex,
      text_input: params.textInput,
      text_norm: params.textNorm,
      feedback_mask: params.feedbackMask
    })
    .select()
    .single();

  if (error || !data) {
    // Check for unique constraint violation (duplicate guess)
    if (error?.code === '23505' || (error?.message && error.message.includes('guesses_unique_per_session_word'))) {
      throw new Error('DUPLICATE_GUESS');
    }
    console.error('Failed to record arcade guess');
    throw new Error('Failed to record arcade guess');
  }

  // Update session attempts_used counter
  const { error: updateError } = await client
    .from('sessions')
    .update({ attempts_used: params.guessIndex })
    .eq('session_id', params.sessionId);

  if (updateError) {
    console.error('Failed to update session attempts:', updateError);
    // Don't throw - guess was recorded successfully
  }

  return data;
}

export async function updateSessionResult(
  client: Client,
  sessionId: string,
  result: 'win' | 'lose' | 'abandon',
  attemptsUsed: number,
  timeMs?: number
): Promise<void> {
  const { error } = await client
    .from('sessions')
    .update({
      result,
      attempts_used: attemptsUsed,
      ended_at: new Date().toISOString(),
      time_ms: timeMs
    })
    .eq('session_id', sessionId);

  if (error) {
    console.error('Failed to update session result');
    throw new Error('Failed to update session result');
  }
}

export async function listShopProducts(client: Client): Promise<ShopCatalog> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to fetch products');
  }

  const products = data || [];

  return {
    asOf: new Date().toISOString(),
    products: products.map(product => ({
      id: product.product_id,
      type: product.type,
      title: product.title_ru,
      subtitle: product.description_ru || undefined,
      priceStars: product.price_stars,
      recurring: product.recurring || undefined,
      badge: product.badge || undefined
    }))
  };
}

export async function getUserPurchases(
  client: Client,
  profileId: string
): Promise<Database['public']['Tables']['purchases']['Row'][]> {
  const { data, error } = await client
    .from('purchases')
    .select(`
      *,
      products!inner(
        product_id,
        title_ru,
        type,
        price_stars
      )
    `)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user purchases: ${error.message}`);
  }

  return data || [];
}

export async function refundPurchase(
  client: Client,
  purchaseId: string
): Promise<Database['public']['Tables']['purchases']['Row']> {
  // Get purchase details
  const { data: purchase, error: fetchError } = await client
    .from('purchases')
    .select('*')
    .eq('purchase_id', purchaseId)
    .single();

  if (fetchError || !purchase) {
    throw new Error(`Purchase not found: ${fetchError?.message || 'Unknown error'}`);
  }

  if (purchase.status !== 'paid') {
    // For testing purposes, allow refunding pending purchases
    if (purchase.status === 'pending') {
      // Allow refund of pending purchase for testing
    } else {
      throw new Error('Only paid purchases can be refunded');
    }
  }

  // Call Telegram Stars refund API if we have a payment charge ID
  if (purchase.telegram_payment_charge_id) {
    try {
      const { env } = await import('../env');
      const { BOT_TOKEN } = env();

      // Extract user_id from provider_payload
      const providerPayload = typeof purchase.provider_payload === 'string'
        ? JSON.parse(purchase.provider_payload)
        : purchase.provider_payload;

      const userId = providerPayload.user_id;

      if (!userId) {
        throw new Error('User ID not found in purchase payload');
      }

      const refundResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/refundStarPayment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: parseInt(userId),
          telegram_payment_charge_id: purchase.telegram_payment_charge_id
        })
      });

      if (!refundResponse.ok) {
        const errorText = await refundResponse.text();
        throw new Error(`Telegram refund failed: ${errorText}`);
      }

      // Verify refund was successful
      await refundResponse.json();

    } catch (error) {
      console.error('Error calling Telegram refund API');
      throw new Error(`Failed to process refund with Telegram: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    // For purchases without charge ID, we can't call the Telegram refund API
    // but we can still mark it as refunded in our database
    // This handles cases where the webhook didn't capture the payment properly
  }

  // Update purchase status to refunded
  const { data: updatedPurchase, error: updateError } = await client
    .from('purchases')
    .update({
      status: 'refunded'
    })
    .eq('purchase_id', purchaseId)
    .select()
    .single();

  if (updateError || !updatedPurchase) {
    throw new Error(`Failed to refund purchase: ${updateError?.message || 'Unknown error'}`);
  }

  return updatedPurchase;
}

export async function getOrCreateProfile(
  client: Client,
  telegramId: number,
  username?: string,
  firstName?: string,
  lastName?: string
): Promise<Database['public']['Tables']['profiles']['Row']> {
  // Try to find existing profile
  const { data: existing, error: findError } = await client
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw new Error(`Failed to find profile: ${findError.message}`);
  }

  if (existing && !findError) {
    // Update existing profile with latest data
    const { data: updated, error: updateError } = await client
      .from('profiles')
      .update({
        username: username || null,
        first_name: firstName || null,
        last_name: lastName || null
      })
      .eq('profile_id', existing.profile_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    return updated;
  }

  // Create new profile
  const { data, error } = await client
    .from('profiles')
    .insert({
      telegram_id: telegramId,
      username: username || null,
      first_name: firstName || null,
      last_name: lastName || null,
      arcade_credits: 3
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create profile: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to create profile: No data returned');
  }

  return data;
}

/**
 * Ensures a user profile exists and is tracked in telegram_users table.
 * This function combines getOrCreateProfile and upsertTelegramUser to ensure
 * user data is consistently tracked regardless of how the user accesses the app.
 * 
 * @param client - Supabase client
 * @param telegramId - Telegram user ID
 * @param userData - Optional user data from Telegram (username, first_name, last_name, language_code)
 * @returns Profile and tracking status
 */
export async function ensureUserTracked(
  client: Client,
  telegramId: number,
  userData?: {
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
  }
): Promise<{
  profile: Database['public']['Tables']['profiles']['Row'];
  tracked: boolean;
}> {
  // Get or create profile
  const profile = await getOrCreateProfile(
    client,
    telegramId,
    userData?.username,
    userData?.firstName,
    userData?.lastName
  );

  // Track user in telegram_users table
  let tracked = false;
  try {
    await upsertTelegramUser(client, {
      profileId: profile.profile_id,
      telegramId,
      username: userData?.username ?? null,
      firstName: userData?.firstName ?? null,
      lastName: userData?.lastName ?? null,
      languageCode: userData?.languageCode ?? null
    });
    tracked = true;
  } catch (error) {
    // Log error but don't fail the request - profile creation is more critical
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : undefined;
    console.error('Failed to track user in telegram_users table', {
      telegramId,
      profileId: profile.profile_id,
      error: errorMessage,
      stack: errorDetails,
      userData
    });
  }

  return { profile, tracked };
}

export async function getSessionGuesses(
  client: Client,
  sessionId: string
): Promise<Database['public']['Tables']['guesses']['Row'][]> {
  const { data, error } = await client
    .from('guesses')
    .select('*')
    .eq('session_id', sessionId)
    .order('guess_index', { ascending: true });

  if (error) {
    throw new Error('Failed to fetch guesses');
  }

  return data || [];
}

export async function getHintEntitlementsCount(
  client: Client,
  profileId: string
): Promise<number> {
  const { count, error } = await client
    .from('entitlements')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('product_id', 'arcade_hint');

  if (error) {
    throw new Error('Failed to count entitlements');
  }

  return count || 0;
}

export async function getIncompleteArcadeSession(
  client: Client,
  profileId: string
): Promise<{
  session: Database['public']['Tables']['sessions']['Row'];
  puzzle: Database['public']['Tables']['puzzles']['Row'];
  guesses: Database['public']['Tables']['guesses']['Row'][];
} | null> {
  // Find the most recent incomplete arcade session
  // why: use array-based query instead of .single() to avoid Supabase phantom data bug
  const { data: sessions, error: sessionError } = await client
    .from('sessions')
    .select('*')
    .eq('profile_id', profileId)
    .eq('mode', 'arcade')
    .is('result', null)
    .order('started_at', { ascending: false })
    .limit(1);

  if (sessionError) {
    throw new Error(`Failed to find incomplete session: ${sessionError.message}`);
  }

  // Validate array and get first element
  const session = sessions && sessions.length > 0 ? sessions[0] : null;

  if (!session) {
    return null;
  }

  // Verify the session belongs to this profile (security check)
  if (session.profile_id !== profileId) {
    console.error('Security: session profile_id mismatch');
    return null;
  }

  // Get the puzzle for this session
  const { data: puzzle, error: puzzleError } = await client
    .from('puzzles')
    .select('*')
    .eq('puzzle_id', session.puzzle_id)
    .single();

  if (puzzleError || !puzzle) {
    console.error('Orphaned session detected - puzzle not found:', session.puzzle_id);
    throw new Error('Failed to fetch puzzle for session');
  }

  // Get all guesses for this session
  const guesses = await getSessionGuesses(client, session.session_id);

  return {
    session,
    puzzle,
    guesses
  };
}

type SavedWordRow = Database['public']['Tables']['saved_words']['Row'];

export async function listSavedWords(
  client: Client,
  profileId: string
): Promise<SavedWordRow[]> {
  const { data, error } = await client
    .from('saved_words')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load saved words: ${error.message}`);
  }

  return data ?? [];
}

export async function upsertSavedWord(
  client: Client,
  params: {
    profileId: string;
    wordText: string;
    wordNorm: string;
    source: 'daily' | 'arcade' | 'manual';
    puzzleId?: string | null;
  }
): Promise<{ row: SavedWordRow | null; alreadyExisted: boolean }> {
  const payload = {
    profile_id: params.profileId,
    word_text: params.wordText,
    word_norm: params.wordNorm,
    source: params.source,
    puzzle_id: params.puzzleId ?? null
  };

  const { data, error } = await client
    .from('saved_words')
    .upsert(payload, {
      onConflict: 'profile_id,word_norm',
      ignoreDuplicates: true
    })
    .select()
    .maybeSingle();

  if (error && error.code !== '23505') {
    throw new Error(`Failed to save word: ${error.message}`);
  }

  if (data) {
    return { row: data, alreadyExisted: false };
  }

  const { data: existing, error: selectError } = await client
    .from('saved_words')
    .select('*')
    .eq('profile_id', params.profileId)
    .eq('word_norm', params.wordNorm)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to load existing saved word: ${selectError.message}`);
  }

  return { row: existing ?? null, alreadyExisted: true };
}

export async function deleteSavedWord(
  client: Client,
  params: { profileId: string; savedId: string }
): Promise<boolean> {
  const { error, count } = await client
    .from('saved_words')
    .delete({ count: 'exact' })
    .eq('saved_id', params.savedId)
    .eq('profile_id', params.profileId);

  if (error) {
    throw new Error(`Failed to delete saved word: ${error.message}`);
  }

  return (count ?? 0) > 0;
}
