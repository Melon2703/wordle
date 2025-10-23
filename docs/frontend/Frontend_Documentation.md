# Frontend Documentation — Russian Word Puzzle (Telegram Mini App)

**TL;DR:** Next.js (App Router) frontend wired to **TMA.js React SDK**, **TanStack Query**, **Tailwind v4**, **Telegram UI kit**, **shadcn/ui**, **Framer Motion**, and **lucide-react**. Gameplay mirrors a grid+keyboard word puzzle with a soft pastel light theme, rounded tiles/keys, and accessibility-first feedback (icons + color). This file defines the **screen/component map**, **providers**, **UX rules**, and **typed data contracts** expected from the backend APIs.

---

## 1) Scope & Principles

- **Frontend-only**: This document specifies UI mechanics, app structure, theming, and the format/types of data expected from the backend.
- **Fair & accessible**: Color-blind-friendly feedback (icons + color) and AA contrast; touch targets sized for mobile. (WCAG AA 4.5:1 for text; Apple 44pt / Material 48dp targets). citeturn1search6 citeturn1search1turn1search2
- **Telegram-native**: Uses the official **TMA.js React SDK** for theme, viewport, back button, and haptics hooks. citeturn0search10

---

## 2) Tech Stack (Frontend)

- **Framework:** Next.js (App Router).
- **Telegram SDK:** `@tma.js/sdk-react` (React bindings to Mini Apps client SDK). citeturn0search10
- **UI kits:** 
  - `@telegram-apps/telegram-ui` for Telegram‑styled panels/toolbars where a native feel helps. citeturn0search2
  - `shadcn/ui` for accessible dialogs, sheets, and toasts (Radix-based). citeturn2search8
- **Styling:** Tailwind CSS **v4** with design tokens (CSS variables) for the pastel light theme. citeturn0search4turn0search20
- **Data fetching/cache:** TanStack Query (`useQuery`, `useMutation`). citeturn0search13turn0search8turn0search3
- **Animation:** Framer Motion / Motion.dev (tile flip, row shake, key pop). citeturn0search8
- **Icons:** `lucide-react` (tree‑shakable SVG icons). citeturn2search1

> For platform background and feature capabilities, see Telegram Mini Apps docs. citeturn0search7turn0search12

---

## 3) App Architecture (Next.js)

### 3.1 Directory map
```
app/
  layout.tsx          # Shell: theme, top bar, toasts
  providers.tsx       # TMA.js, Query, Theme/Haptics bridges
  page.tsx            # Hub (mode cards, quick stats)
  daily/page.tsx      # Daily game
  arcade/page.tsx     # Arcade game
  leaders/page.tsx    # Leaderboards
  shop/page.tsx       # Shop (UI only, Stars handled server-side)
  help/page.tsx       # Rules & RU orthography
components/
  GameHeader.tsx | PuzzleGrid/GuessRow/Tile.tsx | KeyboardCyr.tsx
  StatusBar.tsx  | ResultModal.tsx | ShareCardPreview.tsx
  PurchaseSheet.tsx | SettingsSheet.tsx | ToastCenter.tsx
  A11yIcon.tsx   | ThemeBridge.tsx | HapticsBridge.tsx
```

### 3.2 Providers (bootstrapping)
- **`@tma.js/sdk-react`**: initialize once; mount features (e.g., BackButton), read **Theme Params** and **Viewport**; optional `DisplayGate` for startup states. citeturn0search10
- **Theme binding**: Bind Telegram Theme Params → CSS variables (so our palette adapts safely). citeturn0search6
- **TanStack Query**: global `QueryClientProvider` with route-level queries/mutations. citeturn0search13

---

## 4) Visual System

### 4.1 Pastel light theme (tokens)
We apply a gentle white/blue palette with clear contrast and rounded shapes.

```
--bg:#F7FAFF; --panel:#FFFFFF; --text:#0F1C2E; --tile-border:#D7E3F3;
--state-correct:#77C3A3; --state-present:#F2D27A; --state-absent:#C6D0E0;
--key-bg:#E7EEF8; --key-pressed:#D9E6F7; --accent:#7AB6FF;
```
- **Contrast**: target WCAG **AA** (≥4.5:1 for text; ≥3:1 for UI components). Validate with WebAIM contrast checker. citeturn1search6turn1search3
- **Shape/spacing**: tiles 58–64 px, keys 44–48 px; generous gaps and safe‑area padding.
- **Touch targets**: ≥44 pt (iOS) / ≥48 dp (Material). citeturn1search1turn1search2

### 4.2 Components
- **PuzzleGrid** → `GuessRow` → `Tile` (states: `correct`, `present`, `absent`; also `hard-violation`).
- **KeyboardCyr** (on‑screen Cyrillic) mirrors grid length; physical keyboard supported on desktop.
- **StatusBar / Toasts**: succinct, non‑blocking. (shadcn/ui components) citeturn2search8
- **Modals/Sheets**: `ResultModal`, `PurchaseSheet`, `SettingsSheet`.

### 4.3 Animations & haptics
- **Reveal**: flip 120–150ms per tile with slight stagger; **shake** on invalid guess; **press** pop on keys. (Framer Motion patterns) citeturn0search8
- **Haptics**: light impact on key press; success/error on result/invalid. (Mini Apps haptics) citeturn0search7

---

## 5) UX Mechanics (summary)

