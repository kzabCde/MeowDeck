# MeowDeck P2.5 — Framework Migration Verification Report

## A. Migration summary

**Repository:** `kzabCde/MeowDeck`; upstream `main` commit `1d8aa53d9e34d3fb1dd9f41286947cb8694974eb` at the audit.

**Prepared framework:** Next.js 16.4.6, React 19, TypeScript strict, App Router, Next's supported Webpack mode (required for original NodeNext `.js` imports to `.ts` source). Vite application tooling and entry points are removed from this prepared local source tree. No GitHub push/PR/merge or Vercel deployment performed.

**Status: PARTIAL — pending Next.js installation, lockfile, production build, browser E2E and hydration validation.**

## B. Architecture and source changes

**Created:**
- `src/app/layout.tsx` — Server Component and metadata/HTML.
- `src/app/page.tsx` — App Router page rendering the original client App.
- `src/app/globals.css` — small new global base; original CSS remains.
- `next.config.ts` — Webpack extension alias for NodeNext ESM import compatibility.
- `tsconfig.engine.json` — preserved original P1/P3 headless TypeScript build.
- `playwright.production.config.ts` — Next production server regression configuration.
- `e2e/production.spec.ts` — live hydration, assets, navigation, mobile smoke tests.
- `tests/migration.test.mjs` — migration structure and unchanged-image fingerprint assertions.
- `docs/P2_5_NEXTJS_MIGRATION.md`, `docs/P2_5_REPORT.md` — developer guide and evidence.

**Modified:**
- `src/web/App.tsx` — `'use client'` and hydration-safe initialization of media preferences and development-only QA flags.
- `src/web/components/Screens.tsx` — update footer version string.
- `src/web/styles.css` — remove obsolete `#root` selector; retain all original pixel UI styling.
- `package.json` — Next 16.4.6 and Next scripts, React 19, testing scripts, no Vite.
- `tsconfig.json` — Next client and App Router TypeScript configuration.
- `playwright.config.ts` — development E2E server migrated to Next port 3000.
- `.github/workflows/validate-ui.yml` — Next build, dependency lock, core/AI/P0 tests, dev and production E2E.
- `.github/workflows/validate-engine.yml` — run independent `typecheck:engine` and `npm ci`.
- `.gitignore`, `README.md`, `MeowDeck.md` — clean tooling references and document current platform.

**Deleted:** `vite.config.ts`, `index.html`, `src/web/main.tsx`, `tsconfig.web.json`.

**Unchanged:** all `src/games/meowdeck/**` files, all original card and Mochi artwork, animation/card manifests, P0 asset contract, original P1/P2/P3 tests, their historical reports, and P0 validation script.

## C. Regression verification — actually executed

| Gate | Baseline Vite at commit above | Prepared Next source | Evidence |
|---|---|---|---|
| NodeNext typecheck | PASS | **PASS** | `npm run typecheck:engine` |
| Core/AI/animation unit tests | 39/39 PASS | **39/39 + 6 migration tests = 45/45 PASS** | `npm test` |
| Full match simulation | PASS | **PASS** | `npm run test:simulation`; seed 73, 55 actions/3 rounds |
| Production PNG checks | 1,549/1,549 PASS | **1,549/1,549 PASS** | `npm run validate:assets` |
| Asset SHA-256 integrity | PASS | **122/122 PNGs unchanged** | `tests/migration.test.mjs` |
| Deterministic AI benchmark | Baseline previously verified | **PASS** | 3,000 matches, seeds 1..1000 per level |
| Modified TS/TSX syntax | Not a runtime check | **30 parsed; 0 syntax errors** | Local TypeScript `transpileModule` parse only |
| Next.js App Router typecheck | N/A | **BLOCKED** | `next` binary not installed; npm registry DNS `EAI_AGAIN` |
| Next.js production build | N/A | **BLOCKED** | Cannot install `next@16.4.6` and dependencies |
| Next Playwright development E2E | Previous P2/P3 CI green | **BLOCKED** | No installed Next/React/Playwright runtime and browser test server |
| Next Playwright production E2E | N/A | **BLOCKED** | Requires Next production build first |
| Production lockfile and `npm ci` | No existing lockfile | **BLOCKED** | Cannot resolve new npm dependencies; do not create a fabricated lockfile |
| Vercel deployment | Not in scope | **NOT ATTEMPTED** | No deploy authorization |

All 45 local tests are real executions. They cannot substitute for the blocked Next and Playwright integration checks.

## D. AI benchmark regression

Local deterministic run `npm run benchmark:ai`, each mode against the same practice baseline, 1,000 seeds per mode:

| Mode | Wins | Losses | Draws | Win rate |
|---|---:|---:|---:|---:|
| Easy | 423 | 577 | 0 | 42.3% |
| Normal | 445 | 555 | 0 | 44.5% |
| Hard | 472 | 528 | 0 | 47.2% |

This matches the original P3 benchmark outcomes, confirming that no strategy code or seeds were modified. Absolute elapsed times are machine dependent and not evidence of faster Next.js browser performance.

## E. Performance and hydration

No new JS bundle-size, page-load, browser timing, or frame-rate measurements have been obtained; none are claimed. The existing P3 rAF animation and sprite caching code was retained. SSR/hydration risks were addressed by moving first-render `window.matchMedia` and QA URL reads to effects or handlers. The production Playwright smoke test includes browser console/page error checks, but has **not yet run**.

## F. Remaining blockers and release gates

1. With npm registry access, run `npm install`, inspect dependency versions, and **commit the generated `package-lock.json`**. The CI workflow intentionally requires `npm ci` and will fail until this exists.
2. Run `npm run typecheck`, then `npm run build` (Webpack mode). Resolve any real Next/React incompatibilities without changing game rules or P0 assets.
3. Run dev E2E (`npm run test:e2e`) and production smoke (`npm run test:e2e:production`). Fix verified failures and retain all original test coverage.
4. Inspect the six original viewports, short landscape, 200% browser zoom, and potential hydration/Strict Mode double-command behavior manually.
5. Record build/bundle/performance measurements and compare with the original P2/P3 pipeline, if accessible.
6. Only after successful verification and explicit permission, open a PR against `main`; do **not** merge or deploy before approval.

## G. P4 readiness

No browser save, permanent statistics, persistent settings, sound, PWA or offline service worker was added. Once P2.5 runtime verification is green, the App Router client/game boundary remains suitable for these independent P4 integrations without changing P1 engine authority.
