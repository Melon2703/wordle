# Backend Documentation — Russian Word Puzzle (Telegram Mini App)

Backend is implemented with Next.js App Router (Node runtime) and Supabase. It authenticates every request with Telegram init data, serves puzzle state, records gameplay, drives Telegram Stars purchases, and runs nightly maintenance. This document reflects the current code in `app/api/**`, `lib/**`, and Supabase helpers.

---

## 1. Architecture Snapshot

- **Runtime:** Next.js 14 Route Handlers on the **Node.js** runtime (needed for crypto, Supabase SDK, sharp, and Telegram Bot API).
- **Data layer:** Supabase Postgres accessed through the service-role key (`lib/db/client.ts`). Storage hosts dictionary wordlists and the rolling list of recently used daily answers.
- **Auth:** `lib/auth/validateInitData.ts` validates Telegram Mini App `initData` on every request. A local flag `USE_MOCK_AUTH` lets devs bypass the signature check.
- **Caching:** Domain-level caching is handled with React Query on the client. Server-side helpers cache environment variables (`lib/env.ts`) and dictionary sets (`lib/dict/loader.ts`) in-memory for the life of the function instance.
- **Rate limiting:** `lib/rate-limit.ts` throttles guess submissions to 8 requests per 10 seconds per user. This is an in-memory guard (per serverless instance).
- **Feature flags:** `TEMP_ARCADE_UNLIMITED` (env) skips arcade availability gating; intended for QA.

---

## 2. Environment & Security

Required env vars (`lib/env.ts`):
- `BOT_TOKEN` — Telegram Bot token (used for init data validation, invoices, refunds, inline messages).
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — service role credentials for database and Storage access.
- `WEBHOOK_SECRET_PATH` — secret segment for the Telegram webhook route.

Optional:
- `USE_MOCK_AUTH` — when `"true"`, the backend returns a hard-coded Telegram profile for local development.
- `TEMP_ARCADE_UNLIMITED` — when `"true"`, skips arcade availability checks.

`requireAuthContext(request)` returns `{ raw, parsed, userId }` and throws if validation fails. Most routes immediately call it to protect private data. When mock auth is enabled, the function logs a warning and issues the sample user profile.

All Route Handlers opt into `export const runtime = 'nodejs';`.

---

## 3. API Surface (Route Handlers)

### 3.1 Daily Puzzle
- `GET /api/puzzle/daily`  
  - Creates/fetches a Supabase `profiles` row, loads today’s published daily puzzle, looks up existing `sessions` and `guesses`, and returns a `DailyPuzzlePayload`. Supabase response is never cached; headers disable downstream caching.
- `POST /api/puzzle/daily/guess`  
  - Guards with rate limit, validates payload, normalises the guess (`normalizeGuess`), ensures dictionary membership (`loadDictionary`), enforces hard mode if requested, records the guess, and updates session status/time. Streak updates live on the `profiles` row.

### 3.2 Arcade Mode
- `POST /api/arcade/start`  
  - Accepts `length` ∈ {4,5,6}. Loads answer corpus from Storage, inserts a new `puzzles` row (mode `arcade`), and creates a `sessions` row (maxAttempts = `length + 1`). Returns `ArcadeStartResponse` including currently available hint/extra-try entitlements and normalised solution text.
- `POST /api/arcade/guess`  
  - Mirrors daily guess validation but enforces the arcade attempts cap, keeps hard mode status from the session, and writes the guess via `recordDailyGuess`. Returns `ArcadeGuessResponse` with updated attempts and status only.
- `POST /api/arcade/guess/record`  
  - Lightweight endpoint used by the client to persist locally evaluated guesses when latency-sensitive; stores guess rows and bumps attempts count.
- `POST /api/arcade/complete`  
  - Finalises the arcade session with the client-reported `result`, `attemptsUsed`, and `timeMs`.
- `GET /api/arcade/session`  
  - Restores the most recent incomplete arcade session (if any), returning session metadata, prior guesses, entitlements, and hidden attempts pushed by extra tries.
- `GET /api/arcade/status`  
  - Exposes `profiles.is_arcade_available` plus the count of `arcade_new_game` entitlements.
- `POST /api/arcade/unlock`  
  - Consumes an `arcade_new_game` entitlement and flips `is_arcade_available` to `true`.
- `POST /api/arcade/hint`  
  - Consumes one `arcade_hint` entitlement, reveals a random unrevealed letter, persists the hint array on the session, and returns remaining entitlements.
- `POST /api/arcade/extra-try/use`  
  - Consumes an `arcade_extra_try` entitlement, deletes the most recent guess, appends the failed attempt to `sessions.hidden_attempts`, and decrements `attempts_used`.
- `POST /api/arcade/extra-try/finish`  
  - Clears `hidden_attempts`, marks the session as a loss, and seals it.

### 3.3 Shared Utilities
- `GET /api/user/status`  
  - Aggregates today’s daily state (status/attempts/time), streak, next puzzle timestamp (UTC midnight rollover), and total arcade wins.
- `GET /api/banners`  
  - Returns static in-memory banner definitions after auth. Currently filtered by expiry only.
- `GET /api/dict/check?word=`  
  - Boolean lookup against the cached dictionary set.
- `GET /api/dict/words?length=`  
  - Returns the allowed word set for the requested length (4/5/6/7). Used by arcade UI for client-side validation.

### 3.4 Shop, Purchases, and Entitlements
- `GET /api/shop/catalog`  
  - Authenticated fetch of the `products` table; caches for 5 minutes (stale-while-revalidate 10 minutes).
