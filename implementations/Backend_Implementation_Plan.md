
# Backend Implementation Plan (v0) — Next.js on Vercel + Supabase

**Audience:** Cursor/Codex + backend devs  
**Goal:** Ship a reliable **first backend version** that powers the playable frontend: secure auth (Telegram init data), puzzle I/O, server‑side feedback, persistence, a basic leaderboard, dictionary loading, and scaffolds for Stars payments & nightly rollover.  
**Scope:** Backend only. Aligns with the contracts in `Frontend_Documentation.md`.

> Key refs: Next.js **Route Handlers** (App Router), runtimes (Edge vs Node), **Vercel Cron**, Telegram **Init Data** & **Stars**, **Supabase RLS & Storage**. citeturn0search10turn0search8turn0search1turn0search7turn0search3turn0search4turn0search14

---

## 0) Deliverables (v0 exit criteria)

- **Daily** endpoints: `GET /api/puzzle/daily`, `POST /api/puzzle/daily/guess` (server‑authored feedback; attempts/time persisted).
- **Arcade** skeleton: `POST /api/arcade/start`, `POST /api/arcade/guess` (no MMR formula yet; field reserved).
- **Dictionary**: loader from Supabase Storage (bucket) → in‑memory Sets; RU normalization; banned list respected.
- **Leaderboards**: `GET /api/leaderboard/daily` (attempts first; time as tiebreaker).
- **Auth**: request guard validates **Telegram init data** (HMAC). citeturn0search7
- **Jobs & webhooks**: `/api/cron/nightly` stub (Vercel Cron) and `/api/tg/webhook/<secret>` stub (Stars). citeturn0search1turn0search3
- **Security**: rate limiting on guesses; server keeps authoritative time.

---

## 1) Stack & packages

- **Next.js App Router** (Route Handlers in `app/api/**/route.ts`). citeturn0search10  
- **Runtimes**: Node for crypto/webhooks; Edge optional for fast reads. citeturn0search8  
- **Supabase**: `@supabase/supabase-js` (server client), Postgres with **RLS**, Storage for dictionary. citeturn0search4turn0search14  
- **Telegram auth**: `telegram-apps/init-data-node` (validate signed init data). citeturn0search17

---

## 2) Repository layout

```
app/
  api/
    puzzle/daily/route.ts
    puzzle/daily/guess/route.ts
    arcade/start/route.ts
    arcade/guess/route.ts
    dict/check/route.ts
    leaderboard/daily/route.ts
    shop/catalog/route.ts
    shop/purchase/route.ts
    tg/webhook/[secret]/route.ts
    cron/nightly/route.ts
lib/
  auth/validateInitData.ts
  db/client.ts
  db/queries.ts
  dict/loader.ts
  game/feedback.ts       # evaluate guess vs solution
  game/policies.ts       # RU orthography & hard-mode rules
  rate-limit.ts
  env.ts
  types.ts               # shared I/O types (mirrors frontend)
```

> Each handler exports HTTP methods per Next docs. citeturn0search10

---

## 3) Environment variables

```
BOT_TOKEN=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
WEBHOOK_SECRET_PATH=...         # suffix for /api/tg/webhook/<secret>
DICTIONARY_BUCKET=game-dictionary
DICTIONARY_URL=                 # optional CDN/signed base for Edge reads
```

- Store in Vercel Project Settings; available to serverless functions. citeturn0search16

---

## 4) Milestones & checklists

### M0 — Bootstrap & infra
- [ ] Add route handlers with **Node runtime** default; mark read‑only GETs as **Edge** if needed. citeturn0search8
- [ ] Supabase: create project; set **RLS ON** by default. citeturn0search4
- [ ] Create **Storage bucket** `${DICTIONARY_BUCKET}` and upload `/dictionary/ru/v1/...` assets. citeturn0search14
- [ ] Provision env vars on Vercel.

### M1 — Auth guard (Init Data)
- [ ] Implement `auth/validateInitData.ts` using `telegram-apps/init-data-node` (`validate`/`validate3rd`). citeturn0search17
- [ ] Add a small wrapper to extract `telegram_user_id` and cache the result per request.
- [ ] Reject if signature invalid or data expired. citeturn0search7

### M2 — DB schema (v0)
- [ ] Create `profiles`, `puzzles`, `sessions`, `guesses`, `leaderboard_by_puzzle` (MV), `products`, `purchases`, `entitlements` (see Backend_Documentation.md).  
- [ ] Add indexes: `(profile_id, puzzle_id)` unique (daily), `(puzzle_id)` on sessions, `(session_id, guess_index)` on guesses.
- [ ] RLS: owner‑only for user tables; public read for catalogs (policies). citeturn0search4

### M3 — Dictionary loader
- [ ] `dict/loader.ts`: fetch `meta.json`, `allowed/lenX.txt`, `answers/lenX_*.txt` from **Storage** (or `DICTIONARY_URL`) → build in‑memory Sets/arrays; hot‑reload on `version` change. citeturn0search14
- [ ] Normalization: uppercase, NFC; optional `Ё→Е` for **validation only**.

### M4 — Game logic
- [ ] `game/feedback.ts`: two‑pass duplicate handling (count letters; assign green then yellow).  
- [ ] `game/policies.ts`: enforce **hard mode** (reuse greens; respect yellow reposition), RU rules (ё/е; й/и distinct).

