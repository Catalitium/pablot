# Solar System

Simplified orbital simulation with bounded controls and deterministic selection behavior.

## Model Assumptions

- Orbital motion uses fixed ratio animation, not physics-accurate n-body mechanics.
- Planet scale and distances are visualized for readability, not real-world scale.
- Saturn ring is represented as a visual accent only.

## Control Contract

- Time scale is clamped to `0.1x .. 5.0x`.
- Pause and resume are explicit controls.
- Planet selection is click/touch-based and highlights the active body.

## Stability and Fallback

- Camera-safe defaults are fixed center framing with responsive scale.
- Overlays are non-blocking and collapse to mobile-safe positions.
- If no planet hit is detected, selection state resets deterministically.

## Exclusions

- No physics-accurate orbital simulation.
- No high-cost volumetric/post-processing effects in this wave.
