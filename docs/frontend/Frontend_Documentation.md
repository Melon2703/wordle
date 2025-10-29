# Frontend Documentation — Russian Word Puzzle (Telegram Mini App)

Next.js App Router frontend for the RU word puzzle Telegram Mini App. This doc explains the current screen map, shared UI, data flow, and the TypeScript contracts the backend must satisfy.

---

## 1. Scope & Principles

- Telegram-first shell that still works in a browser preview. All privileged flows rely on Telegram `initData`.
- Gameplay prioritises clarity: color tokens plus text/icons, haptics when available, and timers that never block input.
- Frontend pulls all state from backend APIs; no guesses are evaluated locally for the daily puzzle.

---

## 2. Tech Stack Snapshot

- **Framework:** Next.js 14 (App Router) with React 18.
- **State/query:** `@tanstack/react-query` for caching, mutations, and optimistic updates.
- **Telegram SDK:** core `@tma.js/sdk` (we call `init`, `invoice`, `popup`, `hapticFeedback` directly). No `@tma.js/sdk-react` hooks are in use.
- **Styling:** Tailwind CSS 3.x plus `lib/theme.css` tokens; utility classes live in `app/globals.css`.
- **Animation & icons:** `framer-motion` for loaders/celebrations, `lucide-react` for vector icons, `clsx` for deterministic class joins.
- **Local helpers:** custom `ToastCenter`, `ThemeBridge`, and `HapticsBridge` adapt Telegram runtime features to React components.

---

## 3. App Shell & Providers

### 3.1 Directory map (frontend slice)
```
app/
  layout.tsx        # Root shell: theme bridges, header, bottom nav, suspense fallback
  providers.tsx     # QueryClient + Telegram init + share deep-link handling
  page.tsx          # Home hub with mode cards, banners, and quick stats
  daily/page.tsx    # Daily puzzle experience
  arcade/page.tsx   # Arcade mode with hints / extra tries
  shop/page.tsx     # Stars shop (Telegram invoice flow)
  purchases/page.tsx# Purchase history and refunds
components/
  Banner.tsx, BottomNav.tsx, Header.tsx, ToastCenter.tsx
  PuzzleGrid/{index,GuessRow,Tile}.tsx, KeyboardCyr.tsx
  ResultScreen.tsx, ShareButton.tsx
  HintModal.tsx, ExtraTryModal.tsx, SettingsSheet.tsx, RulesSheet.tsx
  ThemeBridge.tsx, HapticsBridge.tsx, TopCenterIcon.tsx
lib/
  api.ts, contracts.ts, types.ts, game/*, deeplink.ts, theme.css
```

### 3.2 Root layout & wrappers
- `app/layout.tsx` registers the Inter font, injects the Telegram WebApp script, and wraps pages with:
  - `Providers` (React Query + Telegram init),
  - `ThemeBridge` (copies Telegram theme params into CSS vars),
  - `HapticsBridge` (stores a reference to `Telegram.WebApp.HapticFeedback`),
  - `Header` (top-layer settings/rules buttons),
  - `ToastCenter` (global toast portal),
  - `BottomNavWrapper` (hides the bottom nav on `/`, shows it elsewhere).
- All page content is rendered inside a React `Suspense` boundary with `LoadingFallback`.

### 3.3 Providers setup (`app/providers.tsx`)
- Creates a single `QueryClient` (stale time 30s, no refetch on focus).
- Calls `init({ acceptCustomStyles: true })` from `@tma.js/sdk` the first time the component mounts.
- After a short delay, inspects Telegram `start_param` to detect share deep links and redirects users into `/daily` or `/arcade`.

---

## 4. Screen Overview