### M5 — Endpoints (I/O)

**`GET /api/puzzle/daily`** (Edge or Node)  
- Read today’s puzzle; find or create **session** on first valid guess; return player state.  
- Cache control: **swr** pattern; do not leak solution.  
- Align with **Route Handlers** API format. citeturn0search10

**`POST /api/puzzle/daily/guess`** (Node)  
- Validate auth, word (in allowed Set), hard‑mode constraints; compute feedback → insert into `guesses`; update `sessions` (attempts, time).  
- Return `{ line, status, attemptsUsed }`.

**Arcade**  
- `POST /api/arcade/start`: create `session` (mode=arcade), pick answer from `answers/lenN_arcade.txt`.  
- `POST /api/arcade/guess`: same as daily; on end reserve `mmrDelta` field (0 for v0).

**Dictionary**  
- `GET /api/dict/check?word=` → `{ valid }` by Set membership (no hints).

**Leaderboards**  
- `GET /api/leaderboard/daily` → rank wins by attempts, then time; page results.

### M6 — Payments (Stars) scaffolding
- [ ] `GET /api/shop/catalog` (static seed from DB).  
- [ ] `POST /api/shop/purchase` → create **Stars** invoice via **Bot Payments for digital goods**; return params for client to open Telegram sheet. citeturn0search3  
- [ ] `POST /api/tg/webhook/[secret]` (Node): handle `successful_payment` → set `purchases.status='paid'` and grant `entitlements` idempotently.
- Notes: Stars is for **digital goods** inside bots/mini apps. citeturn0search8

### M7 — Nightly rollover
- [ ] Vercel **Cron** → hits `/api/cron/nightly`. Configure in `vercel.json` or dashboard. citeturn0search1  
- [ ] Tasks: snapshot yesterday’s leaderboard, publish today’s daily, clean stale arcade sessions.
- [ ] Be mindful: cron invocations **don’t follow redirects**. citeturn0search11

### M8 — Security & Ops
- [ ] Rate limit guess mutations (IP+user) to deter brute forcing.  
- [ ] Log structured events (guess, finish, purchase).  
- [ ] Use Node runtime for crypto/webhooks/raw body. citeturn0search8

---

## 5) Pseudocode — guess evaluation

```ts
// Two-pass evaluation with duplicates
function evaluate(guess: string, answer: string): LetterState[] {
  const res = Array(answer.length).fill('absent') as LetterState[]
  const counts = new Map<string, number>()
  for (const ch of answer) counts.set(ch, (counts.get(ch) ?? 0) + 1)

  // First pass: greens
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) {
      res[i] = 'correct'
      counts.set(guess[i], counts.get(guess[i])! - 1)
    }
  }

  // Second pass: yellows
  for (let i = 0; i < answer.length; i++) {
    if (res[i] === 'correct') continue
    const left = counts.get(guess[i]) ?? 0
    if (left > 0) {
      res[i] = 'present'
      counts.set(guess[i], left - 1)
    }
  }
  return res
}
```

---

## 6) Testing plan

- **Unit**: `feedback.ts` (duplicates; ё/е normalization), `policies.ts` (hard mode).  
- **Integration**: auth guard → daily guess flow (create session, 2–3 guesses, win).  
- **Load**: dictionary Set membership QPS; leaderboard paging.  
- **Webhooks**: simulate `successful_payment` payload to ensure idempotent grants.

---

## 7) Deployment steps

1) Push repo; connect to **Vercel**; set env vars.  
2) Create **Supabase** project; run SQL migration (schema from DB doc); upload dictionary to **Storage**.  
3) Configure **Cron Job** in Vercel to `/api/cron/nightly`. citeturn0search1  
4) Set **telegram webhook** (Bot API) to `/api/tg/webhook/<secret>`.  
5) Verify **init data** validation with a real Mini App session. citeturn0search7

---

## 8) Appendix — handler templates

**Route Handlers signature** (Next.js) citeturn0search10
```ts
// app/api/puzzle/daily/route.ts
export async function GET(req: Request) { /* ... */ }
export async function POST(req: Request) { /* ... */ }
```

**Cron dev tip** (Vercel) — call the endpoint locally; note cron won’t follow redirects. citeturn0search6turn0search11

---

## 9) Risks & mitigations

| Risk | Mitigation |
|---|---|
| SDK/API drift | Keep to **official docs** for Route Handlers, Cron, and Telegram Mini Apps. citeturn0search10turn0search1turn0search7 |
| Data leakage (solution) | Store salted hash; compute feedback server‑side only. |
| Abuse on guesses | Rate limit + anomaly detection; server time authority. |
| Cron cold start | Keep handler small; avoid redirects; add logging. citeturn0search11 |
| RLS mistakes | Start with server‑only routes; expand to client reads with strict policies. citeturn0search4 |

---

**Notes for Cursor/Codex**  
- Start with `auth/validateInitData.ts` and `game/feedback.ts` — smallest surface for E2E tests.  
- Keep handlers thin; push logic into `lib/*`.  
- Prefer **Node** runtime until you confirm pure reads can be **Edge**. citeturn0search8
