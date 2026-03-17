# Matrix Rain 3D MVP

Conflict-free slug for this wave: `matrix-rain-3d`.

## Control Caps

- Density: `120..1800` (default `420`)
- Speed: `0.25..2.4` (default `1.0`)
- Theme: `green | cyan | amber`

Inputs are clamped before render updates.

## Render and Recovery Contract

- Deterministic reset path rebuilds glyph pool from fixed seed and current clamped controls.
- Low-FPS degraded mode reduces active glyph count and surfaces warning state.
- Theme updates apply on next reset to keep runtime behavior stable.

## Rationale

`matrix-rain-3d` avoids slug/publish conflict with existing matrix-rain naming paths while preserving feature intent.
