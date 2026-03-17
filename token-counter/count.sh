#!/bin/bash
# Token Counter - Simple Bash Tool
# Estimates tokens, words, lines in text or files

if [ -z "$1" ]; then
    echo "Usage: $0 <file> or pipe text"
    echo "  -w  Show words"
    echo "  -l  Show lines"
    echo "  -c  Show characters"
    exit 1
fi

# Read from file or stdin
if [ -f "$1" ]; then
    text=$(cat "$1")
elif [ ! -t 0 ]; then
    text=$(cat)
else
    echo "Error: Provide file or pipe text"
    exit 1
fi

# Counts
chars=${#text}
words=$(echo "$text" | wc -w)
lines=$(echo "$text" | wc -l)
tokens=$((chars / 4))

# Show requested
while [ $# -gt 0 ]; do
    case "$1" in
        -w) echo "Words: $words"; shift ;;
        -l) echo "Lines: $lines"; shift ;;
        -c) echo "Chars: $chars"; shift ;;
        -t) echo "Tokens (est): $tokens"; shift ;;
        *) shift ;;
    esac
done

# Default output
if [ $# -eq 0 ]; then
    echo "Tokens (est): $tokens"
    echo "Words: $words"
    echo "Lines: $lines"
    echo "Chars: $chars"
fi
