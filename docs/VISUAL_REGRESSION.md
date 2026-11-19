# Phase 13 — Visual Regression Testing

## Source of truth and baseline approval

The user-supplied Master Prompt requires **15 screenshot states**, desktop and mobile layout checks, and investigation of visual differences. This phase reuses the original running Next.js application, existing 52-card art, and original Mochi sprites. It does **not** render mock game boards or inject fabricated gameplay outcomes.

`e2e/visual-baselines/p13-reviewed-phase12.json` is a **fixed reviewed reference** derived from the actual [Phase 12 production screenshot artifact](https://github.com/kzabCde/MeowDeck/actions/runs/44467286619/artifacts/14501879359) on commit `67f96095`. The 390×844 snapshots from that artifact were reviewed for Phase 12. Baselines are *not* automatically generated or updated by Playwright.

`e2e/p13-visual-baseline.spec.ts` compares the real PNG pixels at the same 390×844 size against a coarse, stable **4×6 grid of 8×8 sampled RGB points** per zone. This checks large changes to layout, palette, visual hierarchy and typography while tolerating legitimate variations in dealt cards/Mochi frames. The JSON records the source PNG names and commit. It intentionally does not claim a pixel-perfect screenshot match.

`e2e/p13-visual-states.spec.ts` takes detailed **actual screenshots of all 15 states**, including legal state-machine AI turn, suit modal, full round completion, Blackjack action/result, and an actual persistence-unavailable warning by blocking IndexedDB in a dedicated test page. Most states are captured at **320×568, 390×844 and 1280×800**; the fleeting AI turn is captured at 390×844, and English/landscape at 667×375. Do not manipulate scores or cards to create screenshots.

`scripts/verify-visual-review.mjs` ensures 15/15 required 390×844 screenshots are valid PNGs and all five baseline reports exist with the approved source commit. CI uploads the screenshot matrix as `meowdeck-phase13-visual-states` *before* the next Playwright invocation can clean `test-results`. The existing production screenshots are separately uploaded as `meowdeck-visual-review`.

## Mandatory review matrix

| No. | Screen/state | Screenshot key |
| --- | --- | --- |
| 01 | Main Menu | `01-main-menu` |
| 02 | Game Selection | `02-game-selection` |
| 03 | Difficulty Selection | `03-difficulty-selection` |
| 04 | Crazy Eights — Player Turn | `04-crazy-player-turn` |
| 05 | Crazy Eights — AI Turn | `05-crazy-ai-turn` |
| 06 | Crazy Eights — Suit Selection | `06-crazy-suit-selection` |
| 07 | Crazy Eights — Round Result | `07-crazy-round-result` |
| 08 | Blackjack — Initial Hand | `08-blackjack-initial` |
| 09 | Blackjack — Player Action | `09-blackjack-player-action` |
| 10 | Blackjack — Round Result | `10-blackjack-round-result` |
| 11 | Settings | `11-settings` |
| 12 | Rules | `12-rules` |
| 13 | Pause | `13-pause` |
| 14 | Statistics | `14-statistics` |
| 15 | Save Error State | `15-save-error` |

## Layout review criteria

Review at the recorded viewport size. Check horizontal/vertical alignment, pixel font crispness, Thai and English wrapping, button consistency, CSS token palette, card readability, backdrop and panel overlap, hit-target reachability, dialog clipping, safe areas, meaningful contrast and visual hierarchy. A successful automated comparison **does not** replace screenshot review by a human or real-device Safari/Android inspection.

## Run locally

```bash
npm ci
npx playwright install chromium
npm run test:visual
```

Existing full validation remains `npm run typecheck`, `npm test`, `npm run validate:assets`, `npm run build`, `npm run test:e2e`, `npm run test:e2e:cross-browser`, and `npm run test:e2e:production`. Production builds **never** honor seeded QA flags.

## Unexpected difference policy

1. Inspect the PNG and `p13-baseline-*-report.json` for the specific state/zone.
2. Confirm fonts, viewport, sprite/image loading, locale, motion and real game state.
3. Fix an actual regression in the owning CSS/React module, then rerun tests.
4. Only if the design change is intentional, review a new **production** screenshot and manually approve a change to the reference manifest in a separate documented PR. Do **not** change tolerance or run a blanket `--update-snapshots` to make the test green.
5. Block release on missing states or visible clipping/overlap even if RGB signatures pass.

No file in this phase changes game rules, AI fairness, saved-game structure or service-worker behavior.
