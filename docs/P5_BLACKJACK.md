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

## Save and statistics boundary

P5 tracks Blackjack results in its separate versioned browser-local saved round. It does not silently insert Blackjack outcomes into the Crazy Eights-only IndexedDB match history or existing global Statistics panel. Reopening Blackjack through the game catalog restores its last validated round. This first P5 MVP does not yet offer per-game historical Blackjack analytics or robust atomic cross-tab IndexedDB locking. Those are explicit post-MVP improvements, not claimed as implemented.


## P5 post-merge correctness hardening
After the initial P5 implementation was merged, a review identified that `BlackjackAction.actionId` was carried through API calls but only checked for non-empty values; an already committed identity could be reused by an errant caller with a fresh revision. A bounded optional `processedActionIds` trail is now maintained on confirmed actions, so repeat identities are rejected as stale. This field is **optional on schema-1 saves** to preserve existing browser progress, and previous saves become tracked on their next valid move. Corrupt or duplicate ID trails are rejected by the save validator.

This incremental hardening does not change deck order, Ace scoring, dealer soft-17 behavior, score totals, the UI, Crazy Eights, or the current localStorage limitations. Full multi-tab atomic saving requires a separate storage architecture task.
