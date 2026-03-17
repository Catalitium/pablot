#!/bin/bash
# Git Helper - Common git operations simplified

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if in git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Not in a git repository${NC}"
    exit 1
fi

case "$1" in
    s|status)
        git status
        ;;
    a|add)
        git add "${2:-.}"
        git status
        ;;
    c|commit)
        if [ -z "$2" ]; then
            echo -e "${YELLOW}Usage: git-helper commit <message>${NC}"
            exit 1
        fi
        git add -A
        git commit -m "$2"
        ;;
    p|push)
        git push "${2:-origin}" "${3:-HEAD}"
        ;;
    pl|pull)
        git pull "${2:-origin}" "${3:-HEAD}"
        ;;
    co|checkout)
        git checkout "$2"
        ;;
    br|branch)
        if [ -z "$2" ]; then
            git branch -a
        else
            git checkout -b "$2"
        fi
        ;;
    l|log)
        git log --oneline -"${2:-10}"
        ;;
    d|diff)
        git diff "${2:-HEAD}"
        ;;
    r|reset)
        if [ "$2" = "hard" ]; then
            git reset --hard "${3:-HEAD}"
        else
            git reset "${2:-HEAD}"
        fi
        ;;
    stash)
        if [ "$2" = "pop" ]; then
            git stash pop
        elif [ "$2" = "list" ]; then
            git stash list
        else
            git stash push -m "${2:-WIP}"
        fi
        ;;
    amend)
        git commit --amend --no-edit
        ;;
    clean)
        git clean -fd
        ;;
    tags)
        git tag -l --sort=-v:refname | head -"${2:-10}"
        ;;
    contributors)
        git shortlog -sn --all | head -"${2:-10}"
        ;;
    undo)
        git reset --soft HEAD~1
        ;;
    aliases)
        echo "Available aliases:"
        echo "  s, status   - Show working tree status"
        echo "  a, add      - Stage changes"
        echo "  c, commit   - Commit with message"
        echo "  p, push     - Push to remote"
        echo "  pl, pull    - Pull from remote"
        echo "  co, checkout- Switch branches"
        echo "  br, branch  - List/create branches"
        echo "  l, log      - Show recent commits"
        echo "  d, diff     - Show changes"
        echo "  r, reset    - Reset HEAD"
        echo "  stash       - Stash changes"
        echo "  amend       - Amend last commit"
        echo "  clean       - Remove untracked"
        echo "  tags        - List tags"
        echo "  contributors- Top contributors"
        echo "  undo        - Undo last commit"
        ;;
    *)
        echo -e "${BLUE}Git Helper${NC}"
        echo "Usage: git-helper <command> [args]"
        echo ""
        echo "Commands:"
        echo "  s, status    - Status"
        echo "  a, add       - Stage"
        echo "  c, commit    - Commit"
        echo "  p, push      - Push"
        echo "  pl, pull     - Pull"
        echo "  co, checkout - Checkout"
        echo "  br, branch   - Branch"
        echo "  l, log       - Log"
        echo "  d, diff      - Diff"
        echo "  r, reset     - Reset"
        echo "  stash        - Stash"
        echo "  amend        - Amend"
        echo "  clean        - Clean"
        echo "  tags         - Tags"
        echo "  contributors - Contributors"
        echo "  undo         - Undo commit"
        echo "  aliases      - Show this help"
        ;;
esac
