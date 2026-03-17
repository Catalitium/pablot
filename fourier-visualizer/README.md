# Fourier Visualizer

Tri-stack deterministic FFT parity project.

## Compute Roles
- `compute/reference_fft.py`: Python DFT reference output.
- `compute/perf_fft.cpp`: C++ DFT path using same fixture assumptions.
- `compute/run-parity.ps1`: runs both stacks, compares amplitudes, writes parity+benchmark report.

## Scope
- Fixture-based deterministic signal processing only.
- No realtime microphone capture in this scope.

## Tolerance
- Amplitude parity threshold default: `0.0005`.
- Missing runtimes (Python/g++) are reported as blocked in parity report.

## Output Files
- `compute/output/python-fft.json`
- `compute/output/cpp-fft.json`
- `compute/output/parity-benchmark-report.json`
