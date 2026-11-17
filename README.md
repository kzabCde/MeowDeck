# MeowDeck — A Little Cat. A Clever Deck.

**MeowDeck P2.5: Next.js App Router + React 19 with the original P1 Crazy Eights game, P2 gameplay UI, three fair P3 AI difficulties, and all ten Mochi animations.** P0 assets and P1 rules remain authoritative and unchanged. P4 persistence/audio/PWA are not implemented.

## Prerequisites and commands

- Node.js 22+ and npm. Next.js is the only web framework; no Vite remains. Next uses its supported Webpack mode to resolve the original NodeNext `.js` TypeScript imports without rewriting P1/P3.
- TypeScript is a development-only dependency. The `dist/` folder is generated, not tracked.
- Python + Pillow are required **only** to re-run P0 pixel-art validation.

```bash
npm install
npm run typecheck:engine
npm run typecheck
npm test
npm run test:simulation

# Independent P0 check
python -m pip install -r requirements-assets.txt
python scripts/validate_assets.py
```

`npm test` compiles the TypeScript engine and runs Node's built-in test runner, including 40 reproducible complete-match simulations. `npm run test:simulation` runs a standalone legal-move driver with seed 73 to demonstrate a complete match without UI. It is **not** the final Mochi AI.

## Headless engine

Entry point: [`src/games/meowdeck/index.ts`](src/games/meowdeck/index.ts).

```ts
import { createMatch, getLegalActions, applyAction } from './src/games/meowdeck/index.js';

let state = createMatch({ sessionId: 'example-session' });
const legal = getLegalActions(state);
// Build a complete action with type, actor, unique actionId, and expectedTurnId.
// For a non-final eight, include selectedSuit: 'S' | 'H' | 'D' | 'C'.
const choice = legal[0]!;
const action = choice.type === 'play_card'
  ? { type: 'play_card' as const, cardId: choice.cardId, ...(choice.requiresSuit ? { selectedSuit: 'S' as const } : {}) }
  : choice;
const result = applyAction(state, { ...action, actor: state.currentActor, expectedTurnId: state.turnId, actionId: 'action-1' });
if (result.ok) { state = result.state; console.log(result.events); }
```

The Engine is deterministic when an integer RNG is injected. Production defaults to rejection-sampled WebCrypto integers. Commands with the same `actionId` are rejected after the first successful commit; a stale turn or round cannot mutate the session.

For **P2**, call `getHumanView(state)` to render the player's hand plus whitelisted public information, `getLegalActions(state)` to enable appropriate controls, and `applyAction` for authoritative actions. **P3** receives only `createAIObservation(state)`; it cannot see the player's cards or deck order.

See [`docs/P1_CORE_ENGINE.md`](docs/P1_CORE_ENGINE.md) for public API, state machine, rules, events, AI isolation, integration examples, and limitations.

## P0 asset contract

The P0 machine-readable source of truth is [`asset-contract.json`](asset-contract.json) (v1.0.0).

- Card manifest: `public/assets/meowdeck/cards/manifest.json`
- Base atlas: `public/assets/meowdeck/cards/spritesheets/cards_atlas.png`
- HD atlas: `public/assets/meowdeck/cards/spritesheets/cards_atlas@2x.png`
- Mochi manifest: `public/assets/meowdeck/mochi/animations.json`
- Sprite sheets: `public/assets/meowdeck/mochi/sprites/`
- Original art digests: `asset-digests.json`

The playing deck has 52 cards, while the asset manifest also contains 2 Jokers and 1 card back (55 artwork IDs). Card dimensions are 96×144 (base) and 192×288 (HD). Mochi has 10 animation clips with 44 frames, specified in its manifest. The Next.js runtime uses these original assets in P2/P3; the headless P1 Engine never loads images.

## Development documentation

