# RU Word Game (Telegram Mini App) — Product Spec

**Purpose:** This file expands context for the ChatGPT project and for developers/designers. It describes the product, rules, scoring, economy, and guardrails for a Russian, Wordle-style game inside Telegram Mini Apps.  
**Scope:** Conceptual and behavioral; **no implementation code** here.

---

## TL;DR
- Two modes: **Daily** (shared word, streaks) and **Arcade** (unlimited play).  
- **Fairness first:** attempts > time; no pay-to-win; strict RU orthography policy; curated wordlists.  
- **Accessibility:** high-contrast, icons, haptics.  
- **Monetization (Stars):** cosmetics, analysis, archives, Arcade passes, limited streak protection.

---

## 1) Design Principles
- **Simple core, deep mastery:** classic 5-letter puzzle loop with optional analysis and competitive layers.
- **Fair competition:** Attempts carry more weight than time; difficulty stays consistent. 
- **Respect the ritual:** Daily is cozy and ad-free; Arcade is where variety and monetization live.
- **Accessibility by default:** color + icon cues; high contrast; haptics; keyboard ergonomics.
- **Legal/IP:** no NYT branding or word lists; all content is original/curated.
- **TMA-native:** seamless in Telegram, safe-area aware, theme-aware, load fast.

---

## 2) Game Modes

### 2.1 Daily (shared puzzle)
- One 5-letter RU word per calendar day; all players get the **same** word.
- **6 attempts** max. Color feedback after each guess.
- **Streaks**: number of consecutive solved dailies.
- **Timer**: invisible by default; server-authoritative; starts on first accepted guess, stops on solve.
 - **Recap**: show attempts used and optional time; highlight streak progress.

**RU microcopy (examples):**
- “Ежедневная загадка готова.”  
- “Серия: 12 дней”  

### 2.2 Arcade (unlimited)
- Unlimited puzzles (configurable 4–7 letters; theme packs and challenges).
- Optional **Hard/No-Trap** variants (see §4.5).

**RU microcopy (examples):**
- “Аркада: сыграйте без ограничений.”  

---

## 3) Core Rules (Russian specifics)

### 3.1 Guess validity
- Guesses must be **valid Russian words** from the **Allowed Guesses** list.
- **Answer List** is a curated subset of common, non-obscure words.

### 3.2 Orthography policy
- **«ё/е»**: treated as **distinct** in answers; players may input either; reveal shows the proper letter.  
  *Option in settings:* “Считать «ё» как «е» при вводе” (affects validation, not the correct answer).
- **«й/и»**: distinct letters; no auto-substitution.
- **Soft/Hard signs «ь/ъ»**: allowed when present in dictionary. No word begins with «ь/ъ».
- **Loanwords/slang**: only if widely adopted; avoid proper names, abbreviations, profanity.

### 3.3 Tile coloring (duplicates)
- **Green**: correct letter in the correct position.  
- **Yellow**: letter exists in the answer but at a different position.  
- **Gray**: letter does not appear in the answer **or** appears fewer times than guessed.  
- Duplicate handling uses **occurrence counts**: color up to the count present in the answer.

### 3.4 On-screen keyboard
- Three-row Cyrillic layout. Keys reflect **best-known status** (green > yellow > gray).
- Physical keyboard support on desktop.

### 3.5 Hard Mode & “No-Trap” option
- **Hard Mode:** must reuse revealed greens; must place known yellows somewhere else.
- **No-Trap probe (Arcade only):** once per game, allow a **probe word** that doesn’t consume an attempt but adds a fixed **time penalty**; prevents multi-candidate stalemates.

---

## 4) Streaks, Recaps, and Difficulty

### 4.1 Daily recap
- Show attempts used, optional time (if user toggled timer), and discovered letters summary.
- Reinforce streak count and countdown to next puzzle; no numeric score.
- Provide share CTA plus quick access to Arcade.

### 4.2 Arcade recap
- Summarize attempts used and elapsed time; note remaining tickets if gated.
- Reinforce that streaks are Daily-only; prompt replay without presenting ladders.

### 4.3 Streak policy
- Streak increments on solving the daily within the local daily window.  
- **Grace/Freeze:** one **Streak Freeze** per month can preserve a missed day (see §7).

### 4.4 Anti-cheat & integrity
- Server-side timing; one active session per user for the daily.  
- Submissions rate-limited; suspicious patterns flagged.  
- Canonical timezone for puzzle rollover; explicit countdown.

---

## 5) Accessibility & UX

### 5.1 Visual & interaction
- **High-contrast mode** (blue/orange); **icons** on tiles (✓ present/green, • present/yellow, × absent/gray).  
- Sufficient contrast (WCAG-guided); large tap targets; safe-area insets respected.
- **Haptics** on key press and result (if device supports).

### 5.2 Help & education
- “How to play” with duplicate examples and RU orthography notes.
- After reveal, link to a **definition** (in-app dictionary snippet).
- **Report word** button (feeds curation).

---

