# MeowDeck — P2 Gameplay UI Architecture

## Deliverable

A responsive React 19 + Vite 7 browser application that consumes the existing **P1 headless Crazy Eights Engine**. No rendering framework is required by the headless engine. The game uses the original P0 card PNGs and the first frame of Mochi's production sprite sheets. P3 will provide the full animation controller and three genuine AI difficulties.

## Run locally

```bash
npm install
npm run dev
npm run typecheck
npm run typecheck:web
npm test
npm run build:web
npx playwright install chromium
npm run test:e2e
python scripts/validate_assets.py
```

Open the Vite address (normally `http://localhost:5173`). `npm run preview` serves the production browser bundle after `npm run build:web`.

## Architectural boundary

```text
Browser UI / navigation (src/web)
  ├── Screens.tsx — menu, game selection, practice difficulty
  ├── GameTable.tsx — HUD, pixel cards, Mochi, legal-action affordances
  ├── GameDialog.tsx — native accessible modal dialogs
  ├── App.tsx — one synchronous UI action dispatcher, AI-turn presenter
  └── practice-opponent.ts — minimal legal-action driver (NOT P3 AI)
          ↓ sanitized AI observation / UI facade
    P1 selectors: getHumanView() / createAIObservation()
          ↓ validated commands
    P1 applyAction() — sole authority for hands, actions, turns, wins
```

`App.tsx` keeps **one** P1 `GameState` per current match; a React state value drives rendering, while a ref is synchronously updated before rendering to reject rapid repeated commands. Only `applyAction` can change the engine state. The `actionId` contains a session ID and monotonic local counter; P1 also validates `expectedTurnId`, ownership and legality. UI components do not implement any card rules.

### Hidden-information boundary

- The table receives `getHumanView(state)`, which contains public state and the human's own hand, **not AI card identities**.
- P2's basic opponent receives `createAIObservation(state)` and may only choose from its `legalActions`; it cannot inspect `humanHand` or `drawPile` identities.
- Draw effects and public notifications use the event/selector fields that do not leak unseen card identities.

### Correct Wild 8 and draw behavior

- P2 opens Suit Selector only when the Engine reports `play_card.requiresSuit=true`.
- Selecting a suit submits exactly one atomic `play_card` including `selectedSuit`; merely opening or cancelling the dialog never commits a move.
- The final 8 wins without a suit modal because `requiresSuit` is false.
- Draw is only offered when `getHumanView().legalActions` includes `draw_card`. If the drawn card is playable, only it and `finish_turn` remain legal. Otherwise P1 advances the turn automatically.

### AI practice mode

A deterministic, nonstrategic **legal-action driver** makes the P2 UI playable until P3. Only Practice is clickable; Normal/Hard are visibly disabled. AI presentation delay is handled in React and cancelled on pause or unmount; it never changes game rules. The practice driver is not represented as an advanced/easy/normal/hard AI implementation.

### Mochi (P2 static presentation only)

`Mochi.tsx` crops the **first frame** of an existing production sprite sheet and swaps among idle/thinking/victory/defeat according to public state. No GIF playback or frame-controller logic is included. `src/web/game/assets.ts` maps card artwork through the P0 manifest. P3 can supply an animation presenter without modifying game rules or rewriting the table.

### UI screens and affordances

- Main menu with Play, Continue (while session remains in memory), Settings, Rules, and Statistics P4 notice.
- Crazy Eights selection and disabled future game cards.
- Practice opponent selection, other AI difficulties marked unavailable.
- Game table with public score/round, face-down opponent cards, draw/discard piles, active suit, legal highlight, selectable human cards and action buttons.
- Modal for picking a suit, pause, settings, restart/leave confirmations and round/match results.
- Responsive card-scrolling on small screens, visible keyboard focus, arrow-key card focus navigation, `aria-live` turn announcements, native focus-trapping dialog, 44px-scale controls and Reduced Motion.
- Language can be switched between Thai and English in memory; P4 persistent settings, sounds, and statistics are explicitly deferred.

## Testing and known boundaries

- Existing engine and asset tests are unchanged.
- Browser E2E tests in `e2e/gameplay.spec.ts` cover app flow, legal action, full-match completion, pause/settings and six viewport sizes (320×568, 390×844, 430×932, 768×1024, 1280×720, 1920×1080). The browser suite runs under Chromium via the new GitHub Actions workflow.
- A dev-only QA fixture (`?qaSeed=73&fastAI=1`) gives reproducible deck shuffling and a short *presentation* delay, not access to private cards. It is disabled in production builds.
- Session state is **in-memory only**: page refresh starts a new app until P4 persistence. Do not imply otherwise in product UI.
- PWA packaging/service-worker, audio, advanced AI difficulty, GIF previews, full 44-frame animation playback and persistent statistics remain P3/P4 tasks.
