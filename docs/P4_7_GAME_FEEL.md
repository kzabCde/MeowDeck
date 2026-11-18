# P4.7 — Game Feel & Audio Polish

## Baseline and dependency
Stacked on P4.6 PR #10. It should be retargeted to `main` only after P4.6 has merged. This is a focused game-feel PR, not a gameplay rewrite.

## Findings
- Existing presentation cues, card flights and 10 original Mochi sprite clips are already functional. No sprite regeneration is needed.
- The table rendered `md-card-impact`, `md-wild-impact`, and `md-hand-drawn` classes but lacked matching keyframes in its active stylesheets; consequently the intended feedback was visually absent.
- Domain events for placing an eight and changing suit could trigger Web Audio simultaneously. Round and match end sounds were already partially deduplicated; timing needed a defined event schedule.
- GameAudio stored recent SFX identities in a Set cleared after 200 events, allowing previously heard identities to be replayed after the cap.

## Changes
- Add short pixelated discard, wild suit and newly drawn card feedback tied to existing committed presentation events. Impacts cannot intercept input.
- Keep motion optional: reduced-motion user setting and system media query skip decorative effects; the rules engine is unaffected.
- Add pure `planEventSounds` with deterministic offsets for play/suit/victory, and bounded FIFO identity deduplication. No audio assets or new dependencies.
- Provide unit coverage of sound sequence/dedup semantics and browser E2E that verifies CSS event effects and Reduced Motion.
- Keep the original 10 Mochi clips, dimensions, manifest and P3 animation priority intact.

## QA
Run unit/AI simulation, asset checks, Next build, development and production E2E (including offline). Existing CI uploads screenshots.
Remaining: subjective SFX mixing and real-device art sign-off are manual.
