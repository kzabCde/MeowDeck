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

## Phase 3: Shared controls and settings polish
- Added typed `GameButton` component for actions across Menu, Difficulty, Crazy Eights, Blackjack and `GameDialog`. All existing `data-testid` and ARIA semantics are preserved; custom card tiles remain native buttons.
- Unified the modal close button and ensured a 44×44 touch target.
- Restyled Settings as concise, full-width native controls: readable Thai labels, 44px selects and sliders, pixel-step switches, consistent separators and restrained accents.
- Moved Settings styling into one authoritative block in `styles.css` and removed the duplicate `art-direction.css` override.
- Added Playwright coverage for Settings controls, toggle behavior and dialog close target.
- The failing CI run on the previous commit was caused by the unintended Settings→Pause return change. Reverted that behavior in `e35b6e8`; all workflow jobs passed before this next-phase work began.

## Phase 4 — Play-first title screen
- Reworked `MainMenu` into a responsive composition: logo and primary action adjacent to the Mochi card-room scene on desktop, and logo → Mochi → Play on mobile.
- Replaced the ornamental halo and backdrop grid with a crisp, stepped wooden card-room alcove and felt table made entirely with CSS and existing card/Mochi assets; no remote graphics, fake counters, badges or invented storyline.
- Removed the passive `CARD ROOM` edition label; Rules, Settings, Play, optional Continue and Statistics remain functional with the existing localized copy.
- Moved the title-specific responsive rules next to the title scene's authoritative CSS declarations rather than adding new override layers.
- Added six viewport E2E checks for visible Play, the Mochi image, card loading, 44px action size and horizontal overflow, plus direct navigation checks.
- Manual screenshot-based composition review, actual Thai glyph quality, and real iOS/Android PWA testing remain required for signoff.

## Phase 5 — Game Selection & Difficulty Redesign
- Consolidated both choice screens into `src/web/selection.css`, removing unused `md4-game-token` styles and legacy game-choice declarations in `blackjack.css`. No extra override layer was added over the old styles.
- Game Selection now offers two equally tappable in-world felt-and-wood tables with the original 52-card sprites, an emphasized hover/focus state and a vertically balanced responsive composition.
- Difficulty selection keeps the real Practice/Easy/Normal/Hard opponents, displays Mochi beside a 2×2 choice grid on desktop and above it on mobile. Active state is communicated through both a gold indicator and `aria-pressed`.
- Removed the decorative `MEOWDECK / 01` numbering. Both Thai/English copy and the existing game flow remain intact.
- Added compact/desktop E2E checks, keyboard navigation and production screenshots for Game Selection and Difficulty, including 320×568.
- No changes to gameplay engines, AI decision policies, card sprites, saved data, animations or PWA.
- Complete visual signoff still requires reviewing the generated screenshots and testing on real devices.

## Phase 6 — Gameplay HUD and Table Polish
- Crazy Eights now groups two visible score pairs with tabular numbers and moves the round indicator into the mobile HUD instead of overlaying the felt. Pause remains a 44×44 touch target.
- Both live tables reference shared felt, trim, HUD and action-rail materials from `design-system/tokens.css`; Blackjack still uses its own dealer/player layout and outcome rules.
- Blackjack hands now use balanced vertical distribution rather than the large dead center zone. Score bar, numeric total chips, buttons and rail framing match the card room materials.
- Improved physical-card affordances, mouse/keyboard focus outlines and scroll indicators without altering card assets, AI, play action handlers or animations.
- Functional tutorial, save warning, error and restart confirmation content is retained; generic decorative feedback is not added.
- Source view-state, engine, persistence and save schemas are unchanged.
- Phase 6 screenshot evidence is now generated for Crazy Eights and Blackjack at 320×568, 390×844, 430×932, 768×1024, desktop 1280×720, and 1920×1080. Playwright checks that HUD numbers, round labels, hands and key actions stay visible and that both tables remain separated from the control rails. These behavioral/geometry tests complement, but do not replace, human visual inspection.

## Phase 7 — Mochi Animation & Character Interaction Polish
- Kept all 10 existing sprite clips, 44 frames, manifest frame durations, 96×96 frame dimensions and anchor coordinates unchanged.
- Fixed the animation hook so pausing **freezes** the current clip clock without resetting its action frame, and resuming continues rather than replaying an already committed cue.
- Fixed ambient Sleep becoming permanent: after the existing 18-second idle threshold, a brief nap wakes back to Idle; sleeping/ambient blink do not progress while paused or in a hidden tab.
- Restrained ambient blink/sleep to Idle, with randomized natural blink intervals; no speech bubbles or routine notification text added.
- The game controller now accepts pet interactions only on a human turn without queued presentation cues and plays the pet SFX only when a reaction is actually enqueued, rather than making an empty sound on rejected taps.
- Original cue IDs and presentation queue logic remain authoritative. No changes to card state, AI, persistence, animation metadata or audio assets.
- Corrected a second cue synchronization issue: if the authoritative game phase changes from AI thinking to a terminal result during an active action cue, the hook retains the existing action clip until its committed action frame and then resolves to the latest pose; the old effect restarted it unnecessarily.
- Blackjack now supports the same optional pet interaction using the existing `pet_reaction` sprite, without a speech bubble, save mutation or false dealer draw animation. Petting is disabled on finished rounds, active reactions, conflict warnings and dialogs; Hit/Stand and new-round actions always take precedence.
- Phase 7 adds live Playwright verification of paused pet frames (no replay), game-state-neutral pet interactions in both card modes, reduced-motion behavior, and a virtual-clock idle nap that returns to Idle. Captures two real pet-reaction screenshots without speech bubbles.
- The same Reduced Motion setting is now passed to Mochi in the Main Menu and Difficulty preview, not only live Crazy Eights/Blackjack: decorative previews no longer animate against the player's preference.