- [`MeowDeck.md`](MeowDeck.md) — full design specification
- [`docs/ASSET_CONTRACT.md`](docs/ASSET_CONTRACT.md) — P0 art metadata contract
- [`docs/ASSET_VALIDATION.md`](docs/ASSET_VALIDATION.md) — image validation
- [`docs/P1_CORE_ENGINE.md`](docs/P1_CORE_ENGINE.md) — P1 code and integration contract
- [`docs/P1_REPORT.md`](docs/P1_REPORT.md) — P1 verification and readiness

No gameplay UI, AI behavior tiers, deployment, or online services are provided by P1.

## P2 — Interactive Gameplay UI

P2 originally used React + Vite. **P2.5 migrates that same interface in place to Next.js App Router**, keeping P1/P3 game logic fully independent of React. To run the browser game:

```bash
npm install
npm run dev
```

Browser build and tests:

```bash
npm run typecheck:engine
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e                 # Next development server: deterministic fixtures
npm run test:e2e:production      # Next production server: hydration/assets smoke test
```

P3 adds distinct **Practice / Easy / Normal / Hard** opponents and manifest-driven Mochi sprite animations, without changing Crazy Eights rules. Save/Resume across refresh, statistics and audio remain P4. See `docs/P2_GAMEPLAY_UI.md` and `docs/P2_REPORT.md`.

## P3 — Fair Mochi AI and production animation

The UI can now select Easy, Normal, Hard or Practice. AI policies only see `createAIObservation(state)`; only the original controller can call `applyAction`. `Mochi.tsx` renders 10 original P0 sprite clips at their manifest-defined frame durations, and public P1 events drive presentational animation and card flights. Reduced Motion bypasses decorative playback.

```bash
npm run benchmark:ai   # 1,000 seeded matches per difficulty
npm run test:e2e       # P2 regression + P3 difficulty and animation checks
```

See [`docs/P3_MOCHI_AI.md`](docs/P3_MOCHI_AI.md) and [`docs/P3_REPORT.md`](docs/P3_REPORT.md). No original art or rules have been altered.

## P2.5 — Next.js migration (current runtime)

- App Router entry: `src/app/layout.tsx` (Server Component), `src/app/page.tsx` (Client Component boundary via `src/web/App.tsx`). Original gameplay stays in `src/web/`; pure engine/AI/animation clocks stay in `src/games/meowdeck/`.
- `tsconfig.engine.json` is the original NodeNext headless engine config; `tsconfig.json` is Next's browser and App Router config. `dist/` remains separate from `.next/`.
- `qaSeed` / `fastAI` work **only** in `next dev`. Production builds ignore these query parameters. Use the separate production E2E smoke test for `next start` rather than exposing development fixtures in production.
- UI/engine assets remain at `/assets/meowdeck/*` in the Next `public` directory, and are not processed by image optimizers.
- No server-side game rules, remote API, database, save backend, audio or PWA changes were introduced.

**Important reproducibility gate:** This migration source was prepared in an environment without access to the npm registry. Before merging, run `npm install` with registry access to generate **and commit** `package-lock.json`, then run `npm ci` and all CI/browser tests. Do not interpret the local headless validation alone as Next.js build verification.

See [migration guide](docs/P2_5_NEXTJS_MIGRATION.md) and [verification report](docs/P2_5_REPORT.md).


## P4 — local persistence, statistics, audio and installable offline-first PWA candidate

P4 source lives in `src/web/storage`, `src/web/statistics`, `src/web/settings`, `src/web/audio`, `src/web/pwa` and the App Router manifest. The project now includes an original synthesized sound engine and a build-aware, custom service worker. The original P0–P3 assets and game rules are unchanged.

**Status:** P4 local implementation with **54/54 Node tests passed**; Next.js production build and browser/offline acceptance are **NOT VERIFIED** until dependencies and a production browser runner are available. Do not deploy as offline-ready solely from this source package. See `docs/P4_REPORT.md`.

```bash
npm ci
npm run typecheck
npm test
npm run validate:assets
npm run build
npm run test:e2e
npm run test:e2e:production
```

The build emits `public/sw.js` and `public/offline-precache.json` from the actual Next.js build ID. For development, PWA registration is disabled; test offline behavior in production mode.
