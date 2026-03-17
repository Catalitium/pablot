# Terrain Generator

Deterministic seed-based terrain map with strict clamps and bounded rendering workload.

## Generation Contract

- Seed text is hashed to deterministic numeric seed.
- Generation uses multi-octave value noise.
- Same seed + same parameters always produces the same terrain map.

## Parameter Ranges

- Octaves: `1..7`
- Scale: `0.01..0.2`
- Amplitude: `6..80`
- Grid resolution: `32..192`

Inputs are clamped before generation.

## Performance Constraints

- Grid is hard-capped to avoid unbounded rendering cost.
- Rendering is synchronous but bounded by configured resolution limits.
- Status panel reports successful generation config.

## Recovery Path

- Any generation/render exception triggers canvas clear + explicit error status.
- Invalid seed text falls back to deterministic safe default (`0`).
