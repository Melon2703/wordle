# Backend Documentation — Russian Word Puzzle (Telegram Mini App)

**TL;DR:** The backend is **Next.js (App Router) on Vercel** with **Supabase (Postgres + RLS + Storage)**. It validates **Telegram init data**, serves puzzle state, computes feedback server‑side, stores results, runs **nightly rollovers** with Vercel Cron, and fulfills **Telegram Stars** purchases via a **webhook**. This doc is split into two parts: **Server** and **Database** and is aligned with the frontend contracts defined in `Frontend_Documentation.md`.

---

## Part A — Server (Next.js on Vercel)

### A.1 Responsibilities
- **Auth:** Verify Telegram **init data** (HMAC‑SHA256) from the Mini App; never trust `initDataUnsafe`. citeturn0search10
- **Game logic:** Validate guesses, apply RU rules/duplicates, compute tile feedback; attempts/time measured on the server.
- **APIs:** Route Handlers under `app/api/**/route.ts` expose endpoints used by the frontend. citeturn0search0
- **Payments:** Create **Stars** invoices for digital goods; handle payment confirmations on a **webhook**. citeturn0search3
- **Scheduling:** Run **nightly rollovers** with Vercel Cron (HTTP GET to your route; known UA). citeturn0search1
- **Performance:** Use **Node runtime** for mutations/webhooks; **Edge** only for simple reads. citeturn0search8turn0search15

### A.2 Endpoints (I/O aligned with frontend)
**Daily**
- `GET /api/puzzle/daily` → `DailyPuzzlePayload` (cache until `expiresAt`).
- `POST /api/puzzle/daily/guess` `{ puzzleId, guess, hardMode? }` → `{ line, status: 'playing'|'won'|'lost', attemptsUsed }`.

**Arcade**
- `POST /api/arcade/start` `{ length: 4|5|6|7, hardMode }` → `ArcadeStartResponse`.
- `POST /api/arcade/guess` `{ puzzleId, guess }` → Daily‑like result; on final state: `{ mmrDelta }`.

**Dictionary**
- `GET /api/dict/check?word=СТРОКА` → `{ valid: boolean }` (no hints, no solution leakage).

**Leaderboards**
- `GET /api/leaderboard/daily?puzzleId=...` → `DailyLeaderboard` (attempts first; time as tiebreaker).

**Shop (Stars, digital goods)**
- `GET /api/shop/catalog` → `ShopCatalog` (tickets, season pass, cosmetics, analysis, archive).
- `POST /api/shop/purchase` `{ productId }` → creates Stars invoice and returns UI params (fulfillment via webhook). citeturn0search3

**Webhooks & Jobs**
- `POST /api/tg/webhook/<SECRET>` → Telegram **Bot** updates (`successful_payment` etc.). Use Node runtime and raw body if provider requires signature validation. citeturn0search11turn0search21  
- `GET /api/cron/nightly` → rollover daily, snapshot leaderboard; triggered by Vercel Cron (HTTP GET; `vercel-cron/1.0` UA). citeturn0search1

> **Note:** Route Handlers are the App Router way to implement APIs inside Next.js. Choose **Node** for crypto/webhooks and **Edge** for read‑only low‑latency endpoints. citeturn0search0turn0search8turn0search15

### A.3 Auth & Security
- **Validate init data** from `tgWebAppData` each request using **HMAC‑SHA256** with the bot token per Telegram guidance; reject `initDataUnsafe` as untrusted. citeturn0search10
- **Secrets:** `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WEBHOOK_SECRET_PATH` stored as Vercel env vars; functions can read them at runtime. citeturn0search16
- **Rate limiting:** throttle guess submissions per user/IP; soft‑lock on unusual typing speeds.
- **Anti‑cheat flags:** mark suspicious sessions (impossible timings, repeated abandon/retake).

### A.4 Payments (Telegram Stars)
- **Create invoice** via Telegram **Bot Payments for Digital Goods**; user pays with Stars balance. The webhook receives `successful_payment`, after which you grant entitlements (tickets/pass/cosmetics). citeturn0search3
- **Webhook security:** keep a secret path (e.g., `/api/tg/webhook/<SECRET>`); optionally validate sources; manage retries idempotently. citeturn0search11
- **Digital goods only:** this flow is designed for digital goods/services (not physical items). citeturn0search3

