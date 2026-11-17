# MeowDeck — Asset Contract v1.0.0

## Authority and scope

The machine-readable single source of truth is [`../asset-contract.json`](../asset-contract.json), maintained at the repository root. The two source-pack manifests (`cards/manifest.json`, `mochi/animations.json`) retain the producer's stable IDs, relative file paths, atlas coordinates, and per-frame information. The validator **requires** those manifests to agree with the contract: do not maintain separate independent values in a UI, game reducer, or renderer.

No framework is required for P0. Renderer integration (React, Canvas or Phaser) belongs to later phases.

## Cards

| Property | Contract |
|---|---|
| Playable ranks | `A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K` |
| Suits | `S` Spades, `H` Hearts, `D` Diamonds, `C` Clubs |
| Card ID | `${rank}${suit}`; e.g., `AS`, `10H`, `QD`, `KC` |
| Playable Crazy Eights deck | Exactly 52 unique standard cards; **no Jokers** |
| Extra asset IDs | `joker_red`, `joker_black`, `card_back` |
| Source card size | 96 × 144 px, RGBA PNG, 2:3 |
| HD card size | 192 × 288 px, exact 2× nearest-neighbor |
| Base atlas | 768 × 1008 px (8 columns × 7 rows of 96 × 144) |
| HD atlas | 1536 × 2016 px |
| Atlas occupied/empty cells | 55 occupied, last cell (index 55) fully transparent |
| Scaling | nearest-neighbor / `image-rendering: pixelated` |

For individual card files, resolve `path` and `path_2x` relative to `public/assets/meowdeck/cards/manifest.json`. Use the atlas metadata's frame ID as the texture key. The base atlas itself is part of the original card pack and remains unchanged.

## Mochi animation

- One horizontal-row Sprite Sheet per clip, ordered left to right.
- Each frame **96 × 96** RGBA PNG.
- Anchor **(48, 88)** (pixel coordinates in each frame).
- Normalized origin **(0.5, 88/96)**, represented as `(0.5, 0.9166666666666666)` in JSON; use the anchor ratio in runtime to avoid rounding error.
- `frameDurationMs` is **authoritative**. The old `fps` field was removed from the normalized pack to avoid contradictory timing. When a framework requires FPS, compute `1000 / frameDurationMs` and preserve fractional FPS if supported; otherwise schedule frames by millisecond duration, not a rounded FPS.

| Clip ID | Frames | Milliseconds/frame | Loop? | `actionFrame` |
|---|---:|---:|---|---:|
| `idle` | 4 | 200 | Yes | — |
| `blink` | 3 | 100 | No | — |
| `thinking` | 4 | 180 | Yes | — |
| `draw_card` | 6 | 100 | No | 3 |
| `play_card` | 6 | 100 | No | 3 |
| `victory` | 6 | 140 | No | — |
| `defeat` | 4 | 200 | No | — |
| `sleep` | 4 | 300 | Yes | — |
| `pet_reaction` | 4 | 160 | No | — |
| `surprise` | 3 | 120 | No | — |

Total: 10 clips and 44 frames. Keep source Sprite filenames and animation IDs. The per-clip `sheet` paths in `animations.json` are relative to the Mochi manifest.

### Action-frame and priority contract (for P1–P3)

`actionFrame: 3` is **zero-based** for `draw_card` and `play_card`. Inspection of the original clips indicates that frame 3 falls within the extended-paw action; it is a provisional visual synchronization point until reviewed in the actual card/table renderer. A card is **not part of the Mochi Sprite artwork** and must be a separate runtime entity.

Priority:

`victory/defeat > draw_card/play_card > pet_reaction/surprise > thinking > sleep > idle/blink`

A one-shot returns to the current logical presentation state; never unconditionally force `idle`. Rendering events **must not** determine card legality or mutate authoritative game state. The engine validates and commits a card action once, and rendering observes that decision. Interruption, missing Sprites, or Reduced Motion must not create a duplicate card action or change the gameplay result. The animation controller and game-action pipeline must not be implemented in P0.

## Version policy

Update `contractVersion` with breaking contract changes and keep paths/IDs stable when possible. If changing any canonical duration, dimensions or counts, update the single contract, normalize dependent manifests, and run validation. Existing art can only be replaced with an explicit new approved art pack; the SHA-256 digest file makes accidental artwork mutation fail CI.