- **Home (`app/page.tsx`):** Fetches `getUserStatus` and active banners, shows Daily/Arcade cards, streak, timers, and CTA badges. Prefetches the daily puzzle for a snappy entry and stores dismissed banners in `localStorage`.
- **Daily (`app/daily/page.tsx`):** Loads `getDailyPuzzle`, submits guesses via `submitDailyGuess`, updates cache optimistically, and renders `PuzzleGrid` + `KeyboardCyr`. On completion, shows `ResultScreen` and a `ShareButton`.
- **Arcade (`app/arcade/page.tsx`):** Orchestrates `startArcade`, hint usage, extra tries, session recovery, dictionary validation, and result sharing. Uses local evaluation for speed but still records guesses and completion to the backend.
- **Shop (`app/shop/page.tsx`):** Loads catalog (`getShopCatalog`) once Telegram `initData` is confirmed. Purchases call `purchaseProduct`, open the Telegram invoice URL with `invoice.openUrl`, and clean up cancelled purchases.
- **Purchases (`app/purchases/page.tsx`):** Lists prior purchases via `getUserPurchases`, allows refunds through `refundPurchase`, and surfaces invoice IDs. Relies on Telegram `popup`/`hapticFeedback` helpers when available.
- **Navigation visibility:** Shop tab and the settings icon only appear for tester Telegram ID `626033046`; the check runs twice (immediate + delayed) to accommodate slow SDK init.

---

## 5. Shared Components & Utilities

- `PuzzleGrid`, `GuessRow`, `Tile`: render attempt history, pending guesses, and final boards (ResultScreen scales the grid down for recaps).
- `KeyboardCyr`: Cyrillic keyboard with enter/delete controls, dynamic key colors, and optional disable states.
- `ResultScreen`: shows celebration, stats, shrunken grid, and streak/arcade solved counters.
- `ShareButton`: calls `/api/share/prepare`, then `Telegram.WebApp.shareMessage`, with fallbacks to open link or copy URL.
- `Banner`: announcement card with optional CTA, dismiss persistence, and reduced motion support.
- `ToastCenter`: lightweight toast context; used for errors, validations, mutations, and share feedback.
- `ThemeBridge`: copies Telegram theme params into `--tg-*` CSS variables so Tailwind classes can rely on them.
- `HapticsBridge` + `triggerHaptic`: centralised haptic feedback helpers (light/notification patterns).
- `TopRightIcons`, `SettingsSheet`, `RulesSheet`: local storage–backed preferences (high contrast, haptics toggle, timer visibility, “ё=е” normalization) and onboarding rules.
- `HintModal`, `ExtraTryModal`, `TopCenterIcon`: arcade-only overlays for hints and extra attempts.
- `LoadingFallback` & `PuzzleLoader`: animated placeholder grid while queries resolve.

---

## 6. Gameplay Flows

### 6.1 Daily mode (`app/daily/page.tsx`)
1. Query key `['puzzle','daily']` fetches `DailyPuzzlePayload`.
2. User guesses are collected locally, then `submitDailyGuess` is called. On success we patch cached puzzle state, invalidate the query, and trigger success/error haptics.
3. Keyboard state derives from accumulated feedback (`buildKeyboardState`).
4. Result view surfaces attempts, total time, streak, and answer (for losses) plus share CTA.
5. `getUserStatus` runs alongside to show streaks and time badges and to pre-compute countdowns on the home page.

### 6.2 Arcade mode (`app/arcade/page.tsx`)
1. Availability: `getArcadeStatus` exposes remaining `arcadeCredits` (0–3) alongside entitlements; the UI locks when credits reach zero. `unlockArcade` consumes an entitlement to restore the balance back to three.
2. Starting a game (`startArcade`) returns `sessionId`, solution, hint/extra-try entitlements, and hidden attempts (for bots or purchases).
3. Client caches dictionary words per length (`getDictionaryWords`) to validate guesses offline; normalization respects the “ё=е” toggle (still server-validated).
4. Guesses are evaluated client-side (`evaluateGuess`) for instant feedback, recorded through `/api/arcade/guess`, and queued in `pendingRecords` so server state stays consistent.
5. Hints trigger `callArcadeHint` and open the `HintModal`; extra tries call `/api/arcade/extra-try/use` and `/api/arcade/extra-try/finish`.
6. `checkArcadeSession` restores unfinished sessions on mount; `Finish` finalises games via `/api/arcade/complete`.
7. When a session ends we show `ResultScreen`, allow replay, and include an arcade share payload (with `arcadeSolved` from `getUserStatus`).

---

## 7. Commerce & Inventory Views

