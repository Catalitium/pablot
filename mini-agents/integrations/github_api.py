"""GitHub REST API client using urllib with multi-source token resolution."""

from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional, Tuple

from core.logger import logger

GITHUB_API_BASE = "https://api.github.com"
_TOKEN_CACHE = None


def parse_owner_repo_from_remote(remote_url: str) -> Tuple[str, str]:
    """Parse owner/repo from HTTPS or SSH GitHub remote URLs."""
    remote = (remote_url or "").strip()
    if not remote:
        return "", ""

    patterns = [
        r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/.]+)(?:\.git)?$",
        r"git@github\.com:(?P<owner>[^/]+)/(?P<repo>[^/.]+)(?:\.git)?$",
    ]
    for pattern in patterns:
        match = re.search(pattern, remote)
        if match:
            return match.group("owner"), match.group("repo")
    return "", ""


def _extract_token_from_url(url: str) -> str:
    # Supports URLs like https://user:gho_xxx@github.com/owner/repo.git
    match = re.search(r"https://[^:]+:(gh[op]_[A-Za-z0-9_]+)@github\.com/", url)
    if match:
        return match.group(1)
    return ""


def _discover_token_from_remotes() -> str:
    base = r"C:\Users\catal\Desktop\code-base"
    if not os.path.isdir(base):
        return ""

    for name in sorted(os.listdir(base)):
        repo_path = os.path.join(base, name)
        if not os.path.isdir(repo_path):
            continue
        if not os.path.isdir(os.path.join(repo_path, ".git")):
            continue
        try:
            proc = subprocess.run(
                ["git", "remote", "get-url", "origin"],
                cwd=repo_path,
                shell=False,
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
        except Exception:
            continue
        if proc.returncode != 0:
            continue
        token = _extract_token_from_url((proc.stdout or "").strip())
        if token:
            return token
    return ""


def _discover_token_from_gh_cli() -> str:
    try:
        proc = subprocess.run(
            ["gh", "auth", "token"],
            shell=False,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except Exception:
        return ""
    if proc.returncode == 0:
        return (proc.stdout or "").strip()
    return ""


def _github_token() -> str:
    global _TOKEN_CACHE
    if _TOKEN_CACHE is not None:
        return _TOKEN_CACHE

    env_token = os.environ.get("GITHUB_TOKEN", "").strip()
    if env_token:
        _TOKEN_CACHE = env_token
        return _TOKEN_CACHE

    remote_token = _discover_token_from_remotes()
    if remote_token:
        logger.info("GITHUB_API", "Using token extracted from git remote URL")
        _TOKEN_CACHE = remote_token
        return _TOKEN_CACHE

    gh_token = _discover_token_from_gh_cli()
    if gh_token:
        logger.info("GITHUB_API", "Using token from gh auth token")
        _TOKEN_CACHE = gh_token
        return _TOKEN_CACHE

    _TOKEN_CACHE = ""
    return _TOKEN_CACHE


def _request(method: str, path: str, payload: Optional[dict] = None) -> Tuple[bool, dict]:
    token = _github_token()
    if not token:
        logger.info("GITHUB_API", "GITHUB_TOKEN not set/resolved, skipping GitHub API call")
        return False, {}

    url = GITHUB_API_BASE + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None

    req = urllib.request.Request(
        url,
        method=method,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "mini-agents-fleet-v2",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            body = response.read().decode("utf-8")
            if not body:
                return True, {}
            return True, json.loads(body)
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        logger.error("GITHUB_API", f"HTTP {exc.code} on {path}: {detail[:500]}")
        return False, {}
    except urllib.error.URLError as exc:
        logger.error("GITHUB_API", f"URL error on {path}: {exc}")
        return False, {}


def create_issue(owner: str, repo: str, title: str, body: str, labels: List[str] = None) -> dict:
    """POST /repos/{owner}/{repo}/issues."""
    logger.info("GITHUB_API", f'Creating issue: "{title}" on {owner}/{repo}')
    payload = {"title": title, "body": body}
    if labels:
        payload["labels"] = labels
    ok, data = _request("POST", f"/repos/{owner}/{repo}/issues", payload)
    if not ok:
        return {}
    return {"number": data.get("number"), "url": data.get("html_url"), "title": data.get("title")}


def list_issues(owner: str, repo: str, state: str = "open", per_page: int = 10) -> List[dict]:
    """GET /repos/{owner}/{repo}/issues."""
    logger.info("GITHUB_API", f"Listing issues on {owner}/{repo}")
    query = urllib.parse.urlencode({"state": state, "per_page": per_page})
    ok, data = _request("GET", f"/repos/{owner}/{repo}/issues?{query}")
    if not ok or not isinstance(data, list):
        return []
    return [
        {
            "number": issue.get("number"),
            "url": issue.get("html_url"),
            "title": issue.get("title"),
            "state": issue.get("state"),
        }
        for issue in data
    ]


def create_pull_request(owner: str, repo: str, title: str, body: str, head: str, base: str = "main") -> dict:
    """POST /repos/{owner}/{repo}/pulls."""
    logger.info("GITHUB_API", f'Creating PR: "{title}" on {owner}/{repo}')
    payload = {"title": title, "body": body, "head": head, "base": base}
    ok, data = _request("POST", f"/repos/{owner}/{repo}/pulls", payload)
    if not ok:
        return {}
    return {"number": data.get("number"), "url": data.get("html_url")}


def get_repo_info(owner: str, repo: str) -> dict:
    """GET /repos/{owner}/{repo}."""
    logger.info("GITHUB_API", f"Getting repo info for {owner}/{repo}")
    ok, data = _request("GET", f"/repos/{owner}/{repo}")
    return data if ok else {}
