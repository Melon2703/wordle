# Google Analytics Instrumentation Plan

This document outlines how to introduce Google Analytics (GA4) tracking to the RU Word Puzzle mini-app. It covers the integration approach, event taxonomy, and the exact React components where each event hook should live. The goal is to capture actionable product signals without leaking sensitive user data (e.g., the actual words players type).

---

## Integration Overview
- **Load GA globally**: inject the GA measurement snippet via `next/script` in `app/layout.tsx`. Defer script execution so it does not block rendering.
- **Analytics helper**: add a thin wrapper in `lib/analytics.ts` that exposes:
  - `trackEvent(eventName, params)` – calls `window.gtag?.('event', ...)`.
  - `trackPageView(path, title)` – records page views using GA4 recommended parameters.
- **Provider hook**: create a `ClientAnalyticsBridge` component (e.g. rendered from `app/providers.tsx` once) that calls `trackPageView` inside a `useEffect` whenever `usePathname()` changes. Include Telegram `initDataUnsafe?.user?.id` bucketed into cohorts if needed, but never send the raw ID.
- **Error handling**: wrap calls in try/catch so telemetry never throws. Log failures to `console.debug` only.
- **PII guardrails**: never send raw guesses, Telegram user IDs, or invoice URLs. Prefer categorical metrics (e.g., `guess_result: 'correct' | 'incorrect'`).

---

## Shared Event Parameters
Use these common keys to keep reporting consistent:

| Param              | Description                                                           |
| ------------------ | --------------------------------------------------------------------- |
| `mode`             | `'home'`, `'daily'`, `'arcade'`, `'dictionary'`, `'shop'`, `'purchases'` |
| `word_length`      | Puzzle length at the moment of the event (4/5/6)                       |
| `attempt_index`    | 1-based index of the submitted attempt                                |
| `attempts_used`    | Total attempts used when event fires                                  |
| `result`           | `'win'`, `'loss'`, `'incomplete'`, `'correct'`, `'incorrect'`, etc.    |
| `screen`           | React component or route identifier (e.g., `app/daily/page.tsx`)      |
| `cta_id`           | Banner CTA identifier or button label                                 |
| `product_id`       | Shop product (e.g., `arcade_hint`, `arcade_new_game`)                 |
| `payment_outcome`  | `'paid'`, `'cancelled'`, `'failed'`                                   |

If a parameter does not apply, omit it instead of sending `null`.

---

## Global & Navigation Events
| Event | Trigger | Location | Notes / Params |
| ----- | ------- | -------- | -------------- |
| `page_view` | Route change | `ClientAnalyticsBridge` (rendered from `app/providers.tsx`) | Send `page_path`, `page_title`, `mode` derived from pathname. |
| `nav_item_clicked` | User taps an item in the bottom bar | `components/BottomNav.tsx` (inside `<Link>` onClick around line 70-81) | Params: `mode` (destination), `source_mode` (current page). |
| `rules_sheet_opened` / `rules_sheet_closed` | Rules modal toggled | `components/BottomNav.tsx` (rules button onClick around line 86-96), `components/RulesSheet.tsx` (onClose handler and unmount effect) | Fire `opened` on button click, `closed` when modal unmounts (hook inside `RulesSheet`). |
| `onboarding_completed` | User taps OK in onboarding rules | `components/RulesSheet.tsx` (OK button onClick around line 115-118, when `showOnboardingButton` is true) | Include `mode: 'home'`. |

---

## Home Screen (`app/page.tsx`)
| Event | Trigger | Location | Params |
| ----- | ------- | -------- | ------ |
| `home_banner_shown` | Banner rendered after filtering dismissals | `components/Banner.tsx` (add `useEffect` hook after component mounts) | `banner_id`, `variant`. Fire once per banner render. |
| `home_banner_cta_clicked` | CTA button pressed | `components/Banner.tsx` (handleCtaClick around line 51-61) | `banner_id`, `cta_id`, `cta_type` (`'internal'`/`'external'`). |
| `home_banner_dismissed` | Dismiss button pressed | `components/Banner.tsx` (handleDismiss around line 41-49) | `banner_id`. |
| `home_card_tapped` | User taps one of the main cards | `app/page.tsx` (inside each `<Link>` onClick) | `destination_mode` (`'daily' | 'arcade' | 'dictionary'`), `daily_status`, `streak`, `saved_words_count`. |
| `saved_words_preview_loaded` | Saved words count fetched | `app/page.tsx` (after `getSavedWords` resolves) | `count`. Useful for adoption funnel. |

---

