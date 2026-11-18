# Unified Card Room UI — Design Audit and implementation record

## Audited sources
`src/web/styles.css`, `src/web/art-direction.css`, `src/web/blackjack.css`,
`src/web/components/Screens.tsx`, `GameTable.tsx`, `BlackjackGame.tsx`,
`GameDialog.tsx`, `src/web/App.tsx`, `src/web/i18n.ts`, Next.js layout and Playwright tests.

## Findings
- Base CSS and two subsequent art-direction layers independently declared colors, button styles and typography.
- The title, game catalog and results contained repeated suit symbols, faux menu numbering and decorative labels.
- Crazy Eights and Blackjack used substantially different felt shades, borders, table radii, footers and score fonts.
- Latin display, Thai controls and secondary copy used incompatible type families in different screens.
- The main game error feedback exposed raw internal error codes to players.

## Implemented in this branch
1. Introduced **semantic palette and type tokens** in `src/web/design-system/tokens.css`; existing `--md4-*` variables remain aliases for compatibility.
2. Standardized primary/secondary buttons and focus-visible behavior in the existing art-direction stylesheet.
3. Unified felt, wood-edge, header, control rail and dialogue materials between both modes, retaining different layouts for their different rules.
4. Converted the game selection into an illustration-led choice rather than two high-shadow application tiles.
5. Removed unnecessary ornamental suit rows, numbered headings and faux result emblems without removing functional labels.
6. Replaced engine error-code feedback with short localized rejection text.
7. Kept onboarding hints, save failures, cross-tab conflict warnings, animation, PWA and offline behavior.
8. Added end-to-end tests to assert shared palette, typography, buttons and table materials.

## Deliberate boundaries
- No changes to rules, AI, deck assets, Mochi sprites, synchronization, audio, IndexedDB or localStorage formats.
- No external font downloads: local Thai-safe fallbacks protect offline PWA behavior. Shipping a custom pixel/Thai font requires separate visual and license review.
- The visual consistency checks are **automated contract checks**, not screenshot-based artistic signoff.

## Validation and manual review
CI should run `npm run typecheck`, `npm test`, `npm run validate:assets`, `npm run build` and the complete Playwright suites.
Manual screenshots are still required at 320×568, 390×844, 430×932, 768×1024, 1280×800 and 1920×1080, with Thai/English content and 200% zoom. Review Menu, Game Selection, Difficulty, both table states, Settings, Dialogs, Statistics and game results.

Do not merge or deploy without explicit project-owner authorization.
