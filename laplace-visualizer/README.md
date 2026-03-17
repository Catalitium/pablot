# Laplace Visualizer

Bounded-order MVP for pole-zero and deterministic response rendering.

## Supported input
- Numerator and denominator coefficient lists.
- Maximum polynomial order: 2.

## Deterministic settings
- Fixed sample count for response curve.
- Fixed step size assumptions in browser path.

## Errors and bounds
- Order above cap is rejected explicitly.
- Parse errors and invalid leading denominator coefficient are surfaced directly.

## Out of scope
- Advanced control-theory analysis (Bode/Nyquist/root-locus automation).
