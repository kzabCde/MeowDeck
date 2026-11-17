# P1 — Crazy Eights Headless Core Engine

**Status:** Engine implementation and local deterministic tests complete. P2 UI and P3 AI/animation are separate phases.

## Architecture and contract boundary

The original P0 card art (96×144 base PNG, 192×288 HD) and card IDs (`AS`, `10H`, `QD`, `KC`) remain authoritative for rendering. The game engine needs only the rank/suit/ID strings, **not image dimensions or graphics imports**.

```text
P2 React UI / P3 AI Adapter (later)
      | call getLegalActions(state) and whitelist selectors
      | send GameAction
      v
P1 validateAction ──> applyAction ──> GameState (the only authoritative state)
                                     | confirmed DomainEvent[] (public-safe)
                                     v
                           P2/P3 visual presenter (later)

Card core: cards.ts + deck.ts + random.ts
Crazy Eights: rules.ts + scoring.ts + selectors.ts + ai-observation.ts
Session reducer: game-session.ts
```

There is no React, Phaser, DOM, `localStorage`, timer, scene, or UI state in this package. No new app framework was installed. The only development package is TypeScript.

## Exact files

| Component | Path | Responsibility |
|---|---|---|
| `cards` | `src/games/meowdeck/core/cards.ts` | Suit/Rank/CardId, 52 cards, actor types |
| `random` | `src/games/meowdeck/core/random.ts` | WebCrypto unbiased integer sampler and injectable `RandomInt` |
| `deck` | `src/games/meowdeck/core/deck.ts` | Fisher–Yates, dealing, drawing, first non-eight discard |
| `game-types` | `src/games/meowdeck/core/game-types.ts` | Serializable state, discriminated unions, events/errors |
| `game-session` | `src/games/meowdeck/core/game-session.ts` | Pure authoritative transitions, idempotency, scoring lifecycle |
| `rules` | `src/games/meowdeck/games/crazy-eights/rules.ts` | Legal actions, wild eight, one-draw constraint, validator |
| `scoring` | `src/games/meowdeck/games/crazy-eights/scoring.ts` | Empty-hand/blocked results, penalty points |
| `selectors` | `src/games/meowdeck/games/crazy-eights/selectors.ts` | Public, human-specific and status selectors |
| `ai-observation` | `src/games/meowdeck/games/crazy-eights/ai-observation.ts` | Whitelisted Mochi AI observation |
| `index` | `src/games/meowdeck/index.ts` | Stable typed API exports |

## Game state

The `GameState` record contains `sessionId`, `gameId`, `schemaVersion`, `roundNumber`, `scores`, `currentActor`, `phase`, `turnId`, player hands, draw/discard piles, `activeSuit`, `pendingDrawnCardId`, `blockedTurns`, `roundResult`, `matchWinner`, safe `publicHistory`, and `processedActionIds`.

Phases are synchronous and never depend on animation timing:

```text
createMatch() → human_turn / ai_thinking
         legal play ──┬─> next actor's turn
                      └─> round_end ──> start_next_round → next actor's turn
                             └────────> match_end (first to three wins)
         draw ──┬─> playable drawn card: stay in same turn; play it or finish_turn
                └─> unplayable: next actor's turn
         pass ──> next turn or blocked round after two consecutive passes
```

`dealing` and `resolving_action` are not separate persisted phases because dealing and game-action reduction are synchronous, atomic, and headless. P2 may animate those events but must not hold the engine in a transitional state.

## Ruleset v1 implementation

- 52 standard playing cards, no Jokers. Seven cards per player and one non-eight initial discard; 37 cards remain in draw pile. Initial eight is returned and the draw pile reshuffled, with bounded deterministic fallback.
- Round 1 begins with the human. Later starters alternate regardless of draws.
- Card play is permitted for matching active suit, matching top discard rank, or any eight.
- Non-final eight requires `selectedSuit`; the play is committed atomically only when a suit is provided. Final eight wins immediately without a suit modal.
- You cannot draw while any card is playable. An actor with no legal play draws **one** card. If it can play, only that newly drawn card can be played immediately or retained via `finish_turn`.
- When the draw pile is exhausted, every discard except the top is reshuffled into it. A chosen suit on a top wild eight remains unchanged by recycling.
- Only when drawing and playing are both impossible can `pass_turn` be chosen. Two consecutive passes finish a blocked round. Any successful draw/play clears the blocked-turn counter.
- Empty hand wins the round. Blocked score penalties: A=1; 2–7 and 9–10=number; 8=50; J/Q/K=10. Lower penalty wins, a tie awards no round win.
- First to three round wins ends the match. Only an explicit `start_next_round` can deal a fresh round while preserving scores.

**Important mathematical edge case:** Under strict 52-card conservation and with all but the top discarded cards recyclable, a truly blocked round can be unreachable in normal play: with an empty draw pile and only one discard, a playable suit/rank/8 must exist in some hand. The pass/blocked transition is still implemented, validated, and directly tested against synthetic state fixtures for compatibility with the locked rules contract. Those synthetic blocked-state fixtures are not used as conservation test cases.

