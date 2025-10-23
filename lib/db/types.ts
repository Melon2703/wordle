// Database types matching the schema from migrations/001_initial_schema.sql
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          profile_id: string;
          telegram_id: number;
          username: string | null;
          locale: string;
          tz: string | null;
          colorblind_mode: boolean;
          haptics_on: boolean;
          streak_current: number;
          streak_max: number;
          last_daily_played_at: string | null;
          is_banned: boolean;
          ban_reason: string | null;
          ban_expires_at: string | null;
          created_at: string;
        };
        Insert: {
          profile_id?: string;
          telegram_id: number;
          username?: string | null;
          locale?: string;
          tz?: string | null;
          colorblind_mode?: boolean;
          haptics_on?: boolean;
          streak_current?: number;
          streak_max?: number;
          last_daily_played_at?: string | null;
          is_banned?: boolean;
          ban_reason?: string | null;
          ban_expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          telegram_id?: number;
          username?: string | null;
          locale?: string;
          tz?: string | null;
          colorblind_mode?: boolean;
          haptics_on?: boolean;
          streak_current?: number;
          streak_max?: number;
          last_daily_played_at?: string | null;
          is_banned?: boolean;
          ban_reason?: string | null;
          ban_expires_at?: string | null;
          created_at?: string;
        };
      };
      dictionary_words: {
        Row: {
          word_id: string;
          text: string;
          text_norm: string;
          len: number;
          is_solution: boolean;
          is_allowed_guess: boolean;
          flags: Record<string, unknown>;
          source: string;
          created_at: string;
        };
        Insert: {
          word_id?: string;
          text: string;
          text_norm: string;
          len: number;
          is_solution?: boolean;
          is_allowed_guess?: boolean;
          flags?: Record<string, unknown>;
          source?: string;
          created_at?: string;
        };
        Update: {
          word_id?: string;
          text?: string;
          text_norm?: string;
          len?: number;
          is_solution?: boolean;
          is_allowed_guess?: boolean;
          flags?: Record<string, unknown>;
          source?: string;
          created_at?: string;
        };
      };
      puzzles: {
        Row: {
          puzzle_id: string;
          mode: 'daily' | 'arcade';
          date: string | null;
          letters: number;
          solution_word_id: string | null;
          difficulty: number;
          ruleset_version: number;
          status: 'draft' | 'published' | 'retired';
          seed: string | null;
          created_at: string;
        };
        Insert: {
          puzzle_id?: string;
          mode: 'daily' | 'arcade';
          date?: string | null;
          letters: number;
          solution_word_id?: string | null;
          difficulty?: number;
          ruleset_version?: number;
          status?: 'draft' | 'published' | 'retired';
          seed?: string | null;
          created_at?: string;
        };
        Update: {
          puzzle_id?: string;
          mode?: 'daily' | 'arcade';
          date?: string | null;
          letters?: number;
          solution_word_id?: string | null;
          difficulty?: number;
          ruleset_version?: number;
          status?: 'draft' | 'published' | 'retired';
          seed?: string | null;
          created_at?: string;
        };
      };
      sessions: {
        Row: {
          session_id: string;
          profile_id: string;
          puzzle_id: string;
          mode: 'daily' | 'arcade';
          run_id: string | null;
          stage_index: number;
          started_at: string;
          ended_at: string | null;
          time_ms: number | null;
          result: 'win' | 'lose' | 'abandon' | null;
          attempts_used: number;
          hard_mode: boolean;
          client_build: string | null;
          initdata_hash: string | null;
          verified: boolean;
          suspicion: string[] | null;
          created_at: string;
        };
        Insert: {
          session_id?: string;
          profile_id: string;
          puzzle_id: string;
          mode: 'daily' | 'arcade';
          run_id?: string | null;
          stage_index?: number;
          started_at?: string;
          ended_at?: string | null;
          time_ms?: number | null;
          result?: 'win' | 'lose' | 'abandon' | null;
          attempts_used?: number;
          hard_mode?: boolean;
          client_build?: string | null;
          initdata_hash?: string | null;
          verified?: boolean;
          suspicion?: string[] | null;
          created_at?: string;
        };
        Update: {
          session_id?: string;
          profile_id?: string;
          puzzle_id?: string;
          mode?: 'daily' | 'arcade';
          run_id?: string | null;
          stage_index?: number;
          started_at?: string;
          ended_at?: string | null;
          time_ms?: number | null;
          result?: 'win' | 'lose' | 'abandon' | null;
          attempts_used?: number;
          hard_mode?: boolean;
          client_build?: string | null;
          initdata_hash?: string | null;
          verified?: boolean;
          suspicion?: string[] | null;
          created_at?: string;
        };
      };
      guesses: {
        Row: {
          guess_id: string;
          session_id: string;
          guess_index: number;
          text_input: string;
          text_norm: string;
          feedback_mask: string;
          created_at: string;
        };
        Insert: {
          guess_id?: string;
          session_id: string;
          guess_index: number;
          text_input: string;
          text_norm: string;
          feedback_mask: string;
          created_at?: string;
        };
        Update: {
          guess_id?: string;
          session_id?: string;
          guess_index?: number;
          text_input?: string;
          text_norm?: string;
          feedback_mask?: string;
          created_at?: string;
        };
      };
      products: {
        Row: {
          product_id: string;
          type: 'ticket' | 'season_pass' | 'cosmetic' | 'analysis' | 'archive';
          title_ru: string;
          description_ru: string | null;
          price_stars: number;
          recurring: 'monthly' | 'seasonal' | null;
          badge: 'new' | 'popular' | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          product_id: string;
          type: 'ticket' | 'season_pass' | 'cosmetic' | 'analysis' | 'archive';
          title_ru: string;
          description_ru?: string | null;
          price_stars: number;
          recurring?: 'monthly' | 'seasonal' | null;
          badge?: 'new' | 'popular' | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          product_id?: string;
          type?: 'ticket' | 'season_pass' | 'cosmetic' | 'analysis' | 'archive';
          title_ru?: string;
          description_ru?: string | null;
          price_stars?: number;
          recurring?: 'monthly' | 'seasonal' | null;
          badge?: 'new' | 'popular' | null;
          active?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      leaderboard_by_puzzle: {
        Row: {
          puzzle_id: string;
          profile_id: string;
          username: string | null;
          attempts_used: number;
          time_ms: number | null;
          rank: number;
        };
      };
    };
  };
}
