# RU Letter Puzzle — User Flow (Telegram Mini App)
_Version: 1.0 • Updated: 2025-10-23 12:06 UTC_

**Purpose:** Expand project context with a clear, non-technical description of the end‑to‑end user flow for the Russian letter puzzle mini app on Telegram.  
**Source of truth:** `/mnt/data/Product_Spec.md` (Product Spec).  
**Doc placement:** `/docs/ux/User_Flow.md` (keep docs organized by area; e.g., `/docs/db`, `/docs/ux`, `/docs/economy`).  
**Maintenance:** Update `CHANGELOG.md` on any **non‑minor** change to user‑visible behavior.

> This document excludes technical implementation. It describes states, transitions, and user‑facing copy only.

---

## TL;DR
- Two main loops: **Daily** (shared puzzle, streaks, rating) and **Arcade** (unlimited; separate ladder).  
- **Fairness first:** attempts weigh more than time; monetization never affects Daily difficulty or rating.  
- **Onboarding** covers basics, RU orthography (ё/е, й/и, ь/ъ), duplicates, and accessibility defaults.  
- **Accessibility by default:** high contrast, icons + color, haptics; large tap targets.

---

## Guiding Principles
- **Simple core, deep mastery.**
- **Fair competition:** attempts > time; difficulty‑normalized daily rating.
- **No pay‑to‑win:** Stars monetize cosmetics, analysis, archives, passes, and limited streak protection.
- **Accessibility by default:** contrast, iconography, haptics.
- **RU specificity:** strict orthography; duplicate handling is transparent.
- **Privacy & respect:** minimal telemetry; clear consent text for optional features.

---

## Global Sitemap (high‑level)
**Home / Hub**
- Daily
- Arcade
- Leaderboards
- Shop (Stars)
- Profile
- Settings
- Help / Report
- Share (post‑game entry points)

> Use separate swimlanes in Figma for **Daily**, **Arcade**, and **Meta** (Shop/Settings/Help/Profile).

---

## 0) First‑Run Onboarding
**Entry:** Open Mini App (first time) → Welcome → Accessibility setup → How to play → (Optional) RU orthography tips → Home

**0.1 Welcome**
- Goal: set expectation (two modes; daily ritual + arcade variety).
- RU copy: “**Привет!** Это ежедневная загадка из букв и быстрая аркада.”  
  CTA: “**Начать**” / “**Подробнее**” (opens Help).

**0.2 Accessibility setup (recommended)**
- Toggles: High contrast (on by default), Haptics (if supported), Timer visibility (off by default).
- RU copy:
  - “**Высокий контраст** — лучше видно цветовую подсказку.”  
  - “**Показывать таймер** — можно включить позже.”

**0.3 How to play (essentials)**
- Tiles / keyboard feedback; **duplicates**: highlights limited by count in answer.
- RU copy: “**6 попыток**, после каждой — подсказка по буквам.”

**0.4 RU orthography tips (compact)**
- ё ≠ е (answers distinct; input may allow treating ё as е if enabled).  
- й ≠ и; ь/ъ возможны по словарю.  
- Button: “**Понятно**” (→ Home).

**Completion:** Persist preferences → **Home**. Skippable elements remembered.

---

## 1) Daily Flow
**Entry:** Home → Daily intro → Guess loop → Result (win/lose) → Post‑game → Share / Leaderboards

**1.1 Daily intro**
- Inform: 6 attempts; one shared puzzle per day; countdown to next rollover (single canonical timezone).
- RU copy: “**Ежедневная загадка готова.** У вас 6 попыток.”  
  Primary CTA: “**Играть**”; Secondary: “**В аркаду**”.

**1.2 Guess loop**
- Validate guess (allowed words); show tile feedback (present / misplaced / absent); update keyboard.  
- Error message example (RU): “**Слова нет в словаре.** Попробуйте другое.”
- Hard Mode tip (if enabled): “**Используйте открытые буквы** в новых попытках.”

