# P4.9 — AI Balance & Public Beta Readiness

## Branch/release status
This phase is stacked after P4.8 PR #12, P4.7 PR #11 and P4.6 PR #10. Merge/rebase strictly in order. **No production deploy or release is authorized by this implementation report.** Physical device review and real player feedback remain outstanding.

## AI evaluation methodology
- Practice mode retains its simple legal baseline, Easy chooses a gentle weighted random legal action, Normal favors card shedding and suit continuity, Hard evaluates bounded public-information-set probabilities.
- AI always receives the whitelisted `AIObservation`. It does not inspect the human hand, unrevealed draw pile, future RNG state or hidden card IDs.
- `npm run evaluate:ai` compares Easy/Normal/Hard against the SAME simple baseline on 1,000 matched deterministic shuffle seeds.
- Reports Wilson approximate 95% confidence intervals on win rates, *paired* difficulty gaps and approximate 95% intervals, and average/p95/max decision time.
- These values measure AI versus one mechanical baseline, **not** win probability versus humans. A point estimate ordering is not statistically convincing without intervals and actual playtesting.
- An experimental Hard-policy weighting change was evaluated on the same 1,000 seeds. It decreased Hard's win rate from the historical 47.2% to 43.6%. **The change has been reverted.** The original legal-information-set Hard policy is retained pending further evidence and player tests. Do not alter deals or leak private data to force a difficulty ordering.
- The experimental run also measured Easy 42.3% and Normal 44.5%; Hard vs Normal was −0.9 percentage points (approximate paired 95% range −4.18 to +2.38), **inconclusive**. Those experimental results are kept as an audit trail, not as the final policy's current measurement.
- Re-run `npm run evaluate:ai` on the reverted branch to confirm the final policy's updated result before using the phase as a release candidate.
- CI emits the reproducible `meowdeck-ai-evaluation` artifact. Fill actual results from CI logs; do not invent them.

## Lightweight replayability
Existing match history, total matches, win rate, per-difficulty records, current/best win streaks and rematch flow provide a minimalist foundation. No daily-pressure mechanics, gamified fake rewards, backend accounts, gambling, monetization or unnecessary achievement spam are introduced for this beta. Add more only when user feedback warrants it.

## Beta playtest rubric (record actual answers)
1. Could a first-time user start a match without guidance?
2. Could they explain matching rank/suit, drawing and wild-eight rules?
3. Did selecting, deselecting, keyboard and touch card input work?
4. Were AI difficulty differences *perceived* across a few matches?
5. Did Mochi reactions and card sounds feel correctly synchronized?
6. Was any on-screen explanatory text irrelevant or distracting?
7. Were all cards and actions visible on mobile portrait and landscape?
8. Could they close, reopen offline and continue the exact match?
9. Would they play again? If not, what specific interaction failed?
10. Which real device/browser/version was used for the test?

Do not claim the questionnaire has been conducted until responses are collected.

## Public Beta release gate
- [ ] P4.5, P4.6, P4.7, P4.8, P4.9 approved and merged in order
- [ ] All current Node, TypeScript, engine, benchmark, art and Next.js build checks green on `main`
- [ ] Playwright dev, production, offline and cross-browser matrix green on `main`
- [ ] Confirm AI performance and seed-paired uncertainty from CI evidence
- [ ] Test real iPhone Safari/Add to Home Screen, Android Chrome installed PWA, desktop keyboard and 200% browser zoom
- [ ] Check real TalkBack/VoiceOver or other target screen-reader setup if available
- [ ] Human visual/audio sign-off on Mochi, card flight, type scale and small screens
- [ ] Manually test saving, closing, reopening offline, multi-tab conflict, restored round result, settings and statistics
- [ ] Collect first-player feedback; record blockers and prioritize fixes
- [ ] Review PWA cache build ID and generated `sw.js`/offline manifest in deployment environment
- [ ] Verify rollback/recovery and preserve IndexedDB schema
- [ ] Publish release notes and build version only after all gates pass

## Known limitations and rollback
- Local browser data may be evicted or cleared; there is no cloud account sync.
- In-game tutorial is optional and lives separately from saved matches.
- Physical-device and user-experience sign-off cannot be simulated by Playwright.
- Revert an isolated polish PR for a visual/performance regression; never reset user saves or change P1 card rules to mask bugs.
- For failed PWA updates, preserve the last valid service-worker cache and verify saved-match completion before activating a new worker.

## Release notes candidate
MeowDeck's initial public beta candidate combines the existing 52-card Crazy Eights engine, original Mochi pixel animations, independent fair AI, persistent local game progress and offline-first PWA with improved onboarding, compact card interaction, hand-crafted card VFX, softer procedural audio, keyboard/mobile QA and reproducible AI balance reports. **Release pending quality gates.**
