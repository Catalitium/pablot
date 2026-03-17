## cpu-benchmark-tester

`cpu-benchmark.ps1` is a standalone PowerShell 5.1+/7+ script that gathers basic system info, runs three quick micro-benchmarks (hash, memory sweep, integer primes), and emits both a human-readable report and machine-friendly CSV/JSON summaries. It is designed to stay deterministic, portable, and safe for non-admin users.

### Features
- CPU & memory info via CIM/WMI with safe fallbacks.
- HashBench-SHA256 (parallel when `-Threads` > 1), MemSweep bandwidth probe, CalcBench prime sieve with C# hot-path and PowerShell fallback.
- Tunable workload knobs: `-Quick` for sub-45s runs, `-DurationSec` to trade accuracy for speed (<0 falls back to default), `-Threads` with auto-detect capped at 8.
- Guardrails on memory usage (â‰¤ 25% of free RAM, â‰¤ 512â€¯MB) and GC between tests.
- Insights + scoring (A/B/C/D) with conservative thresholds; Grade A explicitly flagged as â€œtop-tierâ€.
- Thermal guard that samples CPU clocks before/after to flag throttling.
- Artifacts per run: timestamped `.txt` report plus CSV sidecar in `./reports/`. Optional single-line JSON via `-Json`.

### Prerequisites
- Windows PowerShell 5.1 or PowerShell 7+
- .NET BCL only; no external modules or network.
- No elevation required. Script automatically creates `./reports/`.

### How to Run 🚀
- **Default benchmark:** `.\cpu-benchmark.ps1` – full workload, writes TXT + CSV under `.\reports`.
- **⚡ Quick mode (<45 s):** `.\cpu-benchmark.ps1 -Quick` – trims data sizes but keeps guardrails.
- **🧵 Thread control:** `.\cpu-benchmark.ps1 -Threads 4` – sets workers manually (≤ 0 auto-detects, cap 8).
- **⏱️ Duration tweak:** `.\cpu-benchmark.ps1 -DurationSec 60` – scales workloads toward ~60 s (baseline 40 s quick / 120 s standard with 0.25–1.5× clamp).
- **📦 JSON output:** `.\cpu-benchmark.ps1 -Json | Out-File .\reports\last-run.json` – stdout emits single-line JSON while TXT/CSV still land in `.\reports`.

🛠️ Every run:
- Uses built-in PowerShell 5.1+ or 7+ (no modules, no admin).
- Auto-creates `.\reports` if missing and respects memory guardrails (≤ 25% free RAM, ≤ 512 MB, ≥ 32 MB).

### Output
Each run emits:
1. Console summary with per-test highlights, grade, and report paths.
2. `reports/cpu-benchmark-YYYYMMDD-HHmmss.txt` â€” includes system block, benchmark metrics, scores, insights, and disclaimer.
3. `reports/cpu-benchmark-YYYYMMDD-HHmmss.csv` â€” single-row CSV for spreadsheet tracking (grade, throughput, calc ms, threads, quick flag, duration scale, workload sizes, thermal drop).
4. Optional JSON (when `-Json`) for automation pipelines.

### Implementation Details
- Warm-up + Stopwatch timings, deterministic random buffers, SHA-256 digests recorded for determinism.
- Memory guard ensures buffers never exceed 25% of currently free RAM or 512â€¯MB (min 32â€¯MB).
- HashBench uses `ParallelHashUtil` (Add-Type) when >1 thread is requested; otherwise falls back to single-thread hashing.
- CalcBench prefers the in-memory C# sieve up to 2M/0.8M (scaled by `-DurationSec`), with a pure PowerShell fallback capped at 200k/100k to stay responsive.
- Scores: hash (MB/s), memory write/read (MB/s), calc (ms) â†’ blended into an overall 0â€“100 score before grading (A requires â‰¥90 overall and â‰¥70 per sub-test). Insights flag common bottlenecks or environment limitations.
- Thermal guard: samples `CurrentClockSpeed` via CIM; drops >10â€¯% are called out in insights.

### Notes
- Designed for deterministic repeatability; reruns with same flags on the same system should yield near-identical digests and metrics barring load variance.
- The tool is not an industry-standard benchmark; treat scores as heuristic guidance only.



