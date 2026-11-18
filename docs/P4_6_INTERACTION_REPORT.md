# P4.6 — Gameplay Interaction and Contextual Onboarding

## Dependency
This branch starts from P4.5 commit `b5c4f605`, because PR #9 has not merged into `main`. Review/merge P4.5 before retargeting and merging P4.6. This is a stacked draft PR, not an independent production release.

## Gameplay UX implementation
- Play on the main menu opens Difficulty directly for the single available game.
- The existing GameSelection component is retained for future multiple game modes and is not recreated as a second rules engine.
- Difficulty Back returns to the Main Menu. Clicking an already selected legal card clears selection.
- Primary action text says Select a card before selection and Play card after selection.
- Tutorial is contextual, shown only for legal player opportunities: match a suit/rank, confirm first card, draw only when required, and choose to play an eight.
- Tutorial state is versioned in localStorage, separate from IndexedDB match save, and only progresses after confirmed legal human actions.
- Users may dismiss in the action rail and replay from Pause or Rules. Invalid or missing localStorage silently falls back; it does not affect the game.
- Thai/English translations are complete. Guidance is integrated with the existing action rail and avoids overlays on the cards.

## Verification
Updated existing development and production E2E specs for the new direct-entry flow. Added `e2e/p4-6-onboarding.spec.ts` for main-menu back navigation, tutorial state progression, dismiss/replay/refresh and narrow mobile layouts.

Required checks:
`npm ci`, `npm run typecheck:engine`, `npm run typecheck`, `npm test`, `npm run test:simulation`, `npm run benchmark:ai`, `npm run validate:assets`, `npm run build`, `npm run test:e2e`, and `npm run test:e2e:production`.

## Invariants and risks
- Existing Crazy Eights engine, legal actions, AI fairness, card assets, IndexedDB schema, PWA and audio are unchanged.
- Do not confuse passing screenshot capture with manual art approval.
- Validate mobile action rail layout and iOS physical-device behavior before calling P4.6 complete.
