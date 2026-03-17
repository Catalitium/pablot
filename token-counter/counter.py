#!/usr/bin/env python3
"""
Quick Token Counter - Python CLI
Simple, no-dependency token estimator for any text
"""
import sys
import argparse
import json
from pathlib import Path

# Simple tokenizer (approximate)
def estimate_tokens(text: str, method: str = "char4") -> int:
    """Estimate token count using various methods"""
    if not text:
        return 0

    if method == "char4":
        # Rough: ~4 chars per token (English)
        return len(text) // 4
    elif method == "word":
        # Better: ~1.3 tokens per word
        words = text.split()
        return int(len(words) * 1.3)
    elif method == "openai":
        # Best approximation for tiktoken-style
        # Count words, then adjust for common patterns
        words = text.split()
        special = text.count('```') * 20  # Code blocks
        return int(len(words) * 1.1) + special

    return len(text) // 4

def format_cost(tokens: int, model: str = "gpt-4") -> float:
    """Calculate approximate API cost"""
    pricing = {
        "gpt-4": (0.03, 0.06),
        "gpt-3.5": (0.0015, 0.002),
        "claude-3-opus": (0.015, 0.075),
        "claude-3-sonnet": (0.003, 0.015),
        "claude-3-haiku": (0.00025, 0.00125),
        "gemini-pro": (0.00125, 0.005),
    }

    if model not in pricing:
        model = "gpt-4"

    # Assume 80% input, 20% output split
    input_tokens = int(tokens * 0.8)
    output_tokens = int(tokens * 0.2)

    input_rate, output_rate = pricing[model]
    cost = (input_tokens / 1000 * input_rate) + (output_tokens / 1000 * output_rate)

    return round(cost, 6)

def main():
    parser = argparse.ArgumentParser(description="Quick token counter")
    parser.add_argument("file", nargs="?", help="File to count (or stdin)")
    parser.add_argument("-m", "--method", choices=["char4", "word", "openai"], default="char4", help="Estimation method")
    parser.add_argument("-c", "--cost", action="store_true", help="Show cost estimate")
    parser.add_argument("-M", "--model", default="gpt-4", help="Model for cost calculation")
    parser.add_argument("-j", "--json", action="store_true", help="Output JSON")
    parser.add_argument("-w", "--words", action="store_true", help="Show word count")
    parser.add_argument("-l", "--lines", action="store_true", help="Show line count")

    args = parser.parse_args()

    # Read input
    if args.file:
        text = Path(args.file).read_text(encoding="utf-8")
    else:
        text = sys.stdin.read()

    # Calculate metrics
    tokens = estimate_tokens(text, args.method)
    words = len(text.split())
    lines = text.count('\n') + 1
    chars = len(text)

    result = {
        "tokens": tokens,
        "chars": chars,
    }

    if args.words:
        result["words"] = words
    if args.lines:
        result["lines"] = lines
    if args.cost:
        result["cost_usd"] = format_cost(tokens, args.model)

    # Output
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Tokens:  {tokens:,}")
        if args.words:
            print(f"Words:   {words:,}")
        if args.lines:
            print(f"Lines:   {lines:,}")
        print(f"Chars:   {chars:,}")
        if args.cost:
            print(f"Cost:    ${format_cost(tokens, args.model):.6f} ({args.model})")

if __name__ == "__main__":
    main()
