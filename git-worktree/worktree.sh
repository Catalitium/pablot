#!/bin/bash
# Git Worktree Manager - Manage multiple worktrees easily

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "Git Worktree Manager"
    echo "===================="
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                List all worktrees"
    echo "  add <name> <path>  Add new worktree"
    echo "  remove <name>     Remove worktree"
    echo "  prune              Clean up stale worktrees"
    echo "  status             Show status of all worktrees"
    echo ""
    echo "Examples:"
    echo "  $0 add feature ./features/my-feature"
    echo "  $0 remove feature"
    echo "  $0 status"
}

list_worktrees() {
    echo -e "${BLUE}=== Git Worktrees ===${NC}"
    echo ""

    worktrees=$(git worktree list --porcelain 2>/dev/null || echo "")

    if [ -z "$worktrees" ]; then
        echo "No worktrees found"
        return
    fi

    echo "$worktrees | while read -r line; do
        if [[ $line == worktree\ * ]]; then
            path="${line#worktree }"
            echo -e "  ${GREEN}✓${NC} $path"
        elif [[ $line == HEAD\ * ]]; then
            branch="${line#HEAD }"
            echo "    Branch: $branch"
        fi
    done
}

add_worktree() {
    local name="$1"
    local path="$2"

    if [ -z "$name" ] || [ -z "$path" ]; then
        echo -e "${RED}Error: Name and path required${NC}"
        echo "Usage: $0 add <name> <path>"
        exit 1
    fi

    if [ -d "$path" ]; then
        echo -e "${RED}Error: Path already exists: $path${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Creating worktree '$name' at $path...${NC}"
    git worktree add -b "$name" "$path"
    echo -e "${GREEN}Worktree created!${NC}"

    cd "$path"
    echo -e "\n${BLUE}New worktree ready at: $(pwd)${NC}"
}

remove_worktree() {
    local name="$1"

    if [ -z "$name" ]; then
        echo -e "${RED}Error: Worktree name required${NC}"
        echo "Usage: $0 remove <name>"
        exit 1
    fi

    # Find worktree path
    local path=$(git worktree list --porcelain | grep -B1 "refs/heads/$name" | head -1 | sed 's/worktree //')

    if [ -z "$path" ]; then
        echo -e "${RED}Error: Worktree '$name' not found${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Removing worktree: $path${NC}"
    git worktree remove "$path" --force 2>/dev/null || rm -rf "$path"
    git branch -D "$name" 2>/dev/null || true

    echo -e "${GREEN}Worktree removed!${NC}"
}

prune_worktrees() {
    echo -e "${YELLOW}Pruning stale worktrees...${NC}"
    git worktree prune
    echo -e "${GREEN}Prune complete!${NC}"
}

status_worktrees() {
    echo -e "${BLUE}=== Worktree Status ===${NC}\n"

    for wt in $(git worktree list --porcelain | grep "^worktree" | sed 's/worktree //'); do
        if [ -d "$wt/.git" ]; then
            cd "$wt"
            status=$(git status --short 2>/dev/null | head -5)
            if [ -n "$status" ]; then
                echo -e "${YELLOW}$wt${NC}"
                echo "$status" | sed 's/^/  /'
                echo ""
            else
                echo -e "${GREEN}✓ $wt${NC} - Clean"
            fi
        fi
    done
}

# Main
case "${1:-}" in
    list)
        list_worktrees
        ;;
    add)
        add_worktree "$2" "$3"
        ;;
    remove|rm)
        remove_worktree "$2"
        ;;
    prune)
        prune_worktrees
        ;;
    status|stat)
        status_worktrees
        ;;
    *)
        usage
        ;;
esac
