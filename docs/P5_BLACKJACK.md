# P5 — Blackjack engine and gameplay contract

## Game scope
MeowDeck adds a second game, Blackjack, using the existing P0 52-card pixel assets and Mochi dealer sprite. This is a **score-only game** with no currency, wagering, wallet, insurance, split or double-down. Those are deliberately outside P5 MVP.

## Exact house rules
- One standard 52-card deck is freshly shuffled at the beginning of every round.
- Deal alternately Player / Mochi (face-up) / Player / Mochi (face-down).
- Ace counts 1 or 11 to maximize a total not exceeding 21. J/Q/K count 10.
- A two-card 21 is a natural blackjack; if both hands are natural, Push; otherwise the natural wins immediately.
- Player Hit adds one card; Bust (over 21) loses immediately. Reaching exactly 21 automatically resolves the dealer.
- Player Stand starts automatic dealer play. Mochi draws while below 17 and stands on any 17, including Soft 17.
- Compare totals after dealer stands. Over 21 is a bust; equal totals are Push.
- Score tracks round wins/losses/pushes only. A new shuffled round starts after resolution; scores persist in the ongoing session.
- No information about the dealer hole card appears in the public view until the hand finishes. No draws from a fabricated deck.

## Integration and independence
- The headless engine is under `src/games/meowdeck/games/blackjack/rules.ts`; Crazy Eights rules and AI strategies stay untouched.
- UI uses the same P0 card files, Mochi animation and existing shared visual language, without recreating the assets.
- Blackjack browser save has its own schema-validated key and must not overwrite the existing Crazy Eights IndexedDB record.
- Menus route to a two-game selection screen; returning to Crazy Eights still passes through AI difficulty.
- All old Crazy Eights browser tests must follow the newly visible game choice, not bypass it with hidden QA flags.

## Phase dependency
This P5 branch is stacked on P4.9 PR #13, which is not in main. P5 must not be merged before the underlying phase is merged/rebased.

## Review gates
Engine unit tests, 52-card conservation, natural hands, Ace/Soft 17, Dealer/Player Bust, legal/stale actions, saved-round recovery, TH/EN UI, responsive 320px/mobile, PWA production, and no Crazy Eights regressions.

**Physical-device and art/audio sign-off remain manual.**