## 6) Content & Dictionaries

### 6.1 Lists
- **Answer List (~200 curated):** `for-puzzles.txt` in Supabase Storage - curated, modern, common vocabulary; exclude archaic/obscure/proper nouns.  
- **Allowed Guesses (~3k):** `for-guesses.txt` in Supabase Storage - broader dictionary to reduce "invalid" frustration.
- **Used Daily Words:** `daily-used-words.txt` in Supabase Storage - server-managed tracking to prevent duplicate daily puzzles.

### 6.2 Curation workflow
- Player reports → review queue → accept/deny with notes.  
- Metrics: invalid guess rate, dispute rate, difficulty drift.
- Wordlists updated via Storage uploads, not database; changes take effect on next cache refresh.
- Normalization: ё→е for validation; answers preserve correct orthography in `solution_text`.

### 6.3 Puzzle generation
- **Daily:** picks from unused words in `for-puzzles.txt`; tracks used words in `daily-used-words.txt`; resets cycle when all 200 used.  
- **Arcade:** random or seeded by challenge; optional difficulty bands.

---

## 7) Monetization (Telegram Stars)

> **Policy:** Daily core stays free; purchases **never** affect Daily difficulty, streak eligibility, or competitive fairness.

### 7.1 Subscriptions (Stars)
- **Supporter Pass**:  
  - Archive of **your past dailies** + shareable recap cards  
  - **Advanced post-game analysis** (efficiency, alt lines, percentile, difficulty index)  
  - Cosmetic stipend and premium friend-board features (filters, reactions)

- **Arcade Season Pass**:  
  - Unlimited Arcade plays  
  - Missions/quests with cosmetic rewards (no gameplay advantage in Daily)

### 7.2 Consumables (Stars)
- **Streak Freeze**: preserves a single missed daily (limited per month; server-verified).  
- **Late Solve token**: resolve prior day within a short tolerance window (rare, capped).  
- **Arcade Tickets**: bundles for non-sub users.

### 7.3 Cosmetics & Shop
- Theme packs (white/blue default; seasonal), tile/keyboard skins, haptic/sound sets, profile frames.
- **Analysis Day-Pass** for a one-off advanced breakdown.

---

## 8) Fairness & Ethics
- No ads that obscure the board; no interstitials before solving.
- Monetization is **cosmetic/analysis/convenience** only.  
- Timer visibility can be toggled; timer off by default.  
- Clear privacy policy; telemetry is aggregate and minimal.

---

## 9) Data & Events (conceptual)

**Key entities (conceptual, not schema):**
- `Profile`: tg_id, username, locale, settings (contrast, timer visibility).  
- `DailyWord`: date, answer, difficulty metrics.  
- `DailyResult`: tg_id, date, guesses, time_ms, hard_mode.  
- `ArcadeGame`: id/seed, tg_id, size, attempts, time_ms, outcome.  
- `Purchase`: tg_id, product_id, type (sub/consumable), status, receipt.  
- `Entitlement`: tg_id, perk (supporter, season_pass, cosmetics), expires_at/balance.

**Event flow snapshots:**
- **Daily submit:** validate guess → color tiles → update keyboard → if solved: update streak → share card.  
- **Arcade end:** evaluate outcome → award cosmetics/missions.  

---

## 10) Copy Guidelines (RU)
- Short, friendly, action-first. Avoid jargon.  
- Examples:
  - **Invalid guess:** “Слова нет в словаре.”  
  - **Hard Mode rule:** “Используйте открытые буквы в новых попытках.”  
  - **High contrast CTA:** “Включить высокий контраст (рекомендуется)”  
  - **Freeze confirm:** “Заморозить серию за ⭐? (осталось: 1)”

---

## 11) Metrics & Success Criteria
- D1/D7 retention (Daily mode), % high-contrast usage, average guesses/time, dispute rate per word, streak break causes, ARPDAU from Stars, conversion to Supporter/Season Pass, Arcade DAU and replay rate.

---

## 12) Risks & Mitigations
- **Timer anxiety:** hideable timer; attempts-first scoring.  
- **Dictionary disputes:** public policy, fast review loop, definitions.  
- **Streak loss frustration:** Freeze/Late token (capped), clear countdown.  
- **Pay-to-win perception:** purchases never touch Daily fairness.

---

## 13) Open Questions (to decide)
- Exact limits for Freeze/Late tokens per season.  
- Default policy for «ё=е» input (current: optional toggle).  
- Season length (28 vs 30 days) and decay amount.  
- Minimum answer frequency threshold for curation.

---

## 14) Glossary
- **Daily**: one shared puzzle per day with streaks.  
- **Arcade**: unlimited puzzles; optional ticket gating.  
- **Streak**: consecutive solved dailies.  
- **High-contrast**: accessibility palette with icon overlays.  
- **Freeze**: consumable to protect a missed day.

---

## 15) Change Log
- **v1.0** — Initial product spec for context expansion (modes, rules, scoring, economy, accessibility).
