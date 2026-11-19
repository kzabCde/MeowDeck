# MeowDeck CSS architecture — Phase 11

The earlier cascade mixed **31 KB of legacy CSS** with **31 KB of later overrides**, plus two separate screen files. Unused first-generation home scenes, game tiles, difficulty cards and speech widgets were still present alongside the currently rendered UI. Legacy global card/button animations also conflicted with the pixel-step visual system.

## Import order (authoritative in `src/app/layout.tsx`)

1. `design-system/tokens.css` — semantic palette, typography and motion tokens.
2. `design-system/base.css` — reset, active structural base, sprite/fallback support, settings and accessibility.
3. `design-system/controls.css` — canonical shared button, native dialog and result/stat components.
4. `scenes/title.css` — title screen, including screen-specific responsive layout.
5. `scenes/crazy-eights.css` — table/HUD, full-card hand, committed cues, action rail and screen breakpoints.
6. `scenes/blackjack.css` — dealer/player scene, score, controls and screen breakpoints.
7. `scenes/selection.css` — game-mode and difficulty scenes with breakpoints.
8. `responsive.css` — cross-screen Safe Area and very short viewport adjustments.

Screen-specific breakpoint rules stay next to their owning scene; the final shared responsive layer only handles cross-screen device geometry. No `@import` chains or new dependency.

## Removed and consolidated

- Pruned **145 obsolete CSS rules** and simplified **4 grouped selectors**, after checking every `src/web` screen component. Removed unused hero-menu art, older game/difficulty card grids, decorative speech, and unused legacy settings selectors.
- Moved the pixel button appearance to `controls.css` and removed the legacy smooth button hover/press definitions. Retained `white-space:nowrap` for the canonical control.
- Removed the older global `.card-tile.is-selected!important` and overlap-based hover. Current Crazy Eights card selection is owned by its screen; `transform-origin` and card scroll snapping were carried forward.
- Semantic styling roots: `.title-screen`, `.crazy-eights-room`, `.blackjack-room`, `.selection-screen`, `.game-choices`, and `.difficulty-screen`. Existing `md4-*`/`md5-*` names remain **only as JSX compatibility aliases**. Child classes and test IDs were intentionally not broadly renamed.
- The old `styles.css`, `art-direction.css`, `blackjack.css` and `selection.css` root files are deleted; there is only one active import path per concern.
- Retained desktop selection minimum height where wide landscape previously won the cascade, plus compact phone selection height.

## Regression expectations

Keep visual and behavioral parity at 320×568, 375×667, 390×844, 430×932, 768×1024, 1280×800, 1920×1080, and compact landscape. Validate both languages, card tap/scroll, keyboard focus, reduced motion, dialogs, Mochi cues, save/restore, PWA offline, and actual production screenshots. New adjustments must go into their owning file, not be stacked as global emergency overrides.
