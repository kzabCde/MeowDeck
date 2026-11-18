> **Historical P4 document (2026-11-17).** Its local BLOCKED/NOT VERIFIED claims describe the environment at the time of drafting, not the merged P4+V4 CI state. For present build/offline checks and outstanding manual devices, see [P4.8 Release QA](P4_8_RELEASE_QA.md) and [P4.9 Beta Readiness](P4_9_BETA_READINESS.md). The original findings below are retained as historical evidence.

# P4 Implementation Report — VERIFIED / BLOCKED (2026-11-17)

## A. Baseline
- Repository: `kzabCde/MeowDeck`; actual `main` HEAD: `32948b40f4db0a25fb7ed01e3f4ea7694175b70a` (P2.5 merged).
- `package.json`: Next.js `16.4.6`, React 19, TypeScript, Next.js Webpack/NodeNext compatibility, P0–P3 present.
- Local initial code copied from the checked P2.5 full-source working tree; original approved art remains unchanged.
- No Git push, PR, merge or deployment in this P4 task.

## B. Persistence
- Versioned envelope and strict runtime validation: `src/web/storage/save-schema.ts`.
- Native IndexedDB object stores with CAS revision checks, per-tab owner lease, serialized controller writes, atomic completed-record insertion: `src/web/storage/database.ts`.
- Restore, Continue, pending draw/AI turn, `round_end` presentation, action-sequence reuse protection and save indicator: `src/web/App.tsx`.
- Corrupted/unsupported saves are rejected; no invented private cards, no external database.

## C. Statistics
- `src/web/statistics/statistics-service.ts` and `src/web/components/StatisticsPanel.tsx` implement match counts, wins/losses, win rate, round counts, draw counts, streaks, difficulty breakdown, recent matches and independent reset.
- Completed match unique key: P1 `sessionId`. Terminal record insertion and active-match removal are one storage transaction.

## D. Settings & audio
- `src/web/settings/settings-store.ts`: versioned browser-local TH/EN, preferred difficulty, system/on/off motion, sound/music toggles and independent volumes.
- `src/web/audio/audio-manager.ts`: original procedural Web Audio SFX plus an original minimal ambient melody, user-gesture gating, visibility handling, event dedupe. No downloaded audio assets or library.
- Localization extended in `src/web/i18n.ts`.

## E. PWA
- `src/app/manifest.ts`; `public/icons/*.png` (192, 512, maskable 512, Apple 180, favicon).
- `scripts/build-offline.mjs` and `scripts/sw.template.js`: build-aware precache, cache-complete readiness, offline navigation fallback, safe updates, retaining prior caches.
- `src/web/pwa/service-worker-register.ts`: nonintrusive install/update/status UX.
- Generated `public/sw.js` and `public/offline-precache.json` are build artifacts and must be deployed with the Next.js production bundle.

## F. Verification performed in this environment

| Test | Evidence | Result |
|---|---|---|
| Engine TS | `npm run typecheck:engine` | PASS |
| P4 browser-independent TS | `npm run build:p4` | PASS |
| Node unit & contract tests | `npm test` | **54/54 PASS** (45 baseline + 9 P4) |
| Deterministic P1 full match | `npm run test:simulation` | PASS, seed 73, 55 steps |
| AI benchmark | `npm run benchmark:ai` | PASS, 1,000 matches per level; 42.3/44.5/47.2% Easy/Normal/Hard |
| Original art validation | `python scripts/validate_assets.py` | **1,549/1,549 PASS** |
| Generated offline manifest fixture | `tests/p4-build.test.mjs` | PASS: correct `/_next/static` paths (not a real Next build) |
| Five icon dimensions | Pillow PNG inspection | PASS: 192, 512, maskable 512, 180, 64 |
| TypeScript browser syntax | Local `transpileModule` and provisional type stubs | PARTIAL; **NOT** an official Next typecheck |
| Next.js typecheck | `npm run typecheck` | BLOCKED — package installation unavailable |
| Next.js production build | `npm run build` | BLOCKED — Next.js dependencies unavailable |
| Playwright UI/IndexedDB | `npm run test:e2e` | NOT VERIFIED — dependencies unavailable; Chromium local navigation also policy-blocked |
| Playwright production offline | `npm run test:e2e:production` / `npm run test:offline` | **NOT VERIFIED** — must run against an actual compiled production server |
| Vercel preview | No deployment authorized | NOT VERIFIED |

### Why browser checks are blocked
The local environment cannot resolve `registry.npmjs.org` (`EAI_AGAIN`) to install Next.js/React/Playwright JS dependencies. A locally installed Chromium binary rejects navigation to local HTTP and file URLs with `ERR_BLOCKED_BY_ADMINISTRATOR`. No green browser or offline test is claimed. The P4 Playwright tests are **implemented, not yet executed**.

## G. Files changed
- Created: `src/web/storage/{save-schema,database}.ts`, `src/web/statistics/statistics-service.ts`, `src/web/components/StatisticsPanel.tsx`, `src/web/settings/settings-store.ts`, `src/web/audio/audio-manager.ts`, `src/web/pwa/service-worker-register.ts`, `src/app/manifest.ts`, `scripts/{build-offline.mjs,sw.template.js,create-icons.py}`, 5 `public/icons/*.png`, `tsconfig.p4-test.json`, `tests/p4.test.mjs`, `e2e/{p4,offline}.spec.ts`, `docs/{P4_ARCHITECTURE,P4_REPORT}.md`.
- Modified: `src/web/App.tsx`, `src/web/components/Screens.tsx`, `src/web/i18n.ts`, `src/web/styles.css`, `src/app/layout.tsx`, `package.json`, `package-lock.json` (only root version), `.gitignore`, `.github/workflows/validate-ui.yml`, `playwright.production.config.ts`, `tests/migration.test.mjs`, `README.md`, `MeowDeck.md`.
- Deleted: no existing production files. Original P1/P3 rules, AI and source PNG files untouched.

## H. Risks / limitations
- **Release BLOCKER:** Real offline reopen/save/Continue against Next.js production build has not been executed; do not mark P4 complete.
- **Release BLOCKER:** Browser IndexedDB adapter, statistics idempotency across tabs and hydration not end-to-end verified.
- Build-time output of `public/sw.js` and `public/offline-precache.json` must be confirmed in deployed Vercel preview.
- IndexedDB/localStorage may be evicted or cleared. Leases and revisions handle normal conflicts; user must confirm takeover on another tab.
- Short landscape, iOS Safari Add to Home Screen, Chromium mobile emulation and 200% zoom require manual inspection.
- Animation speed control was intentionally deferred to avoid changing the original P0 `actionFrame`-synchronized animations.

## I. Release readiness
Code is implemented as a **local P4 candidate**. Headless tests pass, but **P4 acceptance is PARTIAL / BLOCKED** until 
`npm ci`, Next build, Chromium E2E and actual offline production reopen all pass. Not ready to merge or deploy. No push has occurred.
