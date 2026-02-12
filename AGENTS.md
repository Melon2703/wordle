# Repository Guidelines

## Project Structure & Module Organization
Next.js app router lives in `app/` with feature folders like `app/arcade`, `app/daily`, `app/shop`, and `app/purchases`. Routes rely on `layout.tsx` plus shared providers in `app/providers.tsx`. Shared UI sits in `components/`, primitives in `components/ui/`, and feature widgets stay near their route. Cross-cutting logic lives in `lib/` (auth, db, dictionary, rate limiting, analytics). TypeScript types are defined in `lib/types.ts`. API schemas reside in `contracts/backend_contract.yaml`. Documentation lives flat in `docs/` (product spec, user flow, backend/frontend docs, analytics, changelog). Static assets go in `public/`.

## Build, Test, and Development Commands
Run `npm install` once to sync dependencies. Use `npm run dev` for the local Telegram mini-app shell, `npm run build` before deploying, and `npm run start` to verify the production bundle. Quality gates: `npm run lint` (ESLint + Next rules), `npm run typecheck` (TypeScript noEmit mode), and `npm run format` for Prettier compliance; add `--write` locally when fixing formatting.

## Coding Style & Naming Conventions
TypeScript with React function components is the norm. Prettier enforces 2-space indentation; avoid manual tweaks. Components in `components/` use PascalCase filenames (`ExtraTryModal.tsx`), helpers in `lib/` and `app/**/` prefer camelCase. Tailwind utilities drive layout; shared design tokens live in `app/globals.css` and `lib/theme.css`. Keep props typed via `contracts.ts` or module-local `types.ts`, and avoid default exports unless the module exposes a single entry point.

## Testing Guidelines
Automated testing is paused. Do not introduce new suites or frameworks. Before handing changes back, run `npm run lint` and `npm run typecheck`, then note any manual verification so the maintainer can reproduce it quickly.

## Documentation Expectations
Consult `docs/` for product intent and architecture. After delivering notable features, update the relevant doc or add a brief note calling out new routes, env vars, or backend touchpoints. Minor fixes and copy tweaks do not require documentation changes – just write them in CHANGELOG.md

## Commit & Pull Request Guidelines
Only the maintainer authors commits and PRs. Treat git as read-only—inspect history, diffs, and status only; leave staging, committing, and pushing to the owner. When delivering changes, provide clear summaries, affected paths, and manual testing notes so the maintainer can package the work efficiently.

## Environment Notes
Copy `.env.example` to `.env.local` and fill Supabase, Telegram, and feature flags before running `npm run dev`. Never commit secrets; add new config keys to `.env.example` alongside a short usage comment.
