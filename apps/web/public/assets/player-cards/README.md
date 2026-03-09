Player card rarity frame assets.

Expected files:
- `rarity-sprite.webp` (2x2 grid sprite: common, rare, epic, legendary)
- `common.webp`
- `rare.webp`
- `epic.webp`
- `legendary.webp`

Generate from a source image:

1. Place source image at `assets/player-card-frames-source.png` (repo root), or choose your own path.
2. Run:

```bash
npm run assets:card-frames
```

Or:

```bash
npm run assets:card-frames -- ./path/to/source.png
```
