#!/usr/bin/env python3
"""
LLM Cost Tracker - Track and analyze LLM usage costs
"""
import json
import csv
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

class CostTracker:
    def __init__(self, db_path="~/.llm-cost-tracker.json"):
        self.db_path = Path(db_path).expanduser()
        self.data = self.load()

    def load(self):
        if self.db_path.exists():
            return json.loads(self.db_path.read_text())
        return {"requests": []}

    def save(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db_path.write_text(json.dumps(self.data, indent=2))

    def add(self, model, input_tokens, output_tokens, cost=None):
        pricing = {
            "gpt-4": (0.03, 0.06),
            "gpt-4-32k": (0.06, 0.12),
            "gpt-3.5-turbo": (0.0015, 0.002),
            "claude-3-opus": (0.015, 0.075),
            "claude-3-sonnet": (0.003, 0.015),
            "claude-3-haiku": (0.00025, 0.00125),
            "gemini-pro": (0.00125, 0.005),
            "gemini-ultra": (0.0075, 0.03),
        }

        if cost is None and model in pricing:
            input_rate, output_rate = pricing[model]
            cost = (input_tokens / 1000 * input_rate) + (output_tokens / 1000 * output_rate)

        self.data["requests"].append({
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost": cost or 0
        })
        self.save()

    def report(self, days=30):
        cutoff = datetime.now() - timedelta(days=days)
        requests = [r for r in self.data["requests"] if datetime.fromisoformat(r["timestamp"]) >= cutoff]

        if not requests:
            print(f"No requests in last {days} days")
            return

        total_cost = sum(r["cost"] for r in requests)
        total_input = sum(r["input_tokens"] for r in requests)
        total_output = sum(r["output_tokens"] for r in requests)

        by_model = defaultdict(lambda: {"count": 0, "cost": 0, "tokens": 0})
        for r in requests:
            by_model[r["model"]]["count"] += 1
            by_model[r["model"]]["cost"] += r["cost"]
            by_model[r["model"]]["tokens"] += r["input_tokens"] + r["output_tokens"]

        print(f"\n=== LLM Cost Report ({days} days) ===")
        print(f"Total Requests: {len(requests)}")
        print(f"Total Cost: ${total_cost:.4f}")
        print(f"Total Tokens: {total_input + total_output:,}")
        print(f"\nBy Model:")
        for model, stats in sorted(by_model.items(), key=lambda x: -x[1]["cost"]):
            print(f"  {model}: ${stats['cost']:.4f} ({stats['count']} req, {stats['tokens']:,} tokens)")

    def export_csv(self, path):
        with open(path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["timestamp", "model", "input_tokens", "output_tokens", "cost"])
            writer.writeheader()
            for r in self.data["requests"]:
                writer.writerow(r)
        print(f"Exported to {path}")

def main():
    parser = argparse.ArgumentParser(description="LLM Cost Tracker")
    parser.add_argument("action", choices=["add", "report", "export"])
    parser.add_argument("--model", "-m", help="Model name")
    parser.add_argument("--input", "-i", type=int, help="Input tokens")
    parser.add_argument("--output", "-o", type=int, help="Output tokens")
    parser.add_argument("--cost", "-c", type=float, help="Cost (auto-calculated if omitted)")
    parser.add_argument("--days", "-d", type=int, default=30, help="Days for report")
    parser.add_argument("--path", "-p", help="Export path")

    args = parser.parse_args()
    tracker = CostTracker()

    if args.action == "add":
        if not args.model or args.input is None:
            print("Error: --model and --input required")
            return
        tracker.add(args.model, args.input, args.output or 0, args.cost)
        print(f"Added: {args.model} - ${args.cost or 'auto-calc'}")
    elif args.action == "report":
        tracker.report(args.days)
    elif args.action == "export":
        tracker.export_csv(args.path or "llm-costs.csv")

if __name__ == "__main__":
    main()
