#!/usr/bin/env python3
"""
Git Helper - Rich Terminal Git Commands
"""
import subprocess
import argparse
import os
from pathlib import Path

try:
    from rich.console import Console
    from rich.table import Table
    from rich.tree import Tree
    from rich.panel import Panel
    console = Console()
except ImportError:
    console = print

def run(cmd, cwd=None):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    return result.stdout.strip(), result.returncode

def status():
    out, code = run("git status --short")
    if not out:
        console.print("[yellow]Nothing to commit[/yellow]")
        return
    table = Table(show_header=True)
    table.add_column("Status", style="cyan")
    table.add_column("File")
    for line in out.split('\n'):
        if line:
            status = line[:2].strip()
            file = line[3:]
            color = "green" if status in ("M", "A") else "red" if status == "D" else "yellow"
            table.add_row(f"[{color}]{status}[/{color}]", file)
    console.print(table)

def log(n=10):
    out, _ = run(f"git log --oneline -n {n}")
    for i, line in enumerate(out.split('\n'), 1):
        if line:
            console.print(f"[cyan]{i:2}[/cyan] {line}")

def branch():
    out, _ = run("git branch -a")
    current, _ = run("git rev-parse --abbrev-ref HEAD")
    for line in out.split('\n'):
        if line:
            is_current = current in line
            marker = "[green]*[/green]" if is_current else " "
            console.print(f"{marker} {line}")

def diff(file=""):
    out, _ = run(f"git diff {file}")
    if out:
        console.print(out)
    else:
        console.print("[yellow]No changes[/yellow]")

def add(files="."):
    out, code = run(f"git add {files}")
    console.print(f"[green]Added {files}[/green]")

def commit(msg):
    out, code = run(f'git commit -m "{msg}"')
    if code == 0:
        console.print("[green]Committed![/green]")
    else:
        console.print(f"[red]{out}[/red]")

def push(branch=""):
    b = f"origin {branch}" if branch else "origin"
    out, code = run(f"git push {b}")
    if code == 0:
        console.print("[green]Pushed![/green]")
    else:
        console.print(f"[red]{out}[/red]")

def pull():
    out, code = run("git pull")
    console.print(out if out else "[green]Pulled![/green]")

def stash():
    out, _ = run("git stash")
    console.print("[green]Stashed![/green]" if "Saved" in out else "[yellow]Nothing to stash[/yellow]")

def stash_pop():
    out, code = run("git stash pop")
    console.print("[green]Stash popped![/green]")

def undo():
    out, _ = run("git reset --soft HEAD~1")
    console.print("[yellow]Undid last commit[/yellow]")

def clean():
    out, _ = run("git clean -fd")
    console.print("[yellow]Cleaned untracked files[/yellow]")

def aliases():
    console.print("""
[bold]Quick Aliases:[/bold]
  gs    → git status
  gl    → git log
  gb    → git branch
  gd    → git diff
  ga    → git add
  gc    → git commit
  gp    → git push
  gpl   → git pull
  gst    → git stash
  gsp    → git stash pop
  gundo  → git undo (soft reset)
  gclean → git clean
""")

def main():
    parser = argparse.ArgumentParser(description="Git Helper")
    parser.add_argument("cmd", nargs="?", help="Command")
    parser.add_argument("args", nargs="*", help="Arguments")

    args = parser.parse_args()
    cmd = args.cmd

    commands = {
        "status": status,
        "st": status,
        "log": lambda: log(int(args.args[0]) if args.args else 10),
        "l": log,
        "branch": branch,
        "b": branch,
        "diff": lambda: diff(args.args[0] if args.args else ""),
        "d": diff,
        "add": lambda: add(args.args[0] if args.args else "."),
        "a": add,
        "commit": lambda: commit(" ".join(args.args)),
        "c": commit,
        "push": lambda: push(args.args[0] if args.args else ""),
        "p": push,
        "pull": pull,
        "pl": pull,
        "stash": stash,
        "stk": stash,
        "stash-pop": stash_pop,
        "sp": stash_pop,
        "undo": undo,
        "clean": clean,
        "aliases": aliases,
    }

    if not cmd or cmd == "help":
        aliases()
    elif cmd in commands:
        commands[cmd]()
    else:
        console.print(f"[red]Unknown command: {cmd}[/red]")
        aliases()

if __name__ == "__main__":
    main()
