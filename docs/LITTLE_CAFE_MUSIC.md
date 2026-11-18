# Little Cafe — continuous background soundtrack

## Source
- User-provided `little_cafe.wav` (PCM signed 16-bit stereo, 44.1 kHz).
- Duration: exactly **156 seconds (02:36)**, original size **27,518,444 bytes**.
- Production derivative: `little_cafe.mp3` encoded at **96 kb/s**, around **1.8 MB**, preserving the full supplied recording.
- For local conversion if needed:
  `ffmpeg -i little_cafe.wav -codec:a libmp3lame -b:a 96k public/assets/meowdeck/audio/little_cafe.mp3`

## Required binary asset
Place the actual `little_cafe.mp3` file in **`public/assets/meowdeck/audio/little_cafe.mp3`**. GitHub's text-only connector cannot insert binary audio; the source/converted asset accompanies the chat deliverables. The feature PR is intentionally **draft and blocked on including this file**, rather than falsely claiming that the soundtrack exists in Git.

## Runtime
- One `HTMLAudioElement` is owned by the existing `GameAudio` singleton at `src/web/audio/audio-manager.ts`.
- Source: `/assets/meowdeck/audio/little_cafe.mp3`, `loop=true`.
- The previous synthesized background melody is removed; procedural card / UI SFX remain separate.
- New users default music **ON** at a low 16% volume; existing saved settings take precedence, including an explicit OFF.
- Music begins only after first user click/tap (browser autoplay policy), stays on across menu / Crazy Eights / Blackjack, and resumes at the same point after OFF/ON or page visibility change. Page reload starts the track again, not a perpetual offline process.
- The Settings Music toggle applies synchronously during the click to support iOS Safari permission, while the original Music volume slider continues to work.
- Audio failures are non-blocking, never create an unnecessary toast, and never mutate authoritative game data.
- Repeated UI clicks use the same audio element instead of starting parallel streams.
- The Next.js build script precaches `.mp3` under the original MeowDeck PWA static asset bundle. The audio file must be present before running `npm run build` for offline availability.

## Quality gates
- [ ] Commit the binary file at the expected path (release blocker)
- [ ] Check `/assets/meowdeck/audio/little_cafe.mp3` returns HTTP 200 in production and on offline reopen.
- [ ] Listen through the full 156-second playback and loop boundary on Chrome/Firefox/Safari; ensure no audible gap or pop. MP3 encoders can introduce priming/padding even if the source has a quiet tail.
- [ ] Verify settings toggle and volume persist across reload and do not modify SFX.
- [ ] Verify background music keeps playing while switching between both games, without duplicates.
- [ ] Verify tab-hidden pause and tab-visible resume.
- [ ] Verify music works on real iOS Safari and Android Chrome/PWA after user gesture.
- [ ] Run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run test:e2e:production`.