## Phase 8 — Remove Generic AI-Looking UI

### Copy inventory and decisions
| Category | Keep / change |
|---|---|
| 1. Required gameplay | Preserve turn, round, score, dealer total, current suit, deck count, legal actions, actual outcomes and real statistics. |
| 2. Required action instructions | Preserve pending-draw decision, pass-turn instructions, concise game rules and appropriate confirmations. Ordinary draw text no longer repeats the available Draw button. |
| 3. Important feedback/errors | Preserve save failures, unavailable storage, PWA cache failure, tab ownership conflict, corrupt-save recovery and Blackjack cross-tab warnings. Distinguish settings/statistics errors from match-save errors. |
| 4. Optional tutorials | Keep the existing dismissible and replayable tutorial. Do not discard first-time instructions. |
| 5. Redundant/decorative | Remove duplicate round-complete prose in the action rail, needless ambient status announcements, decorative loading stars, duplicate modal body text, bilingual hardcoded loading error and extra blackjack brand label. |

- Loading and asset-error copy now follows the selected language, including a functional retry button; no mixed English/Thai string.
- Shortened game descriptions and AI difficulty explanations without inventing character lore or changing gameplay semantics.
- The leave confirmation now accurately explains that an unfinished match can be reopened from the main menu (rather than claiming it remains in volatile memory only).
- Routine successful saves and offline readiness remain silent. Error banners are single live alerts, not nested in another live status region; no hidden "Paused" announcement is emitted on every game result dialog.
- An idle Crazy Eights action-status container has no text or live-region role. Conditional tutorial, warning, pending-draw and no-draw instructions remain available.
- All visible gameplay terminology remains localized to Thai/English. No fake player count, badge, review, invented lore, or unnecessary decorative metric was introduced.
- Phase 8 regression coverage: default game is silent after tutorial dismissal and successful saves; tutorial replay remains functional; missing card manifest displays exactly one localized error with a Retry action in Thai/English; simulated settings-storage failure reports its true cause rather than a match-save failure; no unnecessary ambient status text appears on the menu. Production E2E captures an uncluttered 390×844 gameplay frame.

## Phase 9 — Mobile-First Responsive Gameplay
- Matched the Master Prompt's required 320×568, 375×667, 390×844, 430×932, 768×1024, 1280×800 and 1920×1080 target sizes, plus compact landscape viewports and zoom-equivalent CSS dimensions.
- **Full card hit areas on mobile:** removed the negative-margin card overlap that made neighboring Crazy Eights cards intercept taps. Each 50–69px-wide button retains its own surface, with native horizontal hand scrolling when the cards do not fit. A short localized hand-scroll cue appears **only when measured overflow exists**; this is actionable guidance, not routine status narration. Keyboard arrow navigation scrolls the focused card into view.
- **PWA/notch:** Next.js viewport metadata uses `viewportFit: 'cover'`. The title, selection, gameplay headers, Blackjack scorebar, and both action rails use genuine CSS `env(safe-area-inset-*)` values; no artificial browser height measurements, new remote assets or service worker changes.
- **Compact landscape:** natural vertical page scrolling remains available for content that cannot fit into a 375px-tall CSS viewport; gameplay action rails stay sticky, and compact game/difficulty selection uses landscape-friendly two-column scenes. Dialogs scroll within the available viewport, including Safe Area.
- **Legible content:** preserve score, active suit, turn, deck/discard, opponent count, cards, and all functional warnings. Decorative spacing, not gameplay content, is reduced first.
- All original game and AI mechanics, card/Mochi sprites and save schemas remain untouched. Landscape touch/scroll, 200% browser zoom, stand-alone iOS/Android, and physical-device notch behavior require final real-device testing in addition to CI.
- Phase 9 CI adds real Playwright geometry and touch tests across all required 7 widths, 2 landscape configurations, and a zoom-equivalent 640×360 layout. Assertions cover separate card hit areas, native hand scroll/reachability, localized overflow-only affordance, buttons, score/turn/active suit, short-screen dialog scroll, orientation-resize persistence, viewport-fit metadata and standalone manifest. Production screenshots include portrait/landscape Crazy Eights, Blackjack, menu and a landscape rules dialog.