- `POST /api/shop/purchase` `{ productId }`  
  - Creates a `purchases` row (status `pending`), hits `createInvoiceLink` on the Telegram Bot API with the purchase payload, saves the invoice URL, and returns `{ ok, purchase_id, invoice_url, stars_amount }`.
- `GET /api/purchases`  
  - Lists a user’s purchases with joined product metadata.
- `POST /api/purchases/:purchaseId/refund`  
  - Calls Telegram `refundStarPayment` when `telegram_payment_charge_id` is present, then updates the purchase status to `refunded`.
- `DELETE /api/purchases/:purchaseId/cleanup`  
  - Deletes pending purchases the user cancelled (used after an aborted invoice).
- `POST /api/tg/webhook/<secret>`  
  - Processes Telegram Bot webhook payloads; expects path segment equal to `WEBHOOK_SECRET_PATH`. Current logic handles:
    - `successful_payment`: mark purchase as paid, persist charge IDs, and upsert a matching entitlement.
    - `pre_checkout_query`: approves Stars payments (all valid payloads return `ok: true`).

### 3.5 Sharing
- `POST /api/share/prepare`  
  - Validates auth, prepares a PNG scorecard via `/api/share/card`, builds a Telegram deep-link payload, and calls `savePreparedInlineMessage`. Responds with `{ preparedMessageId }` for `Telegram.WebApp.shareMessage`.
- `GET /api/share/card`  
  - Renders a minimalist grid PNG (800×418) with sharpened tiles using `sharp`. Supports optional `lines` payload for exact tile colours.

### 3.6 Cron & Maintenance
- `GET /api/cron/nightly`  
  - Intended for Vercel Cron. Requires `VERCEL_CRON_SECRET` env to be present (note: current implementation only checks existence, not request headers). Workflow:
    1. Ensure tomorrow’s daily puzzle exists (create from Storage word list if missing).
    2. Maintain the “used words” list in Storage to avoid repeats; resets cycle if exhausted.
    3. Reset `profiles.is_arcade_available` to `true` for all users.

---

## 4. Game Logic Internals

- **Feedback:** `lib/game/feedback.ts` evaluates guesses server-side, enforcing duplicate letter rules via a two-pass occurrence counter. The same function powers arcade guess validation.
- **Normalisation & hard mode:** `lib/game/policies.ts` houses `normalizeGuess` (handles optional Ё→Е substitution) and `validateHardMode` (ensures revealed greens stay fixed and yellows are reused).
- **Dictionary:** `lib/dict/loader.ts` downloads three text files from Supabase Storage (allowed guesses, valid answers, and the running “used words” list). Results are cached per instance; helper `resetDictionary()` clears the cache for tests. Storage updates go through `updateUsedWords`.
- **Rate limit keys:** prefixed with `daily-guess:` / `arcade-guess:` per Telegram user ID.

---

## 5. Data Model (Supabase)

The generated types in `lib/db/types.ts` map 1:1 to Supabase tables. Key entities:

- **profiles**
  - Primary key: `profile_id` (UUID). Stores Telegram identifiers, streak metrics, high-contrast settings, and arcade availability. Updated via `getOrCreateProfile`.
- **puzzles**
  - Columns: `mode` (`daily`/`arcade`), `date` (for daily), `letters`, `solution_text`, `solution_norm`, `status`, `seed`. Cron inserts new daily puzzles; arcade start inserts ad-hoc rows.
- **sessions**
  - Links `profile_id` ↔ `puzzle_id`, tracks attempts, result, timings, `hard_mode`, `hints_used`, and `hidden_attempts` (for extra tries). Inserted/updated from the daily and arcade handlers.
- **guesses**
  - Stores each guess with `text_input`, `text_norm`, and `feedback_mask` JSON string. Ordered by `guess_index`.
- **products**
  - Stars catalog. Fields include `type`, RU titles/descriptions, price, optional recurring cadence, and badge.
- **purchases**
  - Stars transactions with status (`pending` → `paid` → `refunded`), invoice payloads, and charge IDs. Webhook updates these rows.
- **entitlements**
  - Inventory/ownership per profile (`arcade_hint`, `arcade_extra_try`, `arcade_new_game`, etc.). Refund and webhook flows both modify this table.

### Storage Assets
- **Wordlists bucket:**  
  - `ru/v1/for-guesses.txt` — allowed guess words (lowercase).  
  - `ru/v1/for-puzzles.txt` — answer corpus.  
  - `ru/v1/daily-used-words.txt` — maintained list of prior daily answers.  
  All files are fetched over HTTPS; responses are cached with `next: { revalidate: ... }`.

---

## 6. Operational Notes

- **Logging:** Route Handlers log warnings for Supabase table absence (useful while migrations are in flux) and errors around purchases, streak updates, and cron jobs. Webhook, refund, and cleanup routes include verbose debug output.
- **Idempotency:** Purchase, refund, hint, and extra-try routes guard against duplicate processing by checking existing session state and consumption counts before mutating.
- **Testing hooks:** `USE_MOCK_AUTH` + `TEMP_ARCADE_UNLIMITED` make it possible to test flows locally without Telegram or gating.
- **Limitations:** Rate limiting is per-instance (no shared store). The cron route currently only checks that `VERCEL_CRON_SECRET` is set; consider validating request headers in production.

Keep this file in sync when adding routes, new entitlements, or altering Supabase schema so frontend and ops references stay aligned.
