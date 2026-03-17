#!/usr/bin/env python3
"""
Case Converter - Convert between naming conventions
Supports: camelCase, snake_case, kebab-case, PascalCase, CONSTANT_CASE, dot.case, slash/case
"""
import sys
import re
import argparse

def to_camel(text: str) -> str:
    words = re.split(r'[-_\s]+', text)
    return words[0].lower() + ''.join(w.capitalize() for w in words[1:])

def to_snake(text: str) -> str:
    # Handle PascalCase or camelCase
    text = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', text)
    text = re.sub(r'([a-z\d])([A-Z])', r'\1_\2', text)
    text = re.sub(r'[-.\s]+', '_', text)
    return text.lower().strip('_')

def to_kebab(text: str) -> str:
    return to_snake(text).replace('_', '-')

def to_pascal(text: str) -> str:
    words = re.split(r'[-_\s]+', text)
    return ''.join(w.capitalize() for w in words if w)

def to_constant(text: str) -> str:
    return to_snake(text).upper()

def to_dot(text: str) -> str:
    return to_snake(text).replace('_', '.')

def to_slash(text: str) -> str:
    return to_snake(text).replace('_', '/')

def to_title(text: str) -> str:
    words = re.split(r'[-_\s]+', text)
    return ' '.join(w.capitalize() for w in words)

def to_sentence(text: str) -> str:
    snake = to_snake(text)
    return snake.replace('_', ' ').capitalize()

CONVERTERS = {
    'camel': to_camel,
    'snake': to_snake,
    'kebab': to_kebab,
    'pascal': to_pascal,
    'constant': to_constant,
    'dot': to_dot,
    'slash': to_slash,
    'title': to_title,
    'sentence': to_sentence,
}

def main():
    parser = argparse.ArgumentParser(description="Case Converter")
    parser.add_argument("text", nargs="?", help="Text to convert")
    parser.add_argument("-c", "--case", choices=list(CONVERTERS.keys()), default="snake", help="Target case")
    parser.add_argument("-a", "--all", action="store_true", help="Show all conversions")
    parser.add_argument("-i", "--interactive", action="store_true", help="Interactive mode")

    args = parser.parse_args()

    if args.interactive:
        print("Case Converter - Type 'q' to quit")
        while True:
            text = input("\n> ").strip()
            if text.lower() == 'q':
                break
            if not text:
                continue
            for name, func in CONVERTERS.items():
                print(f"  {name:12} : {func(text)}")
        return

    if args.all:
        if not args.text:
            print("Provide text to convert")
            return
        print(f"Input: {args.text}\n")
        for name, func in CONVERTERS.items():
            print(f"{name:12} : {func(args.text)}")
        return

    if not args.text:
        # Interactive via stdin
        text = sys.stdin.read().strip()
        if not text:
            parser.print_help()
            return
    else:
        text = args.text

    result = CONVERTERS[args.case](text)
    print(result)

if __name__ == "__main__":
    main()
