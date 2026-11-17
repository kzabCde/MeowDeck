# MeowDeck — P3 AI & Animation Integration Contract

## Repository audit (17 November 2026)

The merged P2 source uses React 19, Vite 7, TypeScript strict mode and P1's headless `applyAction`. The P0 contract is v1.0.0, with 10 original Mochi sprite sheets (44 × 96×96 frames). P2's `Mochi.tsx` displayed a static first sprite frame and `practice-opponent.ts` offered only a legal-action test driver. P2 desktop/mobile layout and user-visible card controls were already functional; P3 preserves their existing structure.

## AI architecture

- `src/games/meowdeck/ai/strategies.ts`: `AIStrategy`, `AIDecision`, `Difficulty`, `chooseAIMove`, `isLegalDecision`.
- **Easy:** weighted random legal moves (normal cards ×3 versus wild ×1); occasionally selects a strategically weaker card or suit. RNG is injected.
- **Normal:** heuristic: card penalty reduction (×0.65, capped), continuity of remaining suit (×2.2), controlled wild-card retention (−14 except under pressure), smaller opponent-hand urgency, pending drawn-card handling, final-card priority.
- **Hard:** bounded information-set heuristic (`maxCandidateEvaluations = 52`): start with Normal's strategic baseline, add residual hand flexibility, suit continuation, and hypergeometric probability that a sample of the unknown opponent hand contains a playable card. No opponent card identity is used.
- `estimateUnseenCards`: subtract only Mochi's own cards, current top discard and recent *still-visible* public discards from a normal 52-card deck. Older cards may be recycled, so they are not permanently excluded. This is a plausible unseen pool, not a prediction of the actual human cards or draw order.
- An injected `RandomInt` handles tie-breaking; production uses P1's secure WebCrypto source; E2E QA seeds are dev-only.
- UI passes `createAIObservation(state)` to the selected AI. The P1 controller alone holds the full `GameState`, validates the candidate against the P1 legal actions, and calls `applyAction` with unique action ID/turn identity. If a strategy fails, the controller falls back to the existing legal Practice driver built on the same sanitized observation.
- Difficulty is held at the *match-controller* level, never inserted in P1's rules state. Practice remains available.

## Animation architecture

- `src/games/meowdeck/presentation/mochi-animation.ts`: pure P0 manifest parser and deterministic `ClipClock`. The parser requires 10 clips / 44 frames, exact frame geometry, frame positions, anchor, relative safe paths, and appropriate loop/action frame behavior. **Frame duration values come directly from `animations.json`**, not a second timing table.
- `src/web/animation/mochi-loader.ts`: fetch and cache P0 manifest, load the 10 PNGs, tolerate failed PNGs with a static fallback.
- `src/web/animation/useMochiAnimation.ts`: uses an isolated sprite `<span>` and `requestAnimationFrame` + `ClipClock` for background-position frame updates. Does not re-render React GameTable each frame. Cleans up timers and frame requests, freezes while hidden/paused and respects Reduced Motion.
- `src/web/components/Mochi.tsx`: accessible, tappable/keyboard-pettable sprite component preserving the (48,88) reference anchor in a consistent 96×96 logical frame.
- `src/games/meowdeck/presentation/event-cues.ts`: creates visual cues **only** from public, confirmed P1 domain events with session/round/turn/action IDs. CARD_DRAWN AI = draw; CARD_PLAYED AI = play; public human 8 = surprise; ROUND_ENDED = Mochi victory/defeat. A drawn private card ID is never provided to presentation.
- `PresentationQueue`: bounded 12 event capacity, event deduplication and terminal priority over decorative cues. Confirmed card action cues are not replaced by random blinks. Reset cancels old event context.
- `src/web/components/GameTable.tsx`: uses ephemeral card-flight overlay positioned from real DOM anchors; only public played card faces are revealed. P0 `actionFrame=3` calls the presentational arrival callback and reconciles with the already committed P1 top discard. Private AI draws show a card back only. Reduced Motion suppresses flight.
- `App.tsx`: controls visual cue queue alongside the existing P1 dispatcher. **Animation callbacks never submit a gameplay command.** Gameplay mutation remains synchronous; visual playback is purely cosmetic. AI action submission checks session, round, turn and pending-drawn-card identity again after its presentation delay. Pause and page navigation cancel scheduled work; starting a fresh round or session clears old cues.

## Media and personality

The same 10 original sprite sheets are used, no GIF is needed for runtime. Clips: idle, blink, thinking, draw_card, play_card, victory, defeat, sleep, pet_reaction, surprise. Idle plays blinks periodically; after 18 seconds of undisturbed idle Mochi can fall asleep. Player touch/click/Enter/Space triggers a cooled-down pet reaction outside an AI turn or higher-priority cue. Confirmed actions wake the sprite through new presentations. All speech text is in `src/web/i18n.ts` (TH and EN). Gameplay remains functional when sprites fail to load.

## Test and performance instructions

```bash
npm install
npm run typecheck
npm run typecheck:web
npm test
npm run test:simulation
npm run benchmark:ai
npm run build:web
npx playwright install chromium
npm run test:e2e
python scripts/validate_assets.py
```

Node tests include legal move generation, hidden information invariants, 75 full strategy-driven matches, timing, queue priority and 44-frame manifest correctness. Browser Playwright tests cover all three difficulty selections, pet animation, Reduced Motion, and the unchanged P2 E2E suite. `benchmark:ai` runs 1,000 matches against an identical deterministic baseline per difficulty.

### Benchmark — 1,000 matches per mode, seeds 1–1000

The comparison uses the same baseline opponent as P1's legal driver, matching seeded deck starts and a separate seeded AI tie-break source. A winning *match* means reaching 3 round wins first. Results are descriptive for this fixture, not guaranteed rankings on arbitrary opponents.

| Mode | Wins | Losses | Draw matches | Win rate | Mean AI decisions/match | Mean decision duration | Largest observed decision time |
|---|---:|---:|---:|---:|---:|---:|---:|
| Easy | 423 | 577 | 0 | 42.3% | 58.5 | 0.003 ms | 1.842 ms |
| Normal | 445 | 555 | 0 | 44.5% | 57.1 | 0.002 ms | 0.956 ms |
| Hard | 472 | 528 | 0 | 47.2% | 58.0 | 0.008 ms | 2.054 ms |

Absolute durations depend on local machine load and should not be treated as mobile-browser benchmarks. A full production performance review on low-end mobiles remains desirable.

## P4 handoff

Persist `GameState`, selected difficulty, cosmetic settings and optional animation preferences separately, with migration/version handling. Stats can consume P1 domain events without reading hidden cards; audio may subscribe to confirmed P1 events and P3 action-frame notifications. Offline/PWA install, cloud sync, background audio and long-term progress are **not** added by P3.