**1.3 Result — Win**
- Show confetti/haptic; **streak +1**; **daily score** (attempts‑first; time secondary; difficulty‑scaled).  
- RU: “**Готово!** Результат отправлен. Серия: 7.”  
- CTAs: “**Поделиться**”, “**Рейтинг дня**”, “**В аркаду**”.

**1.4 Result — Lose (after 6 attempts)**
- Reveal answer with definition link; gentle nudge to Arcade.  
- RU: “Сегодня слово — **…**. Попробуйте себя в аркаде.”  
- CTA: “**В аркаду**”.

**1.5 Post‑game**
- Free recap (attempts timeline, discovered letters).  
- If Supporter: advanced analysis (efficiency, alt lines, percentile).  
- Upsell (non‑intrusive): “**Расширенный разбор** доступен в подписке.”

**1.6 Share**
- Share card (attempts/time summary; no spoilers).  
- RU: “**Поделиться результатом**” → Telegram share sheet.

**Edge cases (Daily)**
- Already solved today → show recap + share + boards.  
- Missed yesterday (Streak Freeze owned/available) → Prompt: “**Пропущен день. Заморозить серию за ⭐?**” (capped per month).  
- Network fail on submit → keep local state; retry banner.  
- Integrity: one active session; server‑authoritative timing.

---

## 2) Arcade Flow
**Entry:** Home → Arcade landing → Variant select → Guess loop → Result → MMR update

**2.1 Arcade landing**
- RU: “**Аркада — играйте без ограничений.**”  
- Controls: word length (4–7), Hard Mode toggle, “No‑Trap” option.

**2.2 Access gate**
- If Season Pass active → unlimited.  
- If not → limited **tickets** (bundles available in Shop).  
- RU hint: “Есть **Пасс сезона** — безлимитный доступ.”

**2.3 Guess loop** (same mechanics as Daily)
- RU errors consistent with Daily.

**2.4 Result**
- Show **Arcade rating (MMR) delta** vs. par; streaks are **Daily‑only**.  
- RU: “Рейтинг аркады: **1735** (↑12).”  
- CTAs: “**Сыграть ещё**”, “**Лидеры аркады**”, “**На главную**”.

**Edge cases (Arcade)**
- Out of tickets → soft gate with Shop shortcut.  
- Early exits persist progress only within a round.  
- Anti‑abuse: rate‑limit new rounds if suspicious patterns are detected (no UI text unless blocked).

---

## 3) Leaderboards & Seasons
**Entry:** Home → Leaderboards → (Daily / Season / Friends)

**3.1 Daily board**
- Show percentile and rank; filters: Friends, Country; solved‑only.

**3.2 Season board**
- Rolling 28–30‑day window; trimmed mean or decay to avoid punishing late joiners.  
- RU: “**Сезон:** Осталось 12 дней.”

**3.3 Friends board**
- Opt‑in with invite; basic moderation (mute/hide).  
- Privacy note (RU): “**Ваши результаты видны только в выбранных таблицах.**”

**Tie‑breakers & fairness**
- Attempts first; then normalized time; then earliest solve timestamp.  
- Fraud suspicion → score withheld pending review (silent to avoid gaming).

---

## 4) Shop (Telegram Stars)
**Entry:** Home → Shop → Product detail → Confirm → Success

**4.1 Subscriptions**
- **Supporter Pass** — archives of your dailies, advanced analysis, cosmetic stipend, premium board filters.  
- **Arcade Season Pass** — unlimited Arcade access + cosmetic missions.

**4.2 Consumables (capped; no power gain in Daily)**
- **Streak Freeze** (limited per month); **Late Solve** tolerance (rare); **Arcade Tickets**.

**4.3 Cosmetics & analysis**
- Themes/skins, haptic/sound sets, profile frames; **Analysis Day‑Pass** (one‑off).

**4.4 Fairness notice**
- RU: “**Покупки не влияют** на сложность ежедневной игры и честность рейтинга.”

**4.5 Purchase outcomes**
- Success → toast + item unlocked; Stay in context.  
- Cancel → back to product; no penalty.  
- Failure → explain next steps; retry link.

---

