# Frontend Implementation Plan (v0) — Telegram Mini App (RU Word Puzzle)

**Audience:** Cursor/Codex (codegen) + developers  
**Goal:** Ship a playable **v0** frontend that mirrors the Wordle‑style loop with our pastel light theme, using **Next.js (App Router)**, **TMA.js React SDK**, **TanStack Query**, **Tailwind v4**, **Telegram UI kit**, **shadcn/ui**, **Motion**, and **lucide-react**.  
**Scope:** Frontend only; backend discussed separately. Use the data contracts in `Frontend_Documentation.md` (and Product/User Flow docs) as the API shape.

> References used in this plan: TMA.js React SDK (init, features, theme/viewport CSS variables), Tailwind v4 (tokens), TanStack Query (queries/mutations), shadcn/ui (Dialog/Sheet/Toast), Motion (animation patterns), lucide-react (icons), Telegram UI kit. citeturn0search0 citeturn0search1 citeturn0search9 citeturn0search3 citeturn0search11 citeturn0search2 citeturn0search4 citeturn0search5 citeturn0search6 citeturn0search7

---

## 0) Deliverables (v0 scope)

- **Playable Daily screen**: grid + RU keyboard, guess submission UI, local validation (length), tile/keyboard feedback animations, toasts.
- **Arcade stub**: landing with controls (length, Hard Mode), navigates to shared GameScreen.
- **Result modal** (win/lose UI states; dummy data OK).
- **Settings sheet**: high contrast, icon overlays, timer visibility, RU input policy toggle (client state only).
- **Theme & haptics bridges**: Telegram theme → CSS vars; light haptics on keypress; success/error on result.
- **Provider wiring**: `@tma.js/sdk-react` + TanStack Query.
- **A11y**: color + icon; AA contrast; tap targets; back button support.

---

## 1) Project scaffold

**Commands**
```bash
# Next.js app (App Router)
npx create-next-app@latest tma-ru-word --ts --eslint

cd tma-ru-word

# Core deps
npm i @tma.js/sdk-react @tanstack/react-query

# UI & styling
npm i tailwindcss @telegram-apps/telegram-ui lucide-react framer-motion

# shadcn/ui (Radix-based; copy-in components)
# (Use the official steps to init; dialogs/sheets/toasts only)
```

- `@tma.js/sdk-react`: official React bindings for TMA features (`init`, BackButton, Theme Params, Viewport, etc.). citeturn0search0  
- Bind **Theme Params**/&nbsp;**Mini App** to CSS variables (so Telegram theme changes propagate). Use SDK helpers to **bind CSS vars**. citeturn0search1 citeturn0search9  
- Tailwind **v4** for tokenized pastel palette; see v4 blog/upgrade guides. citeturn0search3 citeturn0search11  
- TanStack Query for server‑state, invalidation patterns. citeturn0search2

**Repo structure (initial)**
```
app/
  layout.tsx
  providers.tsx
  page.tsx              # Hub (mode cards)
  daily/page.tsx
  arcade/page.tsx
  leaders/page.tsx      # stub
  shop/page.tsx         # stub
  help/page.tsx         # rules
components/
  GameHeader.tsx
  PuzzleGrid/
    index.tsx
    GuessRow.tsx
    Tile.tsx
  KeyboardCyr.tsx
  StatusBar.tsx
  ResultModal.tsx
  SettingsSheet.tsx
  ToastCenter.tsx
  ThemeBridge.tsx
  HapticsBridge.tsx
lib/
  api.ts               # request wrappers (fetch stubs)
  contracts.ts         # types from Frontend_Documentation.md
  theme.css            # CSS vars (pastel palette + Telegram binds)
```

---

## 2) Providers & bridges

### 2.1 `app/providers.tsx`
- Wrap with **SDKProvider + DisplayGate** (handle loading/initial/error). Call `init()` once and **mount features** you need (e.g., `backButton`). citeturn0search16  
- Wrap with **QueryClientProvider** (`@tanstack/react-query`). citeturn0search2

### 2.2 Theme binding
- On mount, bind **Theme Params** and **Mini App** colors to CSS vars using the SDK `bindCssVars` helpers to create `--tg-theme-*` variables. Map our pastel tokens to those vars. citeturn0search1 citeturn0search9

