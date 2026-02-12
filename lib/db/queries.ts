import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './client';
import type { DailyLeaderboard, ShopCatalog } from '../contracts';

type Client = SupabaseClient<Database>;

export async function getTodayPuzzle(client: Client): Promise<{
  puzzle: Database['public']['Tables']['puzzles']['Row'];
  solution: Database['public']['Tables']['dictionary_words']['Row'];
}> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get today's daily puzzle
  const { data: puzzle, error: puzzleError } = await client
    .from('puzzles')
    .select(`
      *,
      dictionary_words!solution_word_id(*)
    `)
    .eq('mode', 'daily')
    .eq('date', today)
    .eq('status', 'published')
    .single();

  if (puzzleError || !puzzle) {
    throw new Error('Today\'s puzzle not found');
  }

  return {
    puzzle,
    solution: puzzle.dictionary_words as Database['public']['Tables']['dictionary_words']['Row']
  };
}

export async function upsertDailySession(
  client: Client,
  params: {
    profileId: string;
    puzzleId: string;
    hardMode?: boolean;
  }
): Promise<Database['public']['Tables']['sessions']['Row']> {
  console.log('🔍 Session Debug - Creating/updating session with params:', {
    profileId: params.profileId,
    puzzleId: params.puzzleId,
    hardMode: params.hardMode
  });

  // First, try to find existing session
  const { data: existing, error: findError } = await client
    .from('sessions')
    .select('*')
    .eq('profile_id', params.profileId)
    .eq('puzzle_id', params.puzzleId)
    .eq('mode', 'daily')
    .single();

  if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('❌ Session Debug - Error finding existing session:', findError);
    throw new Error(`Failed to find existing session: ${findError.message}`);
  }

  if (existing && !findError) {
    console.log('✅ Session Debug - Found existing session, updating:', existing);
    
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
      console.error('❌ Session Debug - Error updating session:', updateError);
      throw new Error(`Failed to update session: ${updateError.message}`);
    }

    console.log('✅ Session Debug - Session updated successfully:', updated);
    return updated;
  }

  console.log('🔍 Session Debug - No existing session found, creating new one...');

  // Create new session
  const sessionData = {
    profile_id: params.profileId,
    puzzle_id: params.puzzleId,
    mode: 'daily',
    hard_mode: params.hardMode || false,
    started_at: new Date().toISOString()
  };

  console.log('🔍 Session Debug - Session data to insert:', sessionData);

  const { data, error } = await client
    .from('sessions')
    .insert(sessionData)
    .select()
    .single();

  if (error) {
    console.error('❌ Session Debug - Database error:', error);
    console.error('❌ Session Debug - Error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    throw new Error(`Failed to create session: ${error.message}`);
  }

  if (!data) {
    console.error('❌ Session Debug - No data returned from insert');
    throw new Error('Failed to create session: No data returned');
  }

  console.log('✅ Session Debug - Session created successfully:', data);
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
    throw new Error('Failed to record guess');
  }

  return data;
}

export async function updateSessionResult(
  client: Client,
  sessionId: string,
  result: 'win' | 'lost' | 'abandon',
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
    throw new Error('Failed to update session result');
  }
}

export async function fetchDailyLeaderboard(
  client: Client,
  puzzleId: string
): Promise<DailyLeaderboard> {
  const { data, error } = await client
    .from('leaderboard_by_puzzle')
    .select('*')
    .eq('puzzle_id', puzzleId)
    .order('rank', { ascending: true })
    .limit(50);

  if (error) {
    throw new Error('Failed to fetch leaderboard');
  }

  return {
    puzzleId,
    asOf: new Date().toISOString(),
    entries: (data || []).map(entry => ({
      rank: entry.rank,
      userId: entry.profile_id,
      displayName: entry.username || 'Аноним',
      attempts: entry.attempts_used,
      timeMs: entry.time_ms || 0
    }))
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

export async function getOrCreateProfile(
  client: Client,
  telegramId: number,
  username?: string
): Promise<Database['public']['Tables']['profiles']['Row']> {
  console.log('🔍 Profile Debug - Getting/creating profile for:', {
    telegramId,
    username
  });

  // Try to find existing profile
  const { data: existing, error: findError } = await client
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('❌ Profile Debug - Error finding profile:', findError);
    throw new Error(`Failed to find profile: ${findError.message}`);
  }

  if (existing && !findError) {
    console.log('✅ Profile Debug - Found existing profile:', existing);
    return existing;
  }

  console.log('🔍 Profile Debug - Creating new profile...');

  // Create new profile
  const { data, error } = await client
    .from('profiles')
    .insert({
      telegram_id: telegramId,
      username: username || null
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Profile Debug - Error creating profile:', error);
    console.error('❌ Profile Debug - Error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    throw new Error(`Failed to create profile: ${error.message}`);
  }

  if (!data) {
    console.error('❌ Profile Debug - No data returned from profile creation');
    throw new Error('Failed to create profile: No data returned');
  }

  console.log('✅ Profile Debug - Profile created successfully:', data);
  return data;
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
