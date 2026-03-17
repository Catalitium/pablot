import json
import math
import sys
from pathlib import Path

EPS = 1e-9


def dft(samples, sample_rate):
    n = len(samples)
    bins = n // 2
    out = []
    for k in range(bins):
        re = 0.0
        im = 0.0
        for i, sample in enumerate(samples):
            angle = -2.0 * math.pi * k * i / n
            re += sample * math.cos(angle)
            im += sample * math.sin(angle)
        amp = math.sqrt(re * re + im * im) / n
        freq = k * sample_rate / n
        out.append({"frequency": round(freq, 6), "amplitude": round(amp, 12)})
    return out


def top_bins(spec, count=5):
    return sorted(spec, key=lambda x: x["amplitude"], reverse=True)[:count]


def run(fixtures):
    cases = []
    for sig in fixtures:
        samples = sig.get("samples", [])
        sample_rate = sig.get("sample_rate", 64)
        spectrum = dft(samples, sample_rate)
        cases.append(
            {
                "case_id": sig.get("id", "unknown"),
                "status": "pass",
                "dominant_bins": top_bins(spectrum, 6),
                "spectrum": spectrum,
            }
        )
    return {"solver": "python_reference_fft", "epsilon": EPS, "cases": cases}


def main():
    if len(sys.argv) != 3:
        print("usage: reference_fft.py <fixtures.json> <out.json>")
        sys.exit(2)

    fixture_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    report = run(payload.get("signals", []))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