### 2.3 Haptics
- Initialize haptics and use light impact on key press; success/error on result/invalid. (Mini Apps haptics are exposed via the SDK family.) citeturn0search23

---

## 3) Visual tokens & Tailwind v4

Create `lib/theme.css` with base tokens (light pastel) and **rounded** shapes; keep text contrast ≥4.5:1. Tailwind v4 favors CSS variables—no heavy config. citeturn0search3  
Example (can be refined later):
```css
:root{
  --bg:#F7FAFF; --panel:#FFFFFF; --text:#0F1C2E;
  --tile-border:#D7E3F3;
  --state-correct:#77C3A3; --state-present:#F2D27A; --state-absent:#C6D0E0;
  --key-bg:#E7EEF8; --key-pressed:#D9E6F7; --accent:#7AB6FF;
}
```

---

## 4) Core components (MVP tasks + acceptance)

### 4.1 `PuzzleGrid` (Tiles/Rows)
- **Tasks**
  - Render 6×5 (Daily); length param for Arcade (4–7).
  - Animate **flip** on reveal; **shake** on invalid guess (Motion variants). citeturn0search5 citeturn0search21
  - Tile states: `correct | present | absent`; pastel colors + **small icons** (✓ • ×) via lucide. citeturn0search14
- **Acceptance**
  - Tiles flip sequentially (stagger ~60–90ms); icons visible in high-contrast or always subtle.
  - Works on mobile size; safe-area padding.

### 4.2 `KeyboardCyr`
- **Tasks**
  - 3-row Cyrillic keyboard; special keys: **ВВОД**, **⌫**; physical keyboard support on desktop.
  - Per-key state = best-known (green > yellow > gray).
  - Light haptic on press.
- **Acceptance**
  - Keys ≥44–48px height; rounded; responsive width.
  - Disabled Enter if guess length != word length.

### 4.3 `StatusBar` / `ToastCenter`
- **Tasks**: Non-blocking toasts (invalid, short, network); use shadcn/ui Toast. citeturn0search12
- **Acceptance**: No overlap with grid; back button remains functional.

### 4.4 `ResultModal`
- **Tasks**: Dialog with win/lose variants; recap list (lines/feedback); CTAs: Share, Leaderboard, Arcade. (Use shadcn/ui Dialog/Sheet.) citeturn0search12 citeturn0search4
- **Acceptance**: Focus trap; ESC/back closes safely; mobile-safe layout.

### 4.5 `SettingsSheet`
- **Tasks**: Toggles (High contrast; icon overlays; timer visible; RU input policy). (Use Sheet). citeturn0search4
- **Acceptance**: Persist client-side; immediate UI reaction for theme toggles.

---

## 5) Navigation & screens

### 5.1 `app/page.tsx` (Hub)
- Cards: **Daily**, **Arcade**, plus “Leaders”, “Shop”, “Help”. Use Telegram UI kit for shell/panels. citeturn0search7

### 5.2 `daily/page.tsx` & `arcade/page.tsx`
- Shared **GameScreen** composed of `GameHeader` + `PuzzleGrid` + `KeyboardCyr` + `StatusBar`.
- Header shows attempts left and help (?) button; timer badge optional.

---

## 6) State & data (frontend wiring)

### 6.1 TanStack Query
- **Query keys**
  - `['puzzle','daily', dateKey]` (stale until `expiresAt`).
  - `['puzzle','arcade', puzzleId]`.
  - `['leaderboard','daily', puzzleId]` (poll 30–60s on result modal).  
  Use Quick Start patterns for `useQuery`, `useMutation`, and **invalidation**. citeturn0search2
- **Mutations**
  - `submitGuess` → invalidate current puzzle (and leaderboard on win/lose). citeturn0search10

### 6.2 API stubs
Create `lib/api.ts` with stubs that match **contracts** (see `lib/contracts.ts`). Wire later to real endpoints:
- `getDailyPuzzle() → DailyPuzzlePayload`
- `postDailyGuess({ puzzleId, guess, hardMode? }) → GuessLine + status`
- `startArcade({ length, hardMode }) → ArcadeStartResponse`
- `postArcadeGuess({ puzzleId, guess }) → GuessLine + status (+mmrDelta)`
- `getDailyLeaderboard(puzzleId) → DailyLeaderboard`
- `getShopCatalog() → ShopCatalog`