- **Input & validation**: type with on‑screen Cyrillic keyboard (and desktop physical keys); enforce word length and dictionary validity in UI; final validation server‑side.
- **Feedback**: tiles and keys show **color + small icon** (✓ / • / ×) to avoid relying on color alone.
- **Hard Mode**: client warns if known greens must be reused or if yellows are mispositioned; server is authoritative.
- **Scoring UI**: Daily shows attempts (primary) and time (secondary, badge off by default); Arcade shows MMR delta.
- **RU orthography**: “ё=е” input toggle (answer reveal uses correct character).

Microcopy (RU, compact):
- **Invalid**: «Слова нет в словаре.»
- **Too short**: «Слово короче.»
- **Hard mode**: «Используйте открытые буквы.»
- **Network**: «Сеть недоступна. Попробуйте позже.»

---

## 6) Data Contracts (expected from backend)

> All timestamps **ISO 8601 (UTC)**. Backend is **source of truth** for attempts, timing, solution, and rating.

```ts
// Common
export type LetterState = 'correct' | 'present' | 'absent';

export type TileFeedback = {
  index: number;     // 0-based
  letter: string;    // uppercase RU
  state: LetterState;
};

export type GuessLine = {
  guess: string;         // uppercase RU, NFC
  feedback: TileFeedback[];
  submittedAt: string;   // ISO
};
```

### 6.1 Daily
```ts
export type DailyPuzzlePayload = {
  puzzleId: string;
  mode: 'daily';
  length: 5;
  maxAttempts: 6;
  serverNow: string;     // ISO
  opensAt: string;       // ISO (archive)
  expiresAt: string;     // ISO (rollover)
  keyboard: 'ru';
  hardModeAvailable: boolean;
  yourState: {
    status: 'playing' | 'won' | 'lost';
    attemptsUsed: number;
    lines: GuessLine[];  // user's guesses only
  };
};
// GET /api/puzzle/daily → DailyPuzzlePayload  (cache until expiresAt)
// POST /api/puzzle/daily/guess { puzzleId, guess, hardMode? } →
// { puzzleId, line: GuessLine, status, attemptsUsed }
```

### 6.2 Arcade
```ts
export type ArcadeStartRequest = { length: 4|5|6|7; hardMode: boolean };
export type ArcadeStartResponse = {
  puzzleId: string;
  mode: 'arcade';
  length: 4|5|6|7;
  maxAttempts: number;
  serverNow: string;
};
// POST /api/arcade/start → ArcadeStartResponse
// POST /api/arcade/guess { puzzleId, guess } → Daily-like response + { mmrDelta?: number }
```

### 6.3 Dictionary check (optional UI hint)
```
GET /api/dict/check?word=СТРОКА → { valid: boolean }
```

### 6.4 Leaderboards (Daily)
```ts
export type DailyBoardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  attempts: number;
  timeMs: number;     // server-measured
  country?: string;
  badges?: string[];
};
export type DailyLeaderboard = {
  puzzleId: string;
  asOf: string;
  entries: DailyBoardEntry[];
  you?: DailyBoardEntry;
};
// GET /api/leaderboard/daily?puzzleId=... → DailyLeaderboard
```

### 6.5 Shop catalog (UI only; Stars handled via server)
```ts
export type ProductType = 'ticket' | 'season_pass' | 'cosmetic' | 'analysis' | 'archive';
export type Product = {
  id: string;
  type: ProductType;
  title: string;
  subtitle?: string;
  priceStars: number;       // integer
  recurring?: 'monthly'|'seasonal';
  badge?: 'new'|'popular';
};
export type ShopCatalog = { products: Product[]; asOf: string };
// GET /api/shop/catalog → ShopCatalog
// POST /api/shop/purchase { productId } → { ok: boolean }
```

---

## 7) Query & Caching Policy (TanStack Query)

- **Daily puzzle**: key `['puzzle','daily', dateKey]`; **stale** until `expiresAt`; no refetch on focus. citeturn0search13
- **Arcade**: key `['puzzle','arcade', puzzleId]`; refetch on guess mutation.
- **Leaderboards**: refetch every 30–60s while result modal is open.
- **Mutations**: invalidate relevant keys on success (e.g., `submitGuess` → puzzle & leaderboard). citeturn0search3

---

## 8) Accessibility Checklist (frontend)

- **Color + icon** for feedback (never color alone).
- **Contrast**: text ≥4.5:1; component boundaries ≥3:1; verify with WebAIM checker. citeturn1search6turn1search3
- **Touch targets**: ≥44pt (iOS), ≥48dp (Material). citeturn1search1turn1search2
- **Keyboard/Focus**: modals and sheets trap focus; Escape/back‑button closes safely (shadcn/ui). citeturn2search4

---

## 9) References (selected)

- **TMA.js React SDK** — package & usage. citeturn0search10
- **Theme Params binding** — create CSS variables from Telegram theme. citeturn0search6
- **TanStack Query** — quick start, useQuery/useMutation. citeturn0search13turn0search8turn0search3
- **Tailwind v4** — release & upgrade guide. citeturn0search4turn0search20
- **Telegram UI kit** — components for Telegram‑styled shell. citeturn0search2
- **shadcn/ui** — components (dialogs, sheets, toasts). citeturn2search8
- **Framer Motion** — animation primitives. citeturn0search8
- **lucide-react** — icon package (tree‑shakable). citeturn2search1
- **Telegram Mini Apps (platform)** — overview & capabilities. citeturn0search7turn0search12
- **Accessibility** — WCAG contrast, touch target sizes, WebAIM checker. citeturn1search6turn1search1turn1search2turn1search3
