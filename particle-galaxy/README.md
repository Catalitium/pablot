# Particle Galaxy

Deterministic, performance-capped galaxy renderer with strict parameter clamps.

## Scope

- Rendered with Canvas 2D point field for broad compatibility.
- Controls: seed, particle count, radius, spin, randomness, regenerate.
- Deterministic generation from seed using local PRNG.

## Parameter Caps

- Particle count: `100..5000` (default `1200`)
- Radius: `20..500` (default `220`)
- Spin: `0..12` (default `4`)
- Randomness: `0..1` (default `0.25`)

All inputs are clamped before generation.

## Fallback Behavior

- Runtime monitors average frame rate.
- If sustained FPS drops below threshold, degraded mode activates and particle set is reduced.
- Degraded state is explicitly displayed in UI.

## Exclusions

- No unbounded object generation.
- No advanced post-processing effects in this wave.