---

## 7) TMA specifics (v0)

- **Back button**: Mount globally and show/hide per route; default action = go back or close dialogs first. (sdk‑react feature mounting). citeturn0search16  
- **Theme/Viewport CSS vars**: Bind with SDK helpers (`bindCssVars`) for Theme Params & Mini App; use vars in Tailwind styles. citeturn0search1 citeturn0search9  
- **Haptics**: success/error/selection patterns. (Feature provided by Mini Apps platform). citeturn0search23

---

## 8) A11y & UX guardrails

- **Not color alone**: always pair color with ✓ • × icons (lucide-react). citeturn0search6  
- **Contrast**: ensure text ≥4.5:1; verify palette when finalizing Tailwind tokens (v4). citeturn0search11  
- **Touch targets**: keys/buttons ~44–48px.  
- **Focus management**: shadcn/ui Dialog/Sheet trap focus; Back button/ESC close. citeturn0search12

---

## 9) Milestones & checklists

### M0 — Bootstrap & Providers
- [ ] Next.js app created; Tailwind v4 styles hooked up.
- [ ] Install libraries; create `providers.tsx` with `SDKProvider`, `DisplayGate`, `QueryClientProvider`. citeturn0search16 citeturn0search2
- [ ] Bind Theme Params & Mini App to CSS variables. citeturn0search1 citeturn0search9
- [ ] Haptics initialized.

### M1 — GameScreen MVP
- [ ] Grid renders; keyboard inputs; invalid length → toast.
- [ ] Motion animations for flip/shake; per-key state updates. citeturn0search5
- [ ] ResultModal skeleton.

### M2 — Query wiring & local model
- [ ] Stub API functions; useQuery for Daily payload; mutation for guesses. citeturn0search2
- [ ] Cache policy: Daily stale until `expiresAt`.

### M3 — Arcade & Settings
- [ ] Arcade landing with controls; starts a round (stub).
- [ ] SettingsSheet with toggles; persist locally.

### M4 — Leaderboard & Shop (stubs)
- [ ] Leaderboard screen lists entries (dummy data).
- [ ] Shop grid from catalog stub; purchase sheet opens (no real Stars).

### M5 — Polish & A11y
- [ ] Icons + color everywhere; high contrast pass.
- [ ] Back button per route; ESC/back closes dialogs.
- [ ] QA on mobile sizes; safe-area padding.

**Exit criteria (v0)**
- Playable Daily loop with animations + toasts.  
- Theme/haptics bridging works inside Telegram.  
- No console errors; CLS/LCP acceptable on low‑end phones.

---

## 10) Risks & mitigations

- **SDK drift** (old vs new packages): ensure we use **`@tma.js/sdk-react`** APIs; avoid deprecated `@telegram-apps/*`. citeturn0search0  
- **Theming inconsistencies**: bind Theme Params and MiniApp colors via SDK CSS vars; overlay pastel tokens carefully. citeturn0search1 citeturn0search9  
- **Dialog/focus quirks**: prefer shadcn/ui (Radix) modals/sheets; avoid mixing non‑Radix toasts that can conflict. citeturn0search12 citeturn0search20

---

## 11) What to implement next (post‑v0)

- Hook real API endpoints that match `contracts.ts` types.  
- Add **share card** generator and Telegram share flow.  
- Implement **leaderboard polling** when result modal is open.  
- Wire **Stars** purchase sheet (UI already done) once backend is ready.  
- Expand Settings (language, privacy), Help & Report forms.

---

### Appendix A — Minimal code notes for Cursor/Codex

- Use **Motion** for tile flip: `<motion.div variants={{ reveal: { rotateX: [0,90,0] }}} transition={{ duration:0.15 }}/>`. citeturn0search5  
- Use **TanStack Query** for all server calls; invalidation after successful guesses. citeturn0search2  
- Import **icons** individually from `lucide-react` to keep bundle small. citeturn0search6  
- Use **Telegram UI kit** only for shell/panels; custom grid/keyboard use Tailwind. citeturn0search7

---

**Linked docs in repo:**  
- `/docs/Product_Spec.md` — product & rules  
- `/docs/User_Flow.md` — user flow  
- `/docs/frontend/Frontend_Documentation.md` — components, types, a11y

