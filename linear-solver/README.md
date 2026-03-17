# Linear Solver

Tri-stack linear system solver with parity-first contract.

## Stack Roles
- `solver/reference_solver.py`: reference Gaussian elimination with pivoting.
- `solver/perf_solver.cpp`: equivalent C++ path for parity/perf.
- `solver/run-parity.ps1`: executes both stacks and emits deterministic parity report.

## Fixture Contract
Fixtures are defined in `solver/fixtures/linear_vectors.json`.
Each case includes:
- `id`
- `expect` (`solve` or `singular`)
- `matrix`
- `vector`
- optional expected solution metadata

## Tolerance Policy
- Default parity epsilon: `1e-6`
- Singular cases pass parity when both stacks return blocked/singular.
- Missing runtime tools (Python/g++) result in blocked parity status with explicit runtime flags.

## Browser UI
`index.html` includes:
- lightweight browser solve path for quick checks
- parity report viewer from `solver/output/parity-report.json`

## Blocked Conditions
- Missing Python or C++ compiler/runtime.
- Fixture parse failure.
- Matrix schema mismatch or singular system outside expected tags.
