import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './client';
import type { DailyLeaderboard, ShopCatalog } from '../contracts';

type Client = SupabaseClient<Database>;

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
    console.error('Failed to record guess:', {
      error: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      params
    });
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
    console.error('Failed to record arcade guess:', {
      error: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      params
    });
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
    console.error('Failed to update session result:', {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      sessionId,
      result,
      attemptsUsed,
      timeMs
    });
    throw new Error('Failed to update session result');
  }
}

export async function fetchDailyLeaderboard(
  client: Client,
  puzzleId: string
): Promise<DailyLeaderboard> {
  // Query sessions table directly with profile join
  const { data, error } = await client
    .from('sessions')
    .select(`
      profile_id,
      attempts_used,
      time_ms,
      profiles!inner(telegram_id, username, first_name)
    `)
    .eq('puzzle_id', puzzleId)
    .eq('result', 'win')
    .not('time_ms', 'is', null)
    .order('time_ms', { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(`Failed to fetch leaderboard: ${error.message}`);
  }

  const entries = (data || []).map((session, index) => {
    const profile = session.profiles as Database['public']['Tables']['profiles']['Row'];
    
    // Build display name: @username if available, else first_name, else "Аноним"
    let displayName = 'Аноним';
    let profileUrl: string | undefined;
    
    if (profile.username) {
      displayName = `@${profile.username}`;
      // Only set profileUrl if username exists (username-based links work; ID-based don't)
      profileUrl = `https://t.me/${profile.username}`;
    } else if (profile.first_name) {
      displayName = profile.first_name;
      // No profileUrl for users without username (not clickable)
    }
    
    return {
      rank: index + 1,
      userId: session.profile_id,
      displayName,
      attempts: session.attempts_used,
      timeMs: session.time_ms || 0,
      profileUrl
    };
  });

  return {
    puzzleId,
    asOf: new Date().toISOString(),
    entries
  };
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

  return {
    asOf: new Date().toISOString(),
    products: (data || []).map(product => ({
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
      console.error('Error calling Telegram refund API:', error);
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
      last_name: lastName || null
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

export async function getSessionGuesses(
  client: Client,
  sessionId: string
): Promise<Database['public']['Tables']['guesses']['Row'][]> {
  console.log('🔍 getSessionGuesses called with session_id:', sessionId);
  
  const { data, error } = await client
    .from('guesses')
    .select('*')
    .eq('session_id', sessionId)
    .order('guess_index', { ascending: true });

  console.log('📊 getSessionGuesses result:', {
    sessionId,
    count: data?.length || 0,
    hasError: !!error,
    error: error
  });

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
  const { data: session, error: sessionError } = await client
    .from('sessions')
    .select('*')
    .eq('profile_id', profileId)
    .eq('mode', 'arcade')
    .is('result', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (sessionError && sessionError.code !== 'PGRST116') {
    throw new Error(`Failed to find incomplete session: ${sessionError.message}`);
  }

  if (!session) {
    return null;
  }

  // Get the puzzle for this session
  const { data: puzzle, error: puzzleError } = await client
    .from('puzzles')
    .select('*')
    .eq('puzzle_id', session.puzzle_id)
    .single();

  if (puzzleError || !puzzle) {
    throw new Error('Failed to fetch puzzle for session');
  }

  // Get all guesses for this session (use the working function)
  const guesses = await getSessionGuesses(client, session.session_id);

  return {
    session,
    puzzle,
    guesses
  };
}