### A.5 Scheduling & Rollover
- Use **Vercel Cron Jobs**: Vercel performs an **HTTP GET** to the path you define; jobs show as normal function invocations and include a dedicated user‑agent. citeturn0search1turn0search9
- Nightly tasks: 1) close yesterday’s daily, 2) snapshot leaderboard, 3) open next daily, 4) clean stale arcade sessions.

### A.6 Runtime & Body Parsing
- **Node vs Edge:** Edge is fast but limited APIs; Node is default and supports crypto, raw body, SDKs. citeturn0search8turn0search15
- **Raw body for webhooks:** some providers require raw body for signature verification; disable parsing and read the raw stream in Node runtime. citeturn0search21turn0search7

### A.7 Observability & Ops
- Structured logs for guesses, results, payments; Vercel dashboard shows function logs (including cron‑invoked). citeturn0search9
- Metrics tables (simple counters) in Supabase; alarms on webhook failures or high 5xx rates.

### A.8 Environment Variables (server)
```
BOT_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_KEY
WEBHOOK_SECRET_PATH      # e.g., random suffix for /api/tg/webhook/<SECRET>
DICTIONARY_BUCKET        # Supabase Storage bucket name for wordlists
DICTIONARY_URL           # optional CDN/signed URL base for dictionary assets
```

---

## Part B — Database (Supabase / Postgres)

### B.1 Principles
- **Single source of truth**: session outcome lives in `sessions`; leaderboards are derived (materialized view or query).  
- **RLS on by default** for user‑owned tables (owner can read/write), public read only for catalogs (dictionary, puzzles, products). citeturn0search4  
- **Orthography**: store UI text, and a normalized form for validation; duplicates handled in feedback logic.
- **Performance**: index hot paths; pre‑aggregate leaderboard; keep server‑measured time.

### B.2 Minimal Schema (updated)
> This updates the initial draft with a leaner, production‑oriented set. All timestamps are UTC (`timestamptz`).

**profiles** — player identity & prefs (RLS: owner)
- `profile_id uuid pk`, `telegram_id bigint unique not null`  
- `username text`, `locale text default 'ru'`, `tz text`  
- `colorblind_mode bool`, `haptics_on bool`  
- `streak_current int`, `streak_max int`, `last_daily_played_at timestamptz`  
- `is_banned bool`, `ban_reason text`, `ban_expires_at timestamptz`  
- `created_at timestamptz default now()`

**dictionary_words** — lexicon (public select; writes by service role)  
- `word_id uuid pk`, `text text`, `text_norm text not null`, `len smallint`  
- `is_solution bool`, `is_allowed_guess bool`  
- `flags jsonb`, `source text`  
- **Indexes:** `unique(text_norm)`, `len`

**puzzles** — daily & arcade targets (public select)  
- `puzzle_id uuid pk`, `mode enum('daily','arcade')`, `date date`, `letters smallint`  
- `solution_word_id uuid → dictionary_words`, `difficulty smallint`, `ruleset_version smallint`  
- `status enum('draft','published','retired')`, `seed text`  
- **Constraint:** unique `(date, letters)` where `mode='daily' and status='published'`

**sessions** — one per player×puzzle (RLS: owner)  
- `session_id uuid pk`, `profile_id → profiles`, `puzzle_id → puzzles`, `mode enum`  
- `run_id uuid nullable` (arcade parent), `stage_index smallint`  
- `started_at timestamptz`, `ended_at timestamptz`, `time_ms int`  
- `result enum('win','lose','abandon')`, `attempts_used smallint`  
- `hard_mode bool`, `client_build text`, `initdata_hash text`, `verified bool`, `suspicion text[]`  
- **Indexes:** unique `(profile_id, puzzle_id)` where `mode='daily'`; `(puzzle_id)`; `(result, attempts_used, time_ms)`

**guesses** — ordered lines (RLS: owner)  
- `guess_id uuid pk`, `session_id → sessions`, `guess_index smallint >=1`  
- `text_input text`, `text_norm text`, `feedback_mask text`, `created_at timestamptz`  
- **Indexes:** unique `(session_id, guess_index)`; index `(session_id)`

**arcade_runs** — arcade container (RLS: owner)  
- `run_id uuid pk`, `profile_id → profiles`, `started_at`, `finished_at`, `status enum('active','complete')`  
- `lives_remaining smallint`, `score_total int`  
- **Index:** `(profile_id, status)`

