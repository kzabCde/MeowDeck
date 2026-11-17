# MeowDeck — Asset Validation (P0)

## Run

Requires Python 3.10+ and Pillow only:

```bash
python -m pip install -r requirements-assets.txt
python scripts/validate_assets.py
```

For a differently located checkout, run `python scripts/validate_assets.py --repo /path/to/checkout`.

The command prints the pass/fail summary and exact mismatching field or asset. Exit code is `0` on success, `1` when validation fails, and `2` when Pillow is unavailable. It does not write or modify any file. You can capture a report externally using shell redirection if needed.

## Checks

1. Contract version, 52 expected playable card IDs, three additional asset IDs, canonical dimensions and 8 × 7 atlas geometry.
2. Card manifest integrity, each card's rank/suit identity, optional asset categories, ordered nonoverlapping atlas coordinates, atlas JSON mappings and unused alpha-transparent cell.
3. All source/HD PNGs exist as RGBA, are the correct size, and are exact nearest-neighbor enlargements. Cropping the atlas reproduces source PNG pixels for all 55 assets in both resolutions.
4. Mochi animation IDs, each clip's expected frame count, order, geometry, anchor, normalized origin, per-frame duration, loop state and optional action frame. Check all ten Sprite Sheet dimensions.
5. Every runtime PNG matches its SHA-256 digest from the originally supplied ZIPs, so metadata-only changes cannot silently modify existing art.

Artwork *quality* is not judged by arbitrary similarity scores. GIF previews are optional and intentionally not part of the deployed asset tree.

## Invalid-input smoke test

To verify failure semantics, make a disposable copy of the bundle, change `thinking.loop` to `false` in its `public/assets/meowdeck/mochi/animations.json`, and rerun. The validator must fail nonzero with an error similar to:

```text
FAIL mochi.thinking.loop: expected True; actual False
```

Do not modify the real source bundle for this test.

## Existing scripts

The card pack contains an independent `validate_deck.py` that performed **692** checks on the original archive. That legacy script writes validation reports and imports its original card generator, making it unsuitable as the primary **read-only CI validator**. This P0 validator reuses its structural and pixel-perfect atlas/nearest-neighbor comparison approach, adds Mochi checks and immutable PNG fingerprints, and does not regenerate graphics. Source archives and authoring scripts can be kept outside the deployed asset tree.

## CI behavior

`.github/workflows/validate-assets.yml` runs on relevant PRs and commits only. It checks out the project, installs the small Pillow dependency, and runs the exact command above; no deployment or application framework is required.
