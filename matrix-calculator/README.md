# Matrix Calculator

Bounded in-browser matrix calculator focused on deterministic operations and error precedence.

## Supported Operations

- Two-matrix: add, subtract, multiply
- Single-matrix: transpose, determinant, inverse
- Matrix size cap: `1x1` through `6x6`

## Validation Rules

Validation precedence is deterministic and enforced in this order:

1. Malformed numeric input
2. Dimension mismatch for operation
3. Singular matrix inverse
4. Unsupported operation

## Constraints

- Determinant and inverse require square matrices.
- Inverse uses Gaussian elimination with singularity threshold.
- Results are rounded for display only; internal math uses JS numbers.

## Deterministic Error Messages

- `Malformed numeric input in A[r,c]` or `B[r,c]`
- `Dimension mismatch for add/subtract`
- `Dimension mismatch for multiply`
- `Dimension mismatch: determinant requires a square matrix`
- `Dimension mismatch: inverse requires a square matrix`
- `Singular matrix: inverse unavailable`
- `Unsupported operation`
