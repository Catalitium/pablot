#!/usr/bin/env python3
"""Read-only system health report.

Runs locally and prints a compact JSON report. If psutil is installed, CPU and
memory percentages are included; otherwise the script still reports platform
and disk information using the Python standard library.
"""

from __future__ import annotations

import json
import platform
import shutil
from datetime import datetime, timezone

try:
    import psutil
except ImportError:  # pragma: no cover - depends on local environment
    psutil = None


def grade(value: float | None, good: float, okay: float) -> str:
    if value is None:
        return "unknown"
    if value < good:
        return "A"
    if value < okay:
        return "B"
    return "C"


def main() -> None:
    disk = shutil.disk_usage("/")
    disk_used_percent = round((disk.used / disk.total) * 100, 2)

    cpu_percent = None
    memory_percent = None
    if psutil is not None:
        cpu_percent = round(psutil.cpu_percent(interval=1), 2)
        memory_percent = round(psutil.virtual_memory().percent, 2)

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system": {
            "hostname": platform.node(),
            "os": platform.platform(),
            "python": platform.python_version(),
        },
        "metrics": {
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent,
            "disk_percent": disk_used_percent,
        },
        "grades": {
            "cpu": grade(cpu_percent, 30, 60),
            "memory": grade(memory_percent, 50, 75),
            "disk": grade(disk_used_percent, 40, 70),
        },
        "notes": [
            "Read-only local report.",
            "Install psutil for CPU and memory percentages.",
        ],
    }

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
