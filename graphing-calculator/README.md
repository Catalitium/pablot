# Graphing Calculator

Deterministic browser graphing calculator with strict expression grammar and bounded numeric root approximation.

## Supported Grammar

- Operators: `+`, `-`, `*`, `/`, `^`
- Parentheses: `(` `)`
- Functions: `sin`, `cos`, `tan`, `log` (base-10), `ln`, `sqrt`, `abs`
- Variable: `x`
- Constants: `pi`, `e`

Anything outside this grammar is rejected with an explicit validation error.

## Plot Behavior

- Canvas sampling uses a fixed number of points per render pass.
- Discontinuities/non-finite outputs are skipped instead of connecting across breaks.
- Zoom and pan are bounded to avoid unbounded coordinate growth.

## Root Approximation Contract

- Method: sign-change scan over current x-view followed by bisection.
- Deterministic limits: fixed scan count, tolerance (`1e-6`), and max iterations (`70`).
- Result format: `x ≈ value`, `f(x) ≈ value`, iteration count.
- If no sign-change interval is found, returns explicit non-root message.

## Known Numeric Limits

- Extremely steep functions may be clipped during plotting.
- Only real-valued evaluation is supported.
