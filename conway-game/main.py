#!/usr/bin/env python3
"""Dependency-free Conway's Game of Life CLI helper."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass


PATTERNS = {
    "block": [(0, 0), (0, 1), (1, 0), (1, 1)],
    "blinker": [(0, 0), (0, 1), (0, 2)],
    "toad": [(0, 1), (0, 2), (0, 3), (1, 0), (1, 1), (1, 2)],
    "beacon": [(0, 0), (0, 1), (1, 0), (2, 3), (3, 2), (3, 3)],
    "glider": [(0, 1), (1, 2), (2, 0), (2, 1), (2, 2)],
    "lwss": [(0, 1), (0, 4), (1, 0), (2, 0), (2, 4), (3, 0), (3, 1), (3, 2), (3, 3)],
    "pulsar": [
        (0, 2), (0, 3), (0, 4), (0, 8), (0, 9), (0, 10),
        (2, 0), (3, 0), (4, 0), (2, 5), (3, 5), (4, 5),
        (2, 7), (3, 7), (4, 7), (2, 12), (3, 12), (4, 12),
        (5, 2), (5, 3), (5, 4), (5, 8), (5, 9), (5, 10),
        (7, 2), (7, 3), (7, 4), (7, 8), (7, 9), (7, 10),
        (8, 0), (9, 0), (10, 0), (8, 5), (9, 5), (10, 5),
        (8, 7), (9, 7), (10, 7), (8, 12), (9, 12), (10, 12),
        (12, 2), (12, 3), (12, 4), (12, 8), (12, 9), (12, 10),
    ],
}


@dataclass
class Life:
    size: int
    cells: set[tuple[int, int]]

    @classmethod
    def from_pattern(cls, size: int, pattern: str) -> "Life":
        if pattern not in PATTERNS:
            raise ValueError(f"Unknown pattern: {pattern}")
        coords = PATTERNS[pattern]
        max_row = max(row for row, _ in coords)
        max_col = max(col for _, col in coords)
        start_row = (size - max_row - 1) // 2
        start_col = (size - max_col - 1) // 2
        return cls(size, {(start_row + row, start_col + col) for row, col in coords})

    def neighbors(self, row: int, col: int) -> int:
        total = 0
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == 0 and dc == 0:
                    continue
                total += ((row + dr) % self.size, (col + dc) % self.size) in self.cells
        return total

    def step(self) -> None:
        candidates = set(self.cells)
        for row, col in list(self.cells):
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    candidates.add(((row + dr) % self.size, (col + dc) % self.size))

        next_cells = set()
        for row, col in candidates:
            count = self.neighbors(row, col)
            if (row, col) in self.cells and count in (2, 3):
                next_cells.add((row, col))
            elif (row, col) not in self.cells and count == 3:
                next_cells.add((row, col))
        self.cells = next_cells

    def rows(self) -> list[str]:
        return [
            "".join("#" if (row, col) in self.cells else "." for col in range(self.size))
            for row in range(self.size)
        ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a Conway's Game of Life pattern.")
    parser.add_argument("--pattern", choices=sorted(PATTERNS), default="glider")
    parser.add_argument("--steps", type=int, default=5)
    parser.add_argument("--size", type=int, default=20)
    parser.add_argument("--json", action="store_true", help="Print JSON instead of a text grid.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.size < 5:
        raise SystemExit("--size must be at least 5")
    if args.steps < 0:
        raise SystemExit("--steps must be 0 or greater")

    life = Life.from_pattern(args.size, args.pattern)
    history = [len(life.cells)]
    for _ in range(args.steps):
        life.step()
        history.append(len(life.cells))

    if args.json:
        print(json.dumps({
            "pattern": args.pattern,
            "size": args.size,
            "steps": args.steps,
            "population": len(life.cells),
            "population_history": history,
            "live_cells": sorted([list(cell) for cell in life.cells]),
        }, indent=2))
    else:
        print(f"Pattern: {args.pattern}")
        print(f"Steps: {args.steps}")
        print(f"Population: {len(life.cells)}")
        print("\n".join(life.rows()))


if __name__ == "__main__":
    main()
