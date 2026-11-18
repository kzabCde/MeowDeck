# MeowDeck — A Little Cat. A Clever Deck.

**MeowDeck is an offline-first Next.js 16 / React 19 pixel-art Crazy Eights game against Mochi.** P0 production cards and cat sprites, P1 authoritative rules, P2 responsive gameplay, P3 fair AI, and P4 local save/statistics/audio/PWA are implemented. P4.5–P4.9 polish is staged in separate reviewed PRs; verify the current branch and CI before calling any phase released.

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

P1 is deliberately headless; the runtime UI, AI tiers and offline systems are implemented in later layers. No online game service is required.

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

P3 adds distinct **Practice / Easy / Normal / Hard** opponents and manifest-driven Mochi sprite animations, without changing Crazy Eights rules. P4 adds Save/Resume across refresh, statistics, audio and offline PWA. See `docs/P2_GAMEPLAY_UI.md` and `docs/P2_REPORT.md`.

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

**Reproducibility gate:** Use the committed `package-lock.json`, run `npm ci`, build the production app, and require the PR's Node/Playwright CI checks. Development-only seeded fixtures are intentionally unavailable in production.

See [migration guide](docs/P2_5_NEXTJS_MIGRATION.md) and [verification report](docs/P2_5_REPORT.md).


## P4 — local persistence, statistics, audio and installable offline-first PWA candidate

P4 source lives in `src/web/storage`, `src/web/statistics`, `src/web/settings`, `src/web/audio`, `src/web/pwa` and the App Router manifest. The project now includes an original synthesized sound engine and a build-aware, custom service worker. The original P0–P3 assets and game rules are unchanged.

**Status:** P4 was integrated and automated Next.js build/Chromium/production-offline checks passed in the P4 follow-up and V4 PRs. P4.5–P4.9 require their own current CI and manual release gates. The original dated P4 report is a historical implementation snapshot, not a present-day release status. Do not claim physical iOS/Android PWA verification without a real device test. See `docs/P4_8_RELEASE_QA.md` and `docs/P4_9_BETA_READINESS.md`.

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


## P4.5–P4.9 — Game-first refinement

The core rules, original card/Mochi assets, local save schema, and fair AI observation boundary remain authoritative.

- **P4.5:** Thai-safe display typography, consistent mobile labels and a refined pixel cardroom.
- **P4.6:** Main → Difficulty → Match, optional contextual in-table tutorial, selectable cards, Thai/English.
- **P4.7:** Short pixel VFX tied to committed card events, restrained synthesized audio and reduced-motion handling.
- **P4.8:** Keyboard/touch accessibility, short-landscape scrolling, mobile errors, cross-browser smoke, PR and main UI CI.
- **P4.9:** Reproducible paired-seed AI assessment, conservative Hard-policy tuning, current release checklist and beta-playtest plan.

```bash
npm ci
npm run typecheck
npm test
npm run benchmark:ai
npm run evaluate:ai
npm run validate:assets
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
npm run test:e2e:cross-browser
npm run test:e2e:production
```

**Release policy:** Automated tests and desktop WebKit/iPhone emulation are not real Safari/Android device acceptance. Until manual device testing and gameplay review are signed off, treat this as a **Public Beta candidate**, not an unrestricted production release. PRs are created separately and not automatically merged/deployed.

See [P4.5 visual audit](docs/P4_5_VISUAL_AUDIT.md), [P4.6 interactions](docs/P4_6_INTERACTION_REPORT.md), [P4.7 game feel](docs/P4_7_GAME_FEEL.md), [P4.8 release QA](docs/P4_8_RELEASE_QA.md), and [P4.9 beta readiness](docs/P4_9_BETA_READINESS.md).
