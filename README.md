# MeowDeck — A Little Cat. A Clever Deck.

This repository-ready bundle implements **P0: Asset Contract Standardization only**. It does **not** contain the Crazy Eights engine, AI, or UI. Its source of truth is [`asset-contract.json`](asset-contract.json) (v1.0.0).

## Validate assets

```bash
python -m pip install -r requirements-assets.txt
python scripts/validate_assets.py
```

The validator is **read-only** and exits with status `1` for invalid assets/metadata (`2` if Pillow is missing). It performs structural, pixel-perfect atlas round-trips, nearest-neighbor 2× comparisons, exact Mochi frame/timing checks, and original PNG SHA-256 checks. The scoped GitHub Actions workflow executes the same command when the relevant files change.

## Asset paths

- Card manifest: `public/assets/meowdeck/cards/manifest.json`
- Base atlas: `public/assets/meowdeck/cards/spritesheets/cards_atlas.png`
- Atlas frame metadata: `public/assets/meowdeck/cards/spritesheets/cards_atlas.json`
- HD atlas: `public/assets/meowdeck/cards/spritesheets/cards_atlas@2x.png`
- Mochi manifest: `public/assets/meowdeck/mochi/animations.json`
- Mochi sheets: `public/assets/meowdeck/mochi/sprites/`
- Original PNG digests: `asset-digests.json`

The cards manifest's `path` and `path_2x` entries are resolved **relative to the cards manifest**. The Mochi manifest's `sheet` paths are resolved **relative to the Mochi manifest**. The extra 3 assets (2 Jokers and 1 card back) are present in the atlas but not in the Crazy Eights 52-card playable deck.

## Documentation

- [`MeowDeck.md`](MeowDeck.md): product specification with corrected card art dimensions
- [`docs/ASSET_CONTRACT.md`](docs/ASSET_CONTRACT.md): P0 contract, action sync, runtime integration rules
- [`docs/ASSET_VALIDATION.md`](docs/ASSET_VALIDATION.md): checks, test command, failure behavior
- [`docs/P0_REPORT.md`](docs/P0_REPORT.md): audit evidence and readiness status

**Original art was not regenerated, resized, or re-encoded.** Runtime assets consist of the 122 original PNGs extracted without changing their bytes. Previews, GIFs, authoring scripts, and original ZIPs are intentionally not duplicated in this runtime bundle; retain the supplied source archives separately as authoring backups. When integrating the package into an existing checkout, review paths and do not overwrite unrelated code.
