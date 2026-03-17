import json
import math
import sys
from pathlib import Path

EPS = 1e-9


def solve_system(matrix, vector):
    n = len(matrix)
    if n == 0:
        raise ValueError("empty matrix")
    if any(len(row) != n for row in matrix):
        raise ValueError("matrix must be square")
    if len(vector) != n:
        raise ValueError("dimension mismatch")

    aug = [list(row) + [vector[i]] for i, row in enumerate(matrix)]

    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot][col]) < EPS:
            raise ValueError("singular")
        if pivot != col:
            aug[col], aug[pivot] = aug[pivot], aug[col]

        for r in range(col + 1, n):
            factor = aug[r][col] / aug[col][col]
            for c in range(col, n + 1):
                aug[r][c] -= factor * aug[col][c]

    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        s = aug[i][n]
        for j in range(i + 1, n):
            s -= aug[i][j] * x[j]
        x[i] = s / aug[i][i]
    return x


def run(fixtures):
    results = []
    for case in fixtures:
        case_id = case.get("id", "unknown")
        try:
            solution = solve_system(case["matrix"], case["vector"])
            status = "pass"
            error = ""
        except Exception as exc:
            solution = []
            status = "blocked" if case.get("expect") == "singular" else "fail"
            error = str(exc)

        results.append(
            {
                "case_id": case_id,
                "status": status,
                "solution": solution,
                "expected": case.get("expected_solution", []),
                "expect": case.get("expect", "solve"),
                "error": error,
            }
        )
    return {
        "solver": "python_reference",
        "epsilon": EPS,
        "results": results,
    }


def main():
    if len(sys.argv) != 3:
        print("usage: reference_solver.py <fixtures.json> <out.json>")
        sys.exit(2)

    fixture_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])

    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    fixtures = payload.get("cases", [])
    report = run(fixtures)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
