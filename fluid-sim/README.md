# Fluid Sim

Lean, performance-capped fluid-like diffusion simulation.

## Controls
- Quality presets: low/medium/high with hard max resolution cap.
- Iteration count with hard clamp.
- Deterministic reset.

## Guardrails
- Resolution cap: `128x128`.
- Iteration cap: `25`.
- Low-FPS sustained state triggers automatic iteration reduction.

## Out of scope
- Advanced Navier-Stokes physics, 3D simulation, and GPU compute pipelines.
