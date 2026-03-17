"""GitHub Actions integration using urllib.request only."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

from core.logger import logger

GITHUB_API_BASE = "https://api.github.com"


def _token() -> str:
    return os.environ.get("GITHUB_TOKEN", "").strip()


def _request(method: str, path: str, payload: Optional[dict] = None) -> tuple:
    token = _token()
    if not token:
        logger.info("GITHUB_ACTIONS", "GITHUB_TOKEN not set, skipping API call")
        return False, {}

    url = GITHUB_API_BASE + path
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

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
            if body:
                return True, json.loads(body)
            return True, {}
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        logger.error("GITHUB_ACTIONS", f"HTTP {exc.code} on {path}: {detail}")
        return False, {}
    except urllib.error.URLError as exc:
        logger.error("GITHUB_ACTIONS", f"URL error on {path}: {exc}")
        return False, {}


def trigger_workflow(
    owner: str,
    repo: str,
    workflow_id: str,
    ref: str = "main",
    inputs: Optional[dict] = None,
) -> dict:
    """
    Trigger workflow_dispatch event.
    POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches
    """
    logger.info(
        "GITHUB_ACTIONS",
        f"Triggering workflow {workflow_id} on {owner}/{repo} (ref={ref})",
    )
    payload = {"ref": ref}
    if inputs:
        payload["inputs"] = inputs
    ok, _ = _request(
        "POST",
        f"/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
        payload,
    )
    if ok:
        return {"triggered": True, "message": "Workflow dispatch triggered"}
    return {"triggered": False, "message": "Workflow dispatch failed"}


def list_workflows(owner: str, repo: str) -> list:
    """GET /repos/{owner}/{repo}/actions/workflows."""
    logger.info("GITHUB_ACTIONS", f"Listing workflows for {owner}/{repo}")
    ok, data = _request("GET", f"/repos/{owner}/{repo}/actions/workflows")
    if not ok:
        return []
    workflows = data.get("workflows", [])
    result = []
    for item in workflows:
        result.append(
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "path": item.get("path"),
                "state": item.get("state"),
            }
        )
    return result


def get_latest_run(owner: str, repo: str, workflow_id: str) -> Optional[dict]:
    """GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs?per_page=1."""
    logger.info(
        "GITHUB_ACTIONS",
        f"Fetching latest run for workflow {workflow_id} on {owner}/{repo}",
    )
    query = urllib.parse.urlencode({"per_page": 1})
    ok, data = _request(
        "GET",
        f"/repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs?{query}",
    )
    if not ok:
        return None
    runs = data.get("workflow_runs", [])
    if not runs:
        return None
    run = runs[0]
    return {
        "id": run.get("id"),
        "status": run.get("status"),
        "conclusion": run.get("conclusion"),
        "url": run.get("html_url"),
        "head_branch": run.get("head_branch"),
    }

