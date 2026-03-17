#!/usr/bin/env python3
"""cache-clean-commander – preview and purge cache/temp folders safely."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import queue
import subprocess
import sys
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence

import tkinter as tk
from tkinter import messagebox, ttk

def discover_targets(extra_paths: Sequence[str]) -> List[str]:
    paths: List[str] = []
    temp = os.environ.get("TEMP")
    if temp and os.path.exists(temp):
        paths.append(temp)
    local_temp = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Temp")
    if os.path.exists(local_temp):
        paths.append(local_temp)
    chrome_cache = os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        "Google",
        "Chrome",
        "User Data",
        "Default",
        "Cache",
    )
    if os.path.exists(chrome_cache):
        paths.append(chrome_cache)
    edge_cache = os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        "Microsoft",
        "Edge",
        "User Data",
        "Default",
        "Cache",
    )
    if os.path.exists(edge_cache):
        paths.append(edge_cache)
    for path in extra_paths:
        if os.path.exists(path):
            paths.append(path)
    deduped: List[str] = []
    seen = set()
    for path in paths:
        if path not in seen:
            seen.add(path)
            deduped.append(path)
    return deduped


def get_dir_stats(path: str, include: Sequence[str] | None = None, exclude: Sequence[str] | None = None) -> Dict:
    total_size = 0
    total_files = 0
    for root, dirs, files in os.walk(path):
        for fname in files:
            full_path = os.path.join(root, fname)
            if not _matches_patterns(full_path, include, exclude):
                continue
            try:
                total_size += os.path.getsize(full_path)
                total_files += 1
            except OSError:
                continue
    return {"path": path, "bytes": total_size, "files": total_files}


def _matches_patterns(path: str, include: Sequence[str] | None, exclude: Sequence[str] | None) -> bool:
    from fnmatch import fnmatch

    if include:
        if not any(fnmatch(path, pattern) for pattern in include):
            return False
    if exclude:
        if any(fnmatch(path, pattern) for pattern in exclude):
            return False
    return True


def format_bytes(size: int) -> str:
    if size >= 1024**3:
        return f"{size / 1024**3:.2f} GB"
    if size >= 1024**2:
        return f"{size / 1024**2:.2f} MB"
    if size >= 1024:
        return f"{size / 1024:.2f} KB"
    return f"{size} B"


def ensure_log_dir() -> Path:
    path = Path.home() / "Documents" / "CacheCleanCommander" / "logs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_log(entries: List[Dict]) -> Path:
    log_dir = ensure_log_dir()
    log_path = log_dir / f"clean-{dt.datetime.now():%Y%m%d-%H%M%S}.csv"
    headers = ["Path", "Action", "DeletedFiles", "FreedBytes", "Message"]
    with log_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        for entry in entries:
            writer.writerow({h: entry.get(h, "") for h in headers})
    return log_path


def clean_path(
    path: str,
    whatif: bool,
    include: Sequence[str] | None = None,
    exclude: Sequence[str] | None = None,
) -> Dict[str, str]:
    deleted = 0
    freed = 0
    message = ""
    action = "WhatIf" if whatif else "Clean"
    try:
        for root, dirs, files in os.walk(path):
            for fname in files:
                full = os.path.join(root, fname)
                if not _matches_patterns(full, include, exclude):
                    continue
                try:
                    size = os.path.getsize(full)
                except OSError:
                    continue
                if not whatif:
                    try:
                        os.remove(full)
                    except OSError as exc:
                        message = str(exc)
                        continue
                freed += size
                deleted += 1
        if not whatif:
            for root, dirs, _ in os.walk(path, topdown=False):
                for dname in dirs:
                    dpath = os.path.join(root, dname)
                    if not os.listdir(dpath):
                        try:
                            os.rmdir(dpath)
                        except OSError:
                            continue
    except Exception as exc:  # pragma: no cover - defensive
        action = "Error"
        message = str(exc)
    return {
        "Path": path,
        "Action": action,
        "DeletedFiles": deleted,
        "FreedBytes": freed,
        "Message": message,
    }


def analyze_targets(
    targets: Sequence[str],
    include: Sequence[str] | None = None,
    exclude: Sequence[str] | None = None,
) -> List[Dict]:
    return [get_dir_stats(t, include, exclude) for t in targets if os.path.exists(t)]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="cache-clean-commander")
    parser.add_argument("--whatif", action="store_true", help="Simulate clean actions.")
    parser.add_argument(
        "--cli",
        choices=["analyze", "clean"],
        help="Run in CLI mode instead of launching the GUI.",
    )
    parser.add_argument("--include", action="append", help="Glob pattern(s) to include.")
    parser.add_argument("--exclude", action="append", help="Glob pattern(s) to exclude.")
    parser.add_argument(
        "--open-logs",
        action="store_true",
        help="Open log directory and exit.",
    )
    parser.add_argument("paths", nargs="*", help="Additional paths to analyze/clean")
    return parser


def run_cli(args: argparse.Namespace) -> int:
    targets = discover_targets(args.paths)
    if not targets:
        print("No targets found.", file=sys.stderr)
        return 1
    if args.cli == "analyze":
        stats = analyze_targets(targets, args.include, args.exclude)
        print(json.dumps(stats, indent=2))
        return 0
    if args.cli == "clean":
        entries = [
            clean_path(path, args.whatif, args.include, args.exclude) for path in targets
        ]
        log_path = write_log(entries)
        print(json.dumps(entries, indent=2))
        print(f"Log saved to {log_path}")
        return 0
    return 0


@dataclass
class GuiState:
    root: tk.Tk
    targets: List[str]
    include: Sequence[str] | None
    exclude: Sequence[str] | None
    whatif: bool


class CacheCleanGUI:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.root = tk.Tk()
        self.root.title("cache-clean-commander")
        self.root.geometry("780x560")
        self.target_vars: Dict[str, tk.BooleanVar] = {}
        self.progress = ttk.Progressbar(self.root, orient="horizontal", length=740, mode="determinate")
        self.tree = ttk.Treeview(self.root, columns=("Path", "Files", "Size"), show="headings")
        self.status = tk.Label(self.root, text="Ready", anchor="w")
        self._build_ui()

    def _build_ui(self) -> None:
        tk.Label(self.root, text="Select targets to analyze / clean:").pack(anchor="w", padx=10, pady=(10, 0))
        frame = tk.Frame(self.root)
        frame.pack(fill="both", padx=10, pady=10)
        targets = discover_targets(self.args.paths)
        for path in targets:
            var = tk.BooleanVar(value=True)
            cb = tk.Checkbutton(frame, text=path, variable=var, anchor="w")
            cb.pack(fill="x", anchor="w")
            self.target_vars[path] = var
        btn_frame = tk.Frame(self.root)
        btn_frame.pack(fill="x", padx=10)
        tk.Button(btn_frame, text="Analyze", command=self.analyze).pack(side="left")
        tk.Button(btn_frame, text="Clean", command=self.clean).pack(side="left", padx=5)
        tk.Button(btn_frame, text="Open Logs", command=open_logs).pack(side="left")
        self.progress.pack(fill="x", padx=10, pady=10)
        self.tree.heading("Path", text="Path")
        self.tree.heading("Files", text="Files")
        self.tree.heading("Size", text="Size")
        self.tree.column("Path", width=520)
        self.tree.column("Files", width=80, anchor="e")
        self.tree.column("Size", width=120, anchor="e")
        self.tree.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.status.pack(fill="x", padx=10, pady=(0, 10))

    def selected_targets(self) -> List[str]:
        return [path for path, var in self.target_vars.items() if var.get()]

    def analyze(self) -> None:
        targets = self.selected_targets()
        if not targets:
            messagebox.showinfo("Info", "Select at least one target.")
            return
        self._run_async(
            lambda: analyze_targets(targets, self.args.include, self.args.exclude),
            self._populate_tree,
            "Analyzing...",
        )

    def clean(self) -> None:
        targets = self.selected_targets()
        if not targets:
            messagebox.showinfo("Info", "Select at least one target.")
            return
        if not messagebox.askyesno(
            "Confirm", "Proceed to delete cache files?" if not self.args.whatif else "Simulate clean (WhatIf)?"
        ):
            return
        self._run_async(
            lambda: [
                clean_path(path, self.args.whatif, self.args.include, self.args.exclude) for path in targets
            ],
            self._handle_clean_results,
            "Cleaning..." if not self.args.whatif else "Simulating clean...",
        )

    def _populate_tree(self, stats: List[Dict]) -> None:
        for item in self.tree.get_children():
            self.tree.delete(item)
        for stat in stats:
            self.tree.insert(
                "",
                "end",
                values=(stat["path"], stat["files"], format_bytes(stat["bytes"])),
            )
        self.status.configure(text=f"Analyzed {len(stats)} target(s).")

    def _handle_clean_results(self, entries: List[Dict]) -> None:
        log_path = write_log(entries)
        self.status.configure(text=f"Clean finished. Log saved to {log_path}")
        messagebox.showinfo("Done", f"Finished. Log saved to\n{log_path}")
        self._populate_tree(analyze_targets(self.selected_targets(), self.args.include, self.args.exclude))

    def _run_async(self, worker, callback, status_text: str) -> None:
        self.progress.configure(value=0, maximum=100)
        self.status.configure(text=status_text)
        q: queue.Queue = queue.Queue()

        def task():
            result = worker()
            q.put(result)

        threading.Thread(target=task, daemon=True).start()

        def poll():
            try:
                result = q.get_nowait()
            except queue.Empty:
                current = self.progress["value"]
                self.progress.configure(value=min(current + 5, 95))
                self.root.after(100, poll)
            else:
                self.progress.configure(value=100)
                callback(result)

        poll()

    def run(self) -> None:
        self.root.mainloop()


def open_logs() -> None:
    log_dir = ensure_log_dir()
    if os.name == "nt":
        subprocess.Popen(["explorer", str(log_dir)])
    else:
        subprocess.Popen(["open" if sys.platform == "darwin" else "xdg-open", str(log_dir)])


def main(argv: List[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.open_logs:
        open_logs()
        return 0
    if args.cli:
        return run_cli(args)
    gui = CacheCleanGUI(args)
    gui.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
