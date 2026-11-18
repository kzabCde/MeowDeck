# P4.8 — Production QA, Accessibility & Cross-Browser Gate

## Phase dependency
Based on P4.7 PR #11; stacked onto P4.6 PR #10, which follows P4.5. Review and merge in order; no automatic release.

## Improvements
- Prevent keyboard ArrowLeft/ArrowRight from getting stuck on disabled cards, using the existing playable-card controls.
- Give the active-suit icon an explicit accessible image role and retain its localized aria-label.
- Ensure Pause and menu navigation buttons expose minimum practical 44px touch targets.
- Keep actionable game engine error text visible on mobile; routine autosave and offline success remain silent.
- At very short viewport heights, allow vertical scrolling rather than cropping the card table and action rail.
- Add regression tests for keyboard focus, legal card selection, active-suit announcement, narrow landscape and mobile error visibility.
- Add a dedicated focused four-project cross-browser Playwright smoke for Chromium, Firefox, desktop WebKit and iPhone WebKit emulation.
- GitHub Actions Next.js UI gate now runs for relevant pushes to main, not just PRs; installs browsers and runs the cross-browser smoke. The core and production/offline gates remain unchanged.

## Release QA protocol
1. Run typecheck, unit/integration tests, deterministic match, AI benchmark, art validation and Next.js build.
2. Run seeded Chromium Playwright tests plus the four cross-browser smoke projects.
3. Run production Chromium E2E and PWA offline restoration tests.
4. Compare deterministic UI screenshots at 320×568, 390×844 and 1280×720; capture landscape as needed.
5. **Manual outstanding:** iOS Safari on real hardware, Android Chrome installed PWA, 200% browser zoom (CSS viewport test is only a proxy), screen-reader workflows and subjective visual review.
6. Do not treat emulation as physical device confirmation.

## Scope protection
No change to game rules, AI observations, persistence schema, asset contract or user-facing ads/monetization. Preserve local-only saves and reduced motion.
