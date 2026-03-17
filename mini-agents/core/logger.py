"""Print-based structured logger for Mini-Agents Fleet v2."""

from __future__ import annotations

import os
from datetime import datetime


class Logger:
    """Simple print logger that also appends to logs/run-log.txt."""

    def __init__(self, log_dir: str = "logs", log_file: str = "run-log.txt") -> None:
        self.log_dir = log_dir
        self.log_path = os.path.join(log_dir, log_file)
        os.makedirs(self.log_dir, exist_ok=True)

    def _timestamp(self) -> str:
        return datetime.now().strftime("%H:%M:%S")

    def _write_line(self, line: str) -> None:
        print(line)
        os.makedirs(self.log_dir, exist_ok=True)
        with open(self.log_path, "a", encoding="utf-8") as handle:
            handle.write(line + "\n")

    def info(self, agent: str, msg: str) -> None:
        self._write_line(f"[{self._timestamp()}] [{agent}] {msg}")

    def error(self, agent: str, msg: str) -> None:
        self._write_line(f"[{self._timestamp()}] [{agent}] ERROR: {msg}")

    def success(self, agent: str, msg: str) -> None:
        self._write_line(f"[{self._timestamp()}] [{agent}] SUCCESS: {msg}")

    def section(self, title: str) -> None:
        border = "=" * 60
        self._write_line("")
        self._write_line(border)
        self._write_line(f"  {title}")
        self._write_line(border)


logger = Logger()