## Daily Mode (`app/daily/page.tsx`)
| Event | Trigger | Location | Params |
| ----- | ------- | -------- | ------ |
| `daily_puzzle_loaded` | API payload ready | `app/daily/page.tsx` (`useQuery` success block around `getDailyPuzzle`) | `word_length`, `attempts_used`, `status`. |
| `daily_guess_submitted` | User hits Enter and API responds | `app/daily/page.tsx` (`submitGuessMutation.onSuccess` handler) | `attempt_index`, `attempts_used`, `result` (`'correct' | 'incorrect'`), `word_length`, `duration_ms` since first action (derive using `data.yourState.timeMs` if available). |
| `daily_guess_failed` | `submitDailyGuess` throws | `app/daily/page.tsx` (`catch` block in `handleEnter` around line 93+) | `error_message` (trim to enum), `attempt_index`. |
| `daily_game_completed` | Status transitions to win/loss | `app/daily/page.tsx` (`submitGuessMutation.onSuccess` when `response.status !== 'playing'`) | `result` (`'win' | 'loss'`), `attempts_used`, `time_ms`, `streak`. |
| `daily_share_clicked` | Share button pressed | `components/ShareButton.tsx` (handleShare around line 35-96) | `mode: 'daily'`, `result`, `attempts_used`, `time_ms`. |
| `daily_save_word_clicked` | Save button pressed | `components/SaveWordButton.tsx` (handleSave around line 32-61) | `mode: 'daily'`, `word_length`, `already_saved`. Do **not** log the word itself. |
| `daily_error_retry_clicked` | User taps "Попробовать снова" on error state | `app/daily/page.tsx` (error fallback button `onClick` handler) | Captures network failures. |

---

## Arcade Mode (`app/arcade/page.tsx`)
| Event | Trigger | Location | Params |
| ----- | ------- | -------- | ------ |
| `arcade_session_restored` | Incomplete session revived | `app/arcade/page.tsx` (`useEffect` restoring `incompleteSession`) | `word_length`, `lines_count`, `had_extra_try_prompt`. |
| `arcade_length_selected` | User taps length pill | `app/arcade/page.tsx` (length selector button onClick) | `word_length`, `mode: 'arcade'`. |
| `arcade_theme_selected` | Theme pill tapped | `app/arcade/page.tsx` (theme selector button onClick) | `theme`. |
| `arcade_start_clicked` | Start button pressed | `app/arcade/page.tsx` (`handleStart` around line 512, before mutation) | `word_length`, `theme`, `credits_remaining`. |
| `arcade_session_started` | `startArcadeMutation.onSuccess` | `app/arcade/page.tsx` (after session data set in `startArcadeMutation.onSuccess`) | `word_length`, `theme`, `hint_entitlements`, `extra_try_entitlements`. |
| `arcade_guess_submitted` | Guess evaluated locally | `app/arcade/page.tsx` (`handleEnter` around line 547, after `evaluateGuessLocally`) | `attempt_index`, `result` (`'correct' | 'incorrect'`), `word_length`, `theme`. |
| `arcade_session_completed` | Game ends (win/loss) | `app/arcade/page.tsx` (`handleEnter` branches that call `completeArcadeSession` or `handleFinishGame`) | `result` (`'win' | 'loss'`), `attempts_used`, `time_ms`. |
| `arcade_hint_icon_opened` | TopCenterIcon pressed | `components/TopCenterIcon.tsx` (onClick handler around line 14-16) | `hint_count` used so far. |
| `arcade_hint_used` | API returns hint | `app/arcade/page.tsx` (`handleUseHint` success handler around line 325+) | `remaining_entitlements`, `hint_count`. |
| `arcade_hint_purchase_flow` | Purchase CTA tapped | `components/HintModal.tsx` (handlePurchase around line 47-86) | `product_id: 'arcade_hint'`, `stage` (`'opened' | 'completed' | 'cancelled' | 'failed'`). |
| `arcade_extra_try_prompt_shown` | Modal appears after final failure | `app/arcade/page.tsx` (`useEffect` that sets `showExtraTryModal` to `true`) | `attempts_used`, `remaining_entitlements`. |
| `arcade_extra_try_used` | User consumes entitlement | `app/arcade/page.tsx` (`handleUseExtraTry` success handler) | `remaining_entitlements_after`. |
| `arcade_extra_try_purchase_flow` | Buy button in modal | `app/arcade/page.tsx` (`handleBuyExtraTries` handler) or `components/ExtraTryModal.tsx` (onBuyTries prop handler around line 81-88) | `product_id: 'arcade_extra_try'`, `stage` (`'opened' | 'completed' | 'cancelled' | 'failed'`). |
| `arcade_unlock_games_flow` | "Восстановить/Купить игры" interactions | `app/arcade/page.tsx` (`handleUnlockArcade`, `handleBuyGames` handlers) | `stage` (`'opened' | 'completed' | 'cancelled' | 'failed'`), `product_id: 'arcade_new_game'`. |
| `arcade_new_game_clicked` | "Новая игра" button on result screen | `components/ResultScreen.tsx` or `app/arcade/page.tsx` (inline onClick handler for new game button) | Include `result` from previous session. |
| `arcade_share_clicked` | Share button pressed | `components/ShareButton.tsx` (called from arcade page, handleShare around line 35-96) | `mode: 'arcade'`, `result`, `attempts_used`, `time_ms`. |
| `arcade_save_word_clicked` | Save button pressed | `components/SaveWordButton.tsx` (called from arcade page, handleSave around line 32-61) | `mode: 'arcade'`, `word_length`, `already_saved`. Do **not** log the word itself. |

