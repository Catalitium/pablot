# Gravity Sim MVP

Three.js N-body style simulation with strict stability clamps and deterministic reset behavior.

## Control Ranges

- Body count: `2..120` (default `40`)
- Mass scale: `0.5..4.0` (default `1.6`)
- Time-step `dt`: `0.002..0.03` (default `0.012`)

## Stability Contract

- Velocity hard cap: `3.5`
- Distance denominator clamped to avoid singular accelerations.
- World radius bound with damping bounce-back.
- Reset always returns to safe deterministic initial distribution.

## Scope Notes

- This is an educational bounded simulation, not physics-accurate orbital mechanics.
- No collision-merging, adaptive integrators, or GPU compute in this wave.
