# Fractal Tree MVP

Three.js fractal-tree MVP with deterministic regeneration and strict recursion caps.

## Controls and Ranges

- Depth: `1..10` (default `7`)
- Branch angle: `5..60` degrees (default `24`)
- Branch scale: `0.45..0.82` (default `0.69`)

All inputs are clamped before generation.

## Behavior Contract

- `Regenerate` rebuilds the tree immediately from current clamped controls.
- `Reset` restores safe defaults and rebuilds.
- Rapid regenerate clicks are ignored while generation is active.

## Excluded Features

- No leaf particle systems.
- No wind animation or seasonal shader effects.
- No procedural terrain coupling.