## 5) Profile
- Overview: current streak, last 7 dailies, arcade MMR, cosmetics.  
- If Supporter: open **Archive** and **Advanced Analysis**.  
- Shareable recap cards from archive.

---

## 6) Settings
- **Accessibility:** High contrast, icon overlays, haptics, large tap targets.  
- **Timer visibility:** default off; rating still computed server‑side.  
- **RU input policy:** “Считать «ё» как «е» при вводе” (validation only; answers remain distinct).  
- **Hard Mode default:** on/off with short description.  
- **Language:** RU (default), EN (fallback).  
- **Privacy:** consent for optional analytics; link to policy.

---

## 7) Help & Report
- **How to play:** duplicates & orthography examples; tile legend with icons.  
- **Dictionary policy:** what’s allowed; link to definition source.  
- **Report word:** form with reason (wrong/rare/offensive). Acknowledgement toast.  
- **Contact:** feedback channel link.

---

## 8) Share
- Post‑game: result card preview; copy is spoiler‑free; encourages friends board.  
- RU CTA: “**Бросить вызов в аркаде**”.  
- From Archive: recap share with date and percentile.

---

## 9) Error & Edge‑Case Matrix (non‑exhaustive)
| Situation | In‑Flow Behavior | RU Copy (example) | Notes |
|---|---|---|---|
| Network failure on submit | Keep local guess; banner retry | “**Сеть недоступна.** Попробуйте позже.” | Retry backoff |
| Daily already solved | Show recap + share | “**Сегодня вы уже играли.**” | Include next reset countdown |
| Invalid word | Reject guess; keep focus | “**Слова нет в словаре.**” | Education link |
| Missed day, Freeze available | Offer freeze (capped) | “**Пропущен день. Заморозить серию за ⭐?**” | Monthly cap |
| Out of Arcade tickets | Soft gate to Shop | “**Закончились билеты.**” | Keep progress |
| Suspicious behavior | Soft withhold score | (No copy) | Avoid teach‑to‑the‑test |
| Device time skew | Server time authoritative | “**Часы устройства отличаются.** Мы используем время сервера.” | Info only |

---

## 10) Analytics & Success Signals (conceptual)
- Activation: onboarding completion %, first Daily start %, Arcade try %.  
- Engagement: Daily solve rate, streak distribution, Arcade rounds/day.  
- Fairness health: variance of attempts/time; anomaly rates.  
- Monetization: conversion to Supporter/Season Pass; cosmetics attach rate.  
- Accessibility adoption: high‑contrast usage; haptic opt‑in.  
- Share → invite conversion; friends board participation.

> Telemetry remains minimal and aggregated; no sensitive content stored.

---

## 11) Appendices

### A. RU Orthography Cheatsheet
- **ё/е**: distinct in answers; optional input treat‑as‑e setting.  
- **й/и**: distinct; no auto‑substitution.  
- **ь/ъ**: allowed per dictionary; cannot start words.

### B. Color/Pattern Legend (accessibility)
- Present (correct place): green + ✓ icon  
- Present (wrong place): yellow + • icon  
- Absent: gray + × icon

### C. Figma Mapping Hints
- Use **Terminator** for Start/End, **Process** for actions, **Decision** for validations, **Connector** for jumps.  
- Keep separate pages: **Onboarding**, **Daily**, **Arcade & Meta**.  
- Annotate each node with short RU microcopy from this doc.

### D. Copy Tone
- Short, neutral, friendly; always actionable.  
- Never use NYT or “Wordle” branding in UI text.

---

## Review Checklist (for each release)
- Onboarding: covers duplicates & orthography; accessibility defaults tested.  
- Daily: attempts/time displayed appropriately; recap/definition share works.  
- Arcade: gate logic communicates clearly; MMR feedback present.  
- Leaderboards: filters working; tie‑breaks predictable; opt‑in privacy honored.  
- Shop: fairness notice visible; no power advantage in Daily.  
- Settings: timer toggle discoverable; RU input policy clear.  
- Help/Report: dictionary policy clear; report path simple.  
- Share: card is spoiler‑free and useful.

---

_End of User_Flow.md_
