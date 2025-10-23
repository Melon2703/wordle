
# AGENTS.md — Rules for Coding Agents (Cursor/Codex)

> Single source of truth for how agents should work on this repo. Keep it concise, actionable, and updated with the codebase. **Do not duplicate docs**; link to `/docs/**` and `/contracts/**` instead.

## TL;DR
- **Read first:** always consult `/docs/**` before writing code. If something is unclear, propose a short clarification to `/docs` in your output (as a patch), but **do not commit**.
- **Minimal, safe diffs:** plan changes, explain the rationale, and keep edits small.
- **Self‑check:** after writing code, run **typecheck → lint** and do a quick manual sanity review.
- **Explain complexity:** whenever code is non‑obvious, add a brief `// why:` comment *next to it*.
- **Security & fairness:** validate Telegram Mini App init data on server; follow fairness/accessibility guardrails.

---

## Project scope (one‑liner)
Russian letter‑puzzle Telegram Mini App with **Daily** (shared puzzle, streaks, rating) and **Arcade** (unlimited) modes; payments via **Telegram Stars**; Next.js + Supabase (Postgres + RLS). See `/docs/general/Product_Spec.md` for behavior and `/docs/**` for implementation notes.

---

## How to run / common commands (npm)
> Prefer **npm**. If a script is missing, propose the `package.json` patch in your output (do **not** commit).

- **Install:** `npm install`
- **Dev server:** `npm run dev`
- **Build:** `npm run build`
- **Typecheck:** `npm run typecheck` (tsc `--noEmit --pretty`)
- **Lint + fix:** `npm run lint` / `npm run format`

**Before you say a task is done, run:** `npm run typecheck && npm run lint`

---

## Source‑of‑truth files (read, don’t duplicate)
- `/docs/general/Product_Spec.md` — product rules, scoring, economy, accessibility.
- `/docs/general/User_Flow.md` — user states, copy, edge cases.
- `/docs/frontend/Frontend_Documentation.md` — component map, FE contracts expected from backend.
- `/docs/backend/Backend_Documentation.md` — APIs, webhooks, DB overview.
- `/contracts/backend_contract.yaml` — backend OpenAPI contract (contract‑first; FE types derive from this).

**Rule:** If you rely on any rule from these docs, **link the exact file/section** in a comment above the relevant function.

---

## Golden rules for this codebase
1. **No duplication of spec**: never restate `/docs` content inside code; link to it.
2. **Human‑readable code**: expressive names, small pure functions; add `// why:` for non‑obvious logic.
3. **RU orthography**: handle `ё/е`, `й/и`, and soft/hard signs per Product Spec; duplicates use occurrence counts.
4. **Fairness**: Attempts > time for rankings; server measures time; purchases must not affect Daily fairness.
5. **Accessibility**: icon + color feedback, sufficient contrast, large touch targets; respect Mini App theme params.
6. **Security**: validate Telegram init data (HMAC‑SHA256) on the server; reject `initDataUnsafe` in business logic.
7. **RLS first**: any user‑owned table must have Row‑Level Security; leaderboards derive from session data.
8. **Payments**: for **digital goods only** via Telegram Stars; grant entitlements idempotently on webhook.
9. **IP guardrails**: do not use NYT brand, assets, or word lists.
10. **Performance**: avoid heavy bundles; keep API handlers fast; cache safe read‑only endpoints.

---

## Implementation checklist (use for every task)
1) **Locate context** in `/docs/**` and the relevant code files.
2) **Plan minimal changes** (list impacted files and a brief why).
3) **Implement** with small, clear functions; add `// why:` comments where needed.
4) **Self‑check**: run `npm run typecheck && npm run lint`; do a quick manual smoke test in dev.
5) **Output**: provide a short summary of changes + any proposed doc updates as a patch (no commits).

---

## Conventions
- **Language:** TypeScript strict; React (Next.js) app structure.
- **Style:** ESLint + Prettier; avoid magic numbers; extract named constants.
- **Errors:** domain‑specific errors; do not surface internal stacks to clients.
- **Logging:** structured logs (`level, event, context`); avoid PII; rely on platform logs for handlers.
- **Env config:** read from `process.env` only on server; define required keys in `.env.example`.
- **i18n:** RU primary, EN fallback; keep UI strings in locale files.

---

## Frontend rules (Next.js + Telegram Mini Apps)
- **Contracts:** mirror response/request types to `/contracts/backend_contract.yaml`; do not invent fields.
- **Caching/state:** keep fetches deduped; avoid refetch storms; use stable query keys if using a data lib.
- **Accessibility:** color + icon feedback; focus management; touch targets ≥44 pt.
- **Keyboard:** Cyrillic input; support desktop physical keyboard where allowed.
- **Flags:** keep input toggles (e.g., `ё = е`) consistent with spec.

---

## Backend rules (API routes + Supabase)
- **Runtime:** use Node runtime for webhooks/crypto.
- **Telegram auth:** verify `initData` HMAC on each request at the server; do not trust `initDataUnsafe`.
- **Game logic:** server computes tile feedback/timing; store any derived masks if needed for efficient reads.
- **Payments:** create Stars invoices for **digital goods**; consume successful payment webhook; grant entitlements idempotently; purchases never affect puzzle difficulty or ratings.
- **RLS & access:** owner‑only access for user data; public read only for safe catalogs.

---

## Security checklist (for any server change)
- Validate all inputs (length/encoding for guesses, enums, IDs).
- Implement and test HMAC verification of Telegram Mini App `initData` on the server.
- Webhook path should include a secret suffix; handle raw body if required; operations idempotent.
- Secrets in env vars; never log tokens or PII.
- RLS enforced for all user‑owned tables.

---

## When to ask / create clarifying docs
- If `/docs` lacks an answer, include a proposed addition in your output (as a small patch diff).
- For conflicting requirements, prefer **Product_Spec.md** and **User_Flow.md**; call out conflicts in your output.

---

## Done definition (per task)
- Typecheck & lint pass.
- Non‑obvious parts have `// why:` comments.
- No secrets/PII leakage; fairness, accessibility, and RU orthography preserved.
- If behavior changed, include a proposed `/docs` patch in your output.