- `getShopCatalog` returns Stars products with badges. `handlePurchase` first creates a purchase (server returns `invoice_url`), then opens the invoice with `invoice.openUrl`. On cancel we call `cleanupCancelledPurchase`.
- `getUserPurchases` shows each historic purchase with status badges. `refundPurchase` integrates Telegram haptics (`hapticFeedback`) and falls back to browser `confirm` when Telegram popups are unavailable.

---

## 8. Banners & Home Badges

- `getActiveBanners` powers the promo/announcement section; dismissal is persisted to `localStorage` (`dismissed-banners` key) and filtered client-side.
- Countdown until the next daily puzzle updates every minute based on `userStatus.nextPuzzleAt`.
- Smart highlights: if streak is zero and status is `not_started`, the daily card gets a ring; if a new puzzle is <30 minutes away, we add urgency copy.

---

## 9. Data Contracts (see `lib/types.ts`)

```ts
export type LetterState = 'correct' | 'present' | 'absent';

export interface TileFeedback {
  index: number;
  letter: string;      // uppercase for UI
  state: LetterState;
}

export interface GuessLine {
  guess: string;
  feedback: TileFeedback[];
  submittedAt: string; // ISO timestamp
}

export interface DailyPuzzlePayload {
  puzzleId: string;
  mode: 'daily';
  length: 5;
  maxAttempts: 6;
  serverNow: string;
  opensAt: string;
  expiresAt: string;
  keyboard: 'ru';
  hardModeAvailable: boolean;
  answer?: string; // supplied once finished
  yourState: {
    status: 'playing' | 'won' | 'lost';
    attemptsUsed: number;
    lines: GuessLine[];
    timeMs?: number;
  };
}

export interface ArcadeStartResponse {
  puzzleId: string;
  sessionId: string;
  mode: 'arcade';
  length: 4 | 5 | 6;
  maxAttempts: number;
  serverNow: string;
  solution: string;
  hintsUsed: Array<{ letter: string; position: number }>;
  hintEntitlementsAvailable: number;
  extraTryEntitlementsAvailable: number;
  hiddenAttempts: GuessLine[];
}

export interface ArcadeGuessResponse {
  puzzleId: string;
  line: GuessLine;
  status: 'playing' | 'won' | 'lost';
  attemptsUsed: number;
}

export interface Product {
  id: string;
  type: 'ticket' | 'season_pass' | 'cosmetic' | 'analysis' | 'archive';
  title: string;
  subtitle?: string;
  priceStars: number;
  recurring?: 'monthly' | 'seasonal';
  badge?: 'new' | 'popular';
}
```

Keep backend contracts aligned with these interfaces; `lib/contracts.ts` re-exports them for API handlers and fixtures.

---

## 10. Query Keys & Cache Policy

- `['puzzle','daily']` — `staleTime` 30s; manual invalidation after each guess.
- `['user','status']` — reused across home/daily/arcade; stale for 30s.
- `['shop','catalog']` — gated until Telegram `initData` is present.
- `['purchases']` — invalidated after refunds or purchases.
- `['arcade','incomplete-session']` — restores sessions once per mount.
- `['arcade','status']` (implicit via `getArcadeStatus`) and hint/extra-try mutations invalidate relevant session state manually.

---

## 11. Settings, Accessibility & Haptics

- `SettingsSheet` persists preferences to `localStorage` (`wordle-settings`). High contrast toggles `document.documentElement.dataset.contrast`, which maps to overrides in `lib/theme.css`.
- Haptics: `KeyboardCyr` and mutation handlers route through `triggerHaptic`. When Telegram Haptics is unavailable the calls are no-ops.
- `RulesSheet` doubles as onboarding; once a user confirms, we set `wordle-onboarding-completed`.
- UI sizing targets ~44px touch areas. `Banner` and top buttons respect `prefers-reduced-motion`.

---

## 12. Share & Deep Links

- `ShareButton` prepares share payloads via `/api/share/prepare`, handing the resulting `preparedMessageId` to `Telegram.WebApp.shareMessage`. Fallbacks copy URLs or open Telegram share links.
- `lib/deeplink` detects `/start` parameters with a share payload. `Providers` decodes it and navigates users into the correct mode on load (`/daily` vs `/arcade`).

---

For backend expectations, cross-reference `docs/backend` (share payloads, arcade entitlement rules). Keep this document updated when new routes, settings, or SDK adjustments land.
