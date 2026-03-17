# System Health

A Python script that collects key system metrics, grades each one, and outputs a structured report to both the terminal and a dated log file.

## What It Does

Measures three metrics:

| Metric | A (Good) | B (Okay) | C (Poor) |
|--------|----------|----------|----------|
| CPU Usage | < 30% | 30–60% | > 60% |
| Memory Usage | < 50% | 50–75% | > 75% |
| Disk Usage | < 40% | 40–70% | > 70% |

Averages the grades numerically and outputs a single **Overall Grade (A / B / C)**.

## Usage

```bash
pip install psutil
python benchmark.py
```

A log file named `YYYYDDMM_system_health.log` is created in the working directory on each run.

## Output Example

```
2026-02-16 23:52:33 - INFO - ===== System Health Report =====
2026-02-16 23:52:33 - INFO - Report generated on: 2026-02-16 23:52:33
2026-02-16 23:52:34 - INFO - CPU Usage: 47.0%
2026-02-16 23:52:34 - INFO - Memory Usage: 91.8%
2026-02-16 23:52:34 - INFO - Disk Usage: 27.2%
2026-02-16 23:52:34 - INFO - CPU Grade: B
2026-02-16 23:52:34 - INFO - Memory Grade: C
2026-02-16 23:52:34 - INFO - Disk Grade: A
2026-02-16 23:52:34 - INFO - Final Grade: B
2026-02-16 23:52:34 - INFO - ===== End of Report =====
```

## Requirements

- Python 3.x
- `psutil`