## Public API

```ts
createStandardDeck(): Card[]
shuffleDeck<T>(cards: readonly T[], rng: RandomInt): T[]
dealCards(deck: readonly Card[], count: number): { dealt: Card[]; remaining: Card[] }
createMatch({ sessionId, rng? }): GameState
createMatchWithEvents({ sessionId, rng? }): { state: GameState; events: DomainEvent[] }
validateAction(state, action): ValidationResult
applyAction(state, action, rng?): ActionResult
startNextRound(state, actionId, rng?): ActionResult
getPlayableCards(state, actor?): readonly Card[]
getLegalActions(state, actor?): readonly LegalAction[]
getCurrentActor(state): Actor
getActiveSuit(state): Suit
getRoundStatus(state): RoundResult | null
getMatchStatus(state): Actor | null
getPublicGameState(state): PublicGameState
getHumanView(state): PublicGameState & { ownHand: Card[]; legalActions: LegalAction[] }
createAIObservation(state): AIObservation
calculateHandPenalty(cards): number
assertCardConservation(state): void
```

`RandomInt(maxExclusive)` must return an integer `0 ≤ value < maxExclusive`. Inject a seeded test RNG into `createMatch` and `applyAction` to reproduce an entire match. Production uses WebCrypto sampling with rejection to avoid modulo bias. Invalid requests do not consume RNG.

### Game actions

Each action needs a **unique actionId**. Gameplay actions also require `actor` and `expectedTurnId`. At the end of a round, `{type:'start_next_round', expectedRoundNumber, actionId}` can advance. `restart_match` requires a new unique session ID.

```ts
{ type:'play_card', actor:'human', cardId:'8H', selectedSuit:'C', expectedTurnId:7, actionId:'play-7' }
{ type:'draw_card', actor:'ai', expectedTurnId:8, actionId:'draw-8' }
{ type:'finish_turn', actor:'human', expectedTurnId:9, actionId:'finish-9' }
{ type:'pass_turn', actor:'human', expectedTurnId:10, actionId:'pass-10' }
{ type:'start_next_round', expectedRoundNumber:2, actionId:'next-2' }
{ type:'restart_match', newSessionId:'new-session-uuid', actionId:'restart-1' }
```

`applyAction` returns `{ok:true,state,events}` on success; on failure returns `{ok:false,state:original,events:[],error:{code,message}}` without modifying state. Error codes include `WRONG_TURN`, `INVALID_PHASE`, `CARD_NOT_OWNED`, `ILLEGAL_CARD`, `SUIT_REQUIRED`, `CANNOT_DRAW`, `CANNOT_PASS`, `STALE_ACTION`, `DUPLICATE_ACTION`, and `ROUND_FINISHED`.

A repeated action ID in the same session is rejected even when the submitted payload differs. Once a turn ends, its old `expectedTurnId` cannot be replayed. The UI should create a new action ID only when the user makes a new action decision, not on network or click retries. For P4 persistence, serialize the full authoritative state and resume with retained action IDs; do not duplicate previously committed actions.

### Domain events

`MATCH_STARTED`, `ROUND_STARTED`, `CARD_PLAYED`, `CARD_DRAWN`, `SUIT_CHANGED`, `TURN_CHANGED`, `DRAW_PILE_RECYCLED`, `ROUND_ENDED`, `MATCH_ENDED` are emitted after successful actions (or by `createMatchWithEvents`). All current events have `visibility:'public'`; `CARD_DRAWN` contains **count, not card identity**. UI animations consume confirmed events but cannot cause a rule transition.

For a `draw_card` event by Mochi, P3 may display the `draw_card` sprite. For a `play_card`, display `play_card` and use the P0 `actionFrame` solely for visual alignment. Never rely on the animation event to mutate cards.

### AI information isolation

`createAIObservation` whitelists only Mochi's own cards, opponent hand count, draw count, public history, top discard/active suit, scores and legal actions. It cannot reveal the human hand, undrawn deck identities or order, action-id history or random seed. `getHumanView` provides the P2 renderer with the human hand but not the AI hand. An AI private pending-draw status is not exposed to the human public view.

## Testing and future work

Run:

```bash
npm install
npm run typecheck
npm test
npm run test:simulation
python -m pip install -r requirements-assets.txt
python scripts/validate_assets.py
```

`tests/engine.test.mjs` covers rule/state/AI boundaries and edge cases. `tests/simulation.test.mjs` verifies 40 deterministic legal-drive matches, card conservation after every action and no mutation of prior state. `examples/play-match.mjs` runs a standalone match with seed 73. Legal-drive selection is a test helper only, **not a P3 AI difficulty implementation**.

**P2** should implement presentation and interaction only; **P3** should add real Easy/Normal/Hard AI and Mochi animation; **P4** should add versioned local saves, settings, and full E2E validation. GitHub Actions checks `npm run typecheck`, `npm test`, and `npm run test:simulation` on engine changes.
