"""Local git operations via subprocess with explicit branch workflow controls."""

from __future__ import annotations

import os
import subprocess
from datetime import datetime
from typing import List, Tuple

from core.logger import logger


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def run_git(args: List[str], cwd: str) -> Tuple[bool, str]:
    """Run git command, return (success, output), and print result."""
    cmd = ["git"] + args
    logger.info("GIT_OPS", f"Running: {' '.join(cmd)} (cwd={cwd})")
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            shell=False,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except Exception as exc:
        logger.error("GIT_OPS", f"Execution error: {exc}")
        return False, str(exc)

    output = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
    if proc.returncode == 0:
        logger.info("GIT_OPS", f"OK: {output[:300]}")
        return True, output

    logger.error("GIT_OPS", f"FAIL: {output[:400]}")
    return False, output


def ensure_repo(path: str, allow_init: bool = True) -> dict:
    """Ensure path is a git repo. Initialize if needed and allowed."""
    os.makedirs(path, exist_ok=True)
    git_dir = os.path.join(path, ".git")
    if os.path.isdir(git_dir):
        return {"success": True, "message": "Git repo exists", "initialized": False}

    if not allow_init:
        return {"success": False, "message": "Not a git repo and init disabled", "initialized": False}

    ok, out = run_git(["init"], cwd=path)
    if not ok:
        return {"success": False, "message": out, "initialized": False}

    run_git(["config", "user.name", "Fleet Bot"], cwd=path)
    run_git(["config", "user.email", "fleet-bot@example.local"], cwd=path)
    return {"success": True, "message": "Initialized git repo", "initialized": True}


def create_branch(repo_path: str, branch_name: str, auto_pull_main: bool = False) -> dict:
    """Checkout main, optionally pull, then create/switch target branch."""
    # A) Always checkout main first.
    ok_main, out_main = run_git(["checkout", "main"], cwd=repo_path)
    if not ok_main:
        ok_master, out_master = run_git(["checkout", "master"], cwd=repo_path)
        if not ok_master:
            return {
                "success": False,
                "branch": "",
                "message": f"Could not checkout main/master: {out_main} | {out_master}",
            }

    if auto_pull_main:
        run_git(["pull", "origin", "main"], cwd=repo_path)

    ok_exists, out_exists = run_git(["branch", "--list", branch_name], cwd=repo_path)
    if not ok_exists:
        return {"success": False, "branch": "", "message": out_exists}

    if out_exists.strip():
        ok_checkout, out_checkout = run_git(["checkout", branch_name], cwd=repo_path)
        return {
            "success": ok_checkout,
            "branch": branch_name if ok_checkout else "",
            "message": out_checkout,
        }

    ok_create, out_create = run_git(["checkout", "-b", branch_name], cwd=repo_path)
    return {
        "success": ok_create,
        "branch": branch_name if ok_create else "",
        "message": out_create,
    }


def commit_all(repo_path: str, message: str) -> dict:
    """git add -A && git commit. Return {success, sha, message}."""
    lock_path = os.path.join(repo_path, ".git", "index.lock")
    if os.path.exists(lock_path):
        try:
            os.remove(lock_path)
            logger.info("GIT_OPS", f"Removed stale lock: {lock_path}")
        except Exception as exc:
            logger.error("GIT_OPS", f"Could not remove lock {lock_path}: {exc}")

    ok_status, status_out = run_git(["status", "--porcelain"], cwd=repo_path)
    if not ok_status:
        return {"success": False, "sha": None, "message": status_out}
    if not status_out.strip():
        return {"success": False, "sha": None, "message": "No changes to commit"}

    ok_add, add_out = run_git(["add", "-A"], cwd=repo_path)
    if not ok_add:
        return {"success": False, "sha": None, "message": add_out}

    ok_commit, commit_out = run_git(["commit", "-m", message], cwd=repo_path)
    if not ok_commit:
        return {"success": False, "sha": None, "message": commit_out}

    ok_sha, sha_out = run_git(["rev-parse", "--short", "HEAD"], cwd=repo_path)
    sha = sha_out.strip() if ok_sha else None
    return {"success": True, "sha": sha, "message": commit_out}


def push(repo_path: str) -> dict:
    """git push -u origin HEAD."""
    ok, out = run_git(["push", "-u", "origin", "HEAD"], cwd=repo_path)
    return {"success": ok, "message": out}


def get_status(repo_path: str) -> str:
    """git status --short."""
    ok, out = run_git(["status", "--short"], cwd=repo_path)
    return out if ok else ""


def get_recent_commits(repo_path: str, n: int = 5) -> list:
    """Return list of {sha, message, author, date}."""
    fmt = "%h|%s|%an|%ad"
    ok, out = run_git(["log", f"-{n}", f"--pretty=format:{fmt}"], cwd=repo_path)
    if not ok or not out:
        return []

    commits = []
    for line in out.splitlines():
        parts = line.split("|", 3)
        if len(parts) == 4:
            commits.append(
                {
                    "sha": parts[0],
                    "message": parts[1],
                    "author": parts[2],
                    "date": parts[3],
                }
            )
    return commits


def get_current_branch(repo_path: str) -> str:
    """git branch --show-current."""
    ok, out = run_git(["branch", "--show-current"], cwd=repo_path)
    return out.strip() if ok else ""
