# Complex Plane

Bounded MVP for Argand plane operations.

## Supported operations
- add
- subtract
- multiply
- divide (with division-by-zero guard)

## Bounds and Errors
- Inputs must be `real,imag` numeric pairs.
- Magnitude of each input component is capped at `1e6`.
- Invalid parse and divide-by-zero are surfaced explicitly.

## Plotting
- Canvas plot is bounded/clamped to stable viewport transforms.