**products** — Stars catalog (public select)  
- `product_id text pk`, `type enum('ticket','season_pass','cosmetic','analysis','archive')`  
- `title_ru text`, `description_ru text`, `price_stars int`, `recurring enum(null,'monthly','seasonal')`  
- `badge enum(null,'new','popular')`, `active bool`, `created_at`

**purchases** — Stars receipts (RLS: owner)  
- `purchase_id uuid pk`, `profile_id → profiles`, `product_id → products`  
- `status enum('pending','paid','failed','refunded')`, `stars_amount int`, `provider_payload jsonb`, `created_at`  
- **Indexes:** `(profile_id, status)`, `(product_id)`

**entitlements** — inventory (RLS: owner)  
- `entitlement_id uuid pk`, `profile_id → profiles`, `product_id → products`, `is_equipped bool`, `granted_at`  
- **Constraint:** unique `(profile_id, product_id)`

**leaderboard_by_puzzle** — materialized view (public select)  
- Derived from `sessions` where `result='win'`, ranked by attempts then time.

> Storage: **Supabase Storage** bucket for dictionary assets (private by default or CDN with signed URLs). citeturn0search12turn0search5turn0search19

### B.3 RLS Patterns
- Owner tables (`profiles`, `sessions`, `guesses`, `arcade_runs`, `purchases`, `entitlements`): **enable RLS** and allow `select/insert/update` only where `profile_id` equals the JWT claim. citeturn0search4
- Catalog tables (`dictionary_words`, `puzzles`, `products`, `leaderboard_by_puzzle`): public `select` (or `select using (true)`), writes by service role only.

### B.4 Indexing & Performance
- `sessions (profile_id, puzzle_id)` unique (daily)  
- `sessions (puzzle_id)`, `(result, attempts_used, time_ms)`  
- `guesses (session_id, guess_index)`  
- `dictionary_words (text_norm)` unique, `(len)`  
- `leaderboard_by_puzzle (puzzle_id, rank)` (MV index)  
- Store `feedback_mask` to avoid recomputation on reads.

### B.5 Dictionary strategy (Storage + cache)
- Keep wordlists in **Supabase Storage** (`DICTIONARY_BUCKET`), private by default; optional **`DICTIONARY_URL`** for CDN/signed access (Edge‑friendly). citeturn0search12turn0search5  
- Server loads `meta.json` + `allowed/lenX.txt` + `answers/*` on cold start/first hit, builds in‑memory Sets, and hot‑reloads on version change.

### B.6 Data flows (typical)

**Daily**
1) Fetch today’s published `puzzle`; first valid guess creates `session`.  
2) Each guess inserts into `guesses` with `feedback_mask`; server updates session attempts/time.  
3) On completion, seal `session` with `result`, `attempts_used`, `time_ms`. Leaderboard view ranks wins.

**Arcade**
1) Create `arcade_runs` on start; each stage is a `session` linked via `run_id`.  
2) Update `score_total` and lives; compute `mmr_delta` if you add rating later.

**Economy**
1) Show `products` catalog.  
2) On Stars webhook `successful_payment`, set `purchases.status='paid'` and grant `entitlements` (idempotent). citeturn0search3

### B.7 Governance & Ops
- **Migrations:** keep SQL migrations in repo; use Supabase CLI.
- **Backfills:** leaderboard MV can be dropped/rebuilt; `sessions` is authoritative.
- **Data quality:** maintain banned list; normalize RU input for `text_norm`.

---

## References
- **Next.js Route Handlers (App Router)** — APIs for server routes. citeturn0search0  
- **Next.js runtimes (Edge vs Node)** — capabilities & trade‑offs. citeturn0search8turn0search15  
- **Vercel Functions** — serverless functions on Vercel. citeturn0search16  
- **Vercel Cron Jobs** — HTTP GET triggering & logs. citeturn0search1turn0search9  
- **Telegram Mini Apps init data** — validate `initData` and don’t trust `initDataUnsafe`. citeturn0search10  
- **Telegram Stars (digital goods)** — Bot Payments for digital goods. citeturn0search3  
- **Supabase Row‑Level Security** — enable RLS on exposed tables. citeturn0search4  
- **Supabase Storage** — buckets (public/private), CDN, and creation. citeturn0search12turn0search5turn0search19
