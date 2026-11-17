# MeowDeck P2.5 — Vite → Next.js 16 App Router Migration

## Purpose and baseline

- **Baseline:** `kzabCde/MeowDeck` `main` commit `1d8aa53d9e34d3fb1dd9f41286947cb8694974eb` (P3 merged).
- **Previous stack:** React 19 + Vite 7, Vite HTML entry and `createRoot` in `src/web/main.tsx`.
- **Target stack:** Next.js **16.4.6** (pinned stable), React 19, TypeScript strict, Next App Router and Next's **Webpack compiler** (see below).
- **Migration scope:** Framework/bootstrap, entry points, hydration safety, TypeScript configs, scripts, CI and tests only. All P0 artwork and P1/P3 game engine and strategy source files remain unchanged.

## Architecture

```text
src/app/layout.tsx    Server Component; html(lang=th), metadata and CSS
src/app/page.tsx      Server Component; renders existing client boundary
src/web/App.tsx       'use client'; original P2/P3 game controller and state
src/web/**            Existing menus, table, effects, Mochi animation UI
src/games/meowdeck/** Headless P1 engine + P3 strategy/clip/presentation helpers
public/assets/**     Unchanged P0 cards and Mochi sprite sheets/manifests
```

The game continues entirely in the browser. `applyAction()` remains the only gameplay authority, while `createAIObservation()` gates information available to the AI. The new App Router layer does not create another game session, API route, Server Action, or backend dependency.

## Why Next's Webpack mode is selected

P1 was written as native NodeNext ESM with import specifiers like `./cards.js` even though the original source file is `cards.ts`. This remains required for the engine's standalone Node compilation and original test coverage. Next.js 16 Turbopack has a documented compatibility gap with `.js`-to-`.ts` extension aliasing. Rather than mass-rewrite protected P1/P3 source or duplicate an engine, the migration uses the officially supported `next dev --webpack` and `next build --webpack` commands, with a minimal `webpack.resolve.extensionAlias` mapping in `next.config.ts`.

**Webpack is a bundler inside Next.js, not a second application framework. Vite is removed.** Revisit Turbopack if its relevant extension-resolution support is subsequently verified by a production build and browser tests. The current build cannot be verified in this isolated environment (see report).

## Hydration and browser globals

- `App.tsx` begins with `'use client'`. It does not read `window`, `document` or `crypto` at module initialization.
- Reduced Motion begins from the same deterministic value for SSR and the first client render, then reads `matchMedia` in `useEffect`, including system preference changes.
- `fastAI` development mode is initialized after mount inside an effect, and `qaSeed` is read only in the `startMatch` click handler. Both are gated by `process.env.NODE_ENV === 'development'`; **production query parameters cannot activate test overrides**.
- P3 animation `requestAnimationFrame`, `Image`, sprite loading, visibility and timers remain inside browser effects/callbacks; React Strict Mode cleanup behavior is preserved.
- Root HTML starts `lang="th"`, matching the existing default dictionary; the original locale effect updates `<html lang>` when switching to English.
- No blanket SSR disable, global `suppressHydrationWarning`, new state store, or additional game logic was introduced.

## TypeScript configuration

- `tsconfig.engine.json` is an exact copy of P1/P3's original `tsconfig.json`: NodeNext/strict, root `src`, output `dist/`.
- New `tsconfig.json` uses the Next.js App Router TypeScript settings: Bundler resolution, React JSX, strict checks, generated Next route types, no emit.
- `npm run typecheck` first runs `next typegen` so `next-env.d.ts` and route types are generated consistently in CI; `next-env.d.ts` is intentionally ignored by Git.
- `npm run build:engine`, `npm run test:simulation`, and `npm run benchmark:ai` continue using `dist/`; Next builds to `.next/` and never copies the engine there for headless testing.

## Public artwork compatibility

- Original 52 playable card sprites plus Joker variants and card back remain in `public/assets/meowdeck/cards/`.
- Card manifest: `/assets/meowdeck/cards/manifest.json`.
- Mochi manifest: `/assets/meowdeck/mochi/animations.json`.
- Ten horizontal Mochi sprite sheets and 44 frames use their original PNG byte contents, 96×96 frame geometry, and existing animation manifest.
- Runtime uses native pixelated image/CSS display; no Next image optimization or conversion was applied.
- `asset-digests.json` and the canonical Python P0 validator remain unchanged.

## Commands after installing dependencies

```bash
# With npm registry access, run once and COMMIT the resulting package-lock.json:
npm install

# Once package-lock.json exists, use reproducible installs:
npm ci
npm run typecheck:engine
npm run typecheck
npm test
npm run test:simulation
npm run validate:assets
npm run benchmark:ai
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:e2e:production
```

**Development E2E** runs `next dev --webpack` on port 3000 with the original deterministic `qaSeed=62&fastAI=1` fixtures. **Production E2E** uses `next start` on port 3001 and verifies HTML response, hydration, manifests, cards, Mochi images, legal match start and responsive layout; it does not depend on QA overrides in the production bundle.

## CI

`.github/workflows/validate-ui.yml` runs frozen npm installs, typechecks, headless tests, benchmark, Python asset validation, Next production build, dev Playwright regression and production smoke tests. `.github/workflows/validate-engine.yml` retains standalone NodeNext typechecking and engine tests. Original asset-validation workflow is untouched.

> **Blocking verification requirement:** This package was prepared with no ability to download npm dependencies. Next.js has not actually been installed, so the new bundle has not yet been built or exercised in Chromium. The missing lockfile and browser/build verification must be completed before a PR can be declared ready to merge. The tests included in the package are not proof that Next.js runtime works yet.

## Future P4 integration

The Client Component boundary is stable for local Save/Continue, statistics collection and settings storage. The event and animation contracts remain suitable for sound cues. PWA and offline runtime can be introduced later without moving card actions to the server. No P4 feature is implemented by this migration.
