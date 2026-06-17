# Battle City Fidelity References

This directory is for local, non-product reference material used during visual
alignment. Do not ship these files in the game bundle.

## Layout

- `original/`: manually saved reference screenshots or video frames.
- `current/`: screenshots captured from this implementation.
- `sources.md`: source URLs and notes used for each reference.

## Required Baseline Set

Before each high-fidelity pass, collect at least:

- title screen screenshot
- stage intro screenshot
- stage 1 gameplay screenshot
- stage 1 map reference
- one 30-60 second gameplay video or frame sequence

Use screenshots for measurement only unless the user explicitly provides
licensed assets for inclusion in the product.

## Compare

Place matching files under `reference/original/` and `reference/current/`, then
run:

```bash
npm run compare -- stage1.png
```

The script writes `reference/compare-stage1.html`.
