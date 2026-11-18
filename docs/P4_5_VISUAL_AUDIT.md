# MeowDeck P4.5 — Visual foundation refinement

Baseline: `main` commit `9b1b9648` (V4 PR #8).

## Findings

- V4 uses a canonical `art-direction.css` layered after the older `styles.css`; the old stylesheet still owns active dialogs and statistics layouts, so deleting it without a complete selector audit would risk regression.
- Screenshot QA hotfixes were duplicated at the end of V4 CSS, overriding earlier font sizes and mobile rules.
- Display headings and Thai gameplay labels mixed Trebuchet, Courier New and unrelated fallback families.
- The current main menu, selection art, cards and Mochi sprites should be retained, not rebuilt into a new dashboard.
- Silent autosave and offline success states were already implemented in V4; real errors must remain accessible.

## Changes

- Define deliberate Thai-safe UI and retro display font tokens.
- Fold the trailing screenshot font fixes into the base and mobile rules. Avoid another postscript override cascade.
- Keep disabled card faces and draw pile legible.
- Ensure compact mobile game actions have at least 44px height.
- Preserve short-height Mochi scaling in the existing media query.
- Add Playwright tests for clear Play action, typography, compact HUD labels and overflow at 320/390/430px.

## Non-goals and risk

No new art, rule changes, save changes, AI changes, or PWA changes. Further changes to mobile table composition should follow real screenshot comparisons; this first PR avoids unverified large layout rewrites.

## Verification

Run `npm ci`, `npm run typecheck:engine`, `npm run typecheck`, `npm test`, `npm run validate:assets`, `npm run build`, `npm run test:e2e`, and `npm run test:e2e:production` in CI. Review the uploaded `meowdeck-visual-review` screenshot artifact before approving.

No local build, manual iOS/Android review or artistic sign-off is claimed from this PR creation.