---

## Dictionary (`app/dictionary/page.tsx`)
| Event | Trigger | Location | Params |
| ----- | ------- | -------- | ------ |
| `dictionary_loaded` | Saved words query resolves | `app/dictionary/page.tsx` (`useQuery` success handler) | `words_count`. |
| `dictionary_delete_clicked` | Delete icon tapped | `app/dictionary/page.tsx` (`handleDelete` prior to mutation) | `word_length`, `source`. |
| `dictionary_delete_result` | Mutation success / failure | `app/dictionary/page.tsx` (`deleteMutation.onSuccess` & `onError` handlers) | `outcome` (`'success' | 'failure'`). |

---

## Shop (`app/shop/page.tsx`)
| Event | Trigger | Location | Params |
| ----- | ------- | -------- | ------ |
| `shop_ready_state` | Telegram init loop finishes | `app/shop/page.tsx` (`useEffect` that sets `isTelegramReady`) | `ready: boolean`. |
| `shop_catalog_loaded` | Catalog query resolves | `app/shop/page.tsx` (`useQuery` success handler) | `product_count`. |
| `shop_product_clicked` | User taps "Получить" | `app/shop/page.tsx` (`handlePurchase` before API call) | `product_id`. |
| `shop_purchase_result` | Invoice promise resolves | `app/shop/page.tsx` (`handlePurchase` result branches) | `product_id`, `payment_outcome` (`'paid' | 'cancelled' | 'failed'`). |

---

## Purchases (`app/purchases/page.tsx`)
| Event | Trigger | Location | Params |
| ----- | ------- | -------- | ------ |
| `purchases_loaded` | Purchase history fetched | `app/purchases/page.tsx` (`useQuery` success handler) | `purchase_count`. |
| `purchase_refund_clicked` | "Вернуть" button tapped | `app/purchases/page.tsx` (`handleRefund` before confirmation) | `purchase_id`, `stars_amount`. |
| `purchase_refund_confirmed` / `purchase_refund_cancelled` | Confirmation result | `app/purchases/page.tsx` (branches inside `handleRefund`) | `decision` (`'confirmed' | 'cancelled'`). |
| `purchase_refund_result` | Mutation success/failure | `app/purchases/page.tsx` (`refundMutation.onSuccess` / `onError` handlers) | `purchase_id`, `outcome` (`'success' | 'failure'`). |

---

## Shared Components
- **`components/ShareButton.tsx`** – add generic `share_clicked` event before network request. Include `mode`, `result`, `attempts_used`, and `transport` (`'telegram_shareMessage' | 'telegram_openLink' | 'clipboard'`) based on available API branch.
- **`components/SaveWordButton.tsx`** – emit `word_save_attempted` before API call and `word_save_result` on success/failure. Params: `mode`, `source`, `already_saved`.
- **`components/ToastCenter.tsx`** – optional aggregate event `toast_shown` with `message_id` when important UX toasts fire (e.g., purchase success/failure). Instrument within `notify` implementation if higher-level aggregation is desired.

---

## Next Steps Checklist
1. Add GA snippet and helper utilities (`app/layout.tsx`, `lib/analytics.ts`).
2. Create `ClientAnalyticsBridge` rendered from `Providers` to emit page views.
3. Instrument shared components (Banner, ShareButton, SaveWordButton, RulesSheet, BottomNav).
4. Add event hooks to feature pages following tables above; keep logic adjacent to existing handlers (`handleEnter`, `handleUseHint`, etc.).
5. Write unit tests or manual QA checklist to ensure events fire only once per interaction (manual QA mandated; automated tests paused).
6. Document measurement IDs and event schema references in `docs/` once actual implementation lands.

This plan should provide product stakeholders with clarity around user engagement, conversion funnels for monetized features, and gameplay behavior while respecting user privacy.
