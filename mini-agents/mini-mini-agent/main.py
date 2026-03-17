"""mini-mini-agent: local Ollama pipeline with repo writes, git, and GitHub integration."""

from __future__ import annotations

import json
import os
import random
import re
import ssl
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime

from dotenv import load_dotenv


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config", "pipeline.json")
LOG_PATH = os.path.join(BASE_DIR, "logs", "run.log")
PROMPTS_DIR = os.path.join(BASE_DIR, "prompts")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
DEFAULT_TARGET = r"C:\Users\catal\Desktop\code-base"
STAGE_ORDER = ["elena", "colombo", "vitalik", "athena"]
STAGE_META = {
    "elena": {
        "icon": "🧭",
        "name": "ELENA",
        "mission": "Scans selected repo and picks one high-value small improvement.",
    },
    "colombo": {
        "icon": "🏗️",
        "name": "COLOMBO",
        "mission": "Converts Elena idea into file-level technical actions.",
    },
    "vitalik": {
        "icon": "🛠️",
        "name": "VITALIK",
        "mission": "Generates and applies code deliverables in the target repo.",
    },
    "athena": {
        "icon": "🧪",
        "name": "ATHENA",
        "mission": "Reviews execution quality and routes revision feedback.",
    },
}

load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()

NETWORK_POLICY = {
    "retries": 3,
    "base_timeout": 30,
    "max_timeout": 120,
    "backoff_seconds": 1.0,
    "backoff_factor": 2.0,
    "jitter_seconds": 0.35,
    "max_retry_after_seconds": 30,
    "min_ollama_version": "",
    "ollama_chat_timeout": 120,
    "stage_timeouts": {},
}

HANDSHAKE_STATE = {
    "ollama_seq": 0,
    "github_seq": 0,
    "ollama_version": "",
}

RETRYABLE_STATUS_CODES = {408, 425, 429, 500, 502, 503, 504}


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def log(scope: str, msg: str) -> None:
    line = f"[{ts()}] [{scope}] {msg}"
    print(line)
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def icon(scope: str) -> str:
    mapping = {
        "PIPELINE": "🚀",
        "ELENA": "🧭",
        "COLOMBO": "🏗️",
        "VITALIK": "🛠️",
        "ATHENA": "🧪",
        "GIT": "🌿",
        "GITHUB": "🐙",
    }
    return mapping.get(scope.upper(), "🔹")


def section(title: str) -> None:
    bar = "=" * 64
    print("")
    print(bar)
    print(f"  {title}")
    print(bar)


def load_config() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _as_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_float(value, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def configure_network_policy(cfg: dict) -> None:
    net_cfg = cfg.get("network", {}) if isinstance(cfg, dict) else {}
    NETWORK_POLICY["retries"] = max(1, _as_int(net_cfg.get("retries"), NETWORK_POLICY["retries"]))
    NETWORK_POLICY["base_timeout"] = max(5, _as_int(net_cfg.get("base_timeout"), NETWORK_POLICY["base_timeout"]))
    NETWORK_POLICY["max_timeout"] = max(
        NETWORK_POLICY["base_timeout"],
        _as_int(net_cfg.get("max_timeout"), NETWORK_POLICY["max_timeout"]),
    )
    NETWORK_POLICY["backoff_seconds"] = max(
        0.2,
        _as_float(net_cfg.get("backoff_seconds"), NETWORK_POLICY["backoff_seconds"]),
    )
    NETWORK_POLICY["backoff_factor"] = max(
        1.0,
        _as_float(net_cfg.get("backoff_factor"), NETWORK_POLICY["backoff_factor"]),
    )
    NETWORK_POLICY["jitter_seconds"] = max(
        0.0,
        _as_float(net_cfg.get("jitter_seconds"), NETWORK_POLICY["jitter_seconds"]),
    )
    NETWORK_POLICY["max_retry_after_seconds"] = max(
        1,
        _as_int(net_cfg.get("max_retry_after_seconds"), NETWORK_POLICY["max_retry_after_seconds"]),
    )
    NETWORK_POLICY["min_ollama_version"] = str(net_cfg.get("min_ollama_version", "")).strip()
    NETWORK_POLICY["ollama_chat_timeout"] = max(
        20,
        _as_int(net_cfg.get("ollama_chat_timeout"), NETWORK_POLICY["ollama_chat_timeout"]),
    )
    raw_stage_timeouts = net_cfg.get("stage_timeouts", {})
    stage_timeouts = {}
    if isinstance(raw_stage_timeouts, dict):
        for stage, value in raw_stage_timeouts.items():
            name = str(stage).strip().lower()
            if name in STAGE_ORDER:
                stage_timeouts[name] = max(20, _as_int(value, NETWORK_POLICY["ollama_chat_timeout"]))
    NETWORK_POLICY["stage_timeouts"] = stage_timeouts


def next_handshake_sequence(scope: str) -> int:
    key = "ollama_seq" if scope.lower() == "ollama" else "github_seq"
    HANDSHAKE_STATE[key] += 1
    return HANDSHAKE_STATE[key]


def parse_retry_after_seconds(value: str, cap_seconds: int) -> int:
    text = str(value or "").strip()
    if not text:
        return 0
    try:
        return max(0, min(int(text), cap_seconds))
    except ValueError:
        return 0


def parse_semver_triplet(version: str) -> tuple[int, int, int]:
    match = re.search(r"(\d+)\.(\d+)\.(\d+)", str(version))
    if not match:
        return (0, 0, 0)
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def is_version_at_least(found: str, required: str) -> bool:
    if not required:
        return True
    return parse_semver_triplet(found) >= parse_semver_triplet(required)


def is_timeout_error(exc: Exception) -> bool:
    if isinstance(exc, TimeoutError):
        return True
    if isinstance(exc, urllib.error.URLError):
        reason = getattr(exc, "reason", None)
        if isinstance(reason, TimeoutError):
            return True
    return "timed out" in str(exc).lower()


def normalize_stages(values: list) -> list:
    seen = set()
    ordered = []
    for value in values:
        stage = str(value).strip().lower()
        if stage not in STAGE_ORDER or stage in seen:
            continue
        ordered.append(stage)
        seen.add(stage)
    return ordered or STAGE_ORDER


def load_prompt(stage: str, fallback: str) -> str:
    path = os.path.join(PROMPTS_DIR, f"{stage}.txt")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as handle:
            text = handle.read().strip()
        if text:
            return text
    return fallback


def save_stage_output(stage: str, content: str) -> None:
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, f"{stage}.md")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(content + "\n")


def save_stage_json(stage: str, data: dict) -> None:
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, f"{stage}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)


def save_iteration_summary(iteration: int, data: dict) -> None:
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, f"iteration-{iteration:02d}-summary.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)


def parse_json_output(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {"raw_output": raw, "parse_error": True}


def list_repo_files(repo_path: str, limit: int = 80) -> list:
    found = []
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in {".git", "__pycache__", ".venv", "venv", "node_modules"}]
        for filename in files:
            rel = os.path.relpath(os.path.join(root, filename), repo_path)
            found.append(rel.replace("\\", "/"))
            if len(found) >= limit:
                return sorted(found)
    return sorted(found)


def repo_snapshot(repo: dict) -> dict:
    repo_path = repo.get("path", "")
    files = list_repo_files(repo_path, limit=160) if repo_path else []
    has_readme = any(path.lower().startswith("readme") for path in files)
    has_tests = any(path.startswith("tests/") or path.endswith("_test.py") or path.startswith("test_") for path in files)
    has_ci = any(path.startswith(".github/workflows/") and path.endswith((".yml", ".yaml")) for path in files)
    return {
        "name": repo.get("name", ""),
        "path": repo_path,
        "file_count": len(files),
        "files_sample": files[:40],
        "has_readme": has_readme,
        "has_tests": has_tests,
        "has_ci": has_ci,
    }


def discover_repos(base_path: str, max_repos: int = 40) -> list:
    repos = []
    if not os.path.isdir(base_path):
        return repos
    for name in sorted(os.listdir(base_path)):
        full = os.path.join(base_path, name)
        if not os.path.isdir(full):
            continue
        if os.path.isdir(os.path.join(full, ".git")):
            repos.append({"name": name, "path": full})
        if len(repos) >= max_repos:
            break
    return repos


def pick_random_repo(repos: list) -> dict:
    if not repos:
        return {"name": "none", "path": ""}
    return random.choice(repos)


def stage_prompt_fallback(stage: str) -> str:
    if stage == "elena":
        return (
            "You are Elena. Pick one practical improvement for the selected repository. "
            "Return JSON: {\"selected_target\":\"...\",\"why\":\"...\",\"top_steps\":[\"...\",\"...\",\"...\"]}"
        )
    if stage == "colombo":
        return (
            "You are Colombo. Convert Elena output into technical tasks. "
            "Return JSON: {\"files_to_change\":[{\"path\":\"...\",\"reason\":\"...\",\"action\":\"create|modify\"}],"
            "\"execution_order\":[\"...\"],\"test_commands\":[\"...\"]}"
        )
    if stage == "vitalik":
        return (
            "You are Vitalik. Own implementation quality end-to-end: code changes, robustness, tests, and follow-up fixes. "
            "Return JSON: {\"files\":[{\"path\":\"...\",\"content\":\"...\",\"notes\":\"...\",\"action\":\"create|modify\"}],"
            "\"run_tests\":[\"...\"],\"risks\":[\"...\"],\"fancy_upgrades\":[\"...\"],\"qa_fixes\":[\"...\"]}"
        )
    if stage == "athena":
        return (
            "You are Athena. Perform concise QA review only. "
            "Return JSON: {\"verdict\":\"PASS|FAIL\",\"top_issues\":[\"...\"],\"required_fixes\":[\"...\"],"
            "\"next_stage_hint\":\"vitalik|elena\",\"confidence\":\"low|medium|high\"}"
        )
    return "Return valid JSON."


def http_json_request(
    *,
    method: str,
    url: str,
    scope: str,
    headers: dict | None = None,
    payload: dict | None = None,
    retries: int | None = None,
    base_timeout: int | None = None,
    max_timeout: int | None = None,
) -> dict:
    method_name = str(method or "GET").upper()
    attempt_limit = retries if retries is not None else int(NETWORK_POLICY["retries"])
    timeout_start = base_timeout if base_timeout is not None else int(NETWORK_POLICY["base_timeout"])
    timeout_cap = max_timeout if max_timeout is not None else int(NETWORK_POLICY["max_timeout"])
    payload_data = json.dumps(payload).encode("utf-8") if payload is not None else None

    request_headers = dict(headers or {})
    if payload_data is not None and "Content-Type" not in request_headers:
        request_headers["Content-Type"] = "application/json"

    last_error = "unknown error"
    for attempt in range(1, attempt_limit + 1):
        if method_name == "POST":
            # Keep POST timeout stable to avoid long retry spirals on non-idempotent calls.
            adaptive_timeout = min(timeout_cap, timeout_start)
        else:
            adaptive_timeout = min(timeout_cap, int(timeout_start * (NETWORK_POLICY["backoff_factor"] ** (attempt - 1))))
        req = urllib.request.Request(
            url,
            data=payload_data,
            headers=request_headers,
            method=method_name,
        )
        try:
            with urllib.request.urlopen(req, timeout=adaptive_timeout) as response:
                raw = response.read().decode("utf-8")
                if not raw.strip():
                    return {}
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    return parsed
                raise RuntimeError(f"Unexpected JSON type: {type(parsed).__name__}")
        except urllib.error.HTTPError as exc:
            detail = ""
            try:
                detail = exc.read().decode("utf-8")
            except Exception:
                detail = ""
            retry_header = exc.headers.get("Retry-After", "") if getattr(exc, "headers", None) else ""
            retry_after = parse_retry_after_seconds(retry_header, int(NETWORK_POLICY["max_retry_after_seconds"]))
            retryable = exc.code in RETRYABLE_STATUS_CODES and attempt < attempt_limit
            last_error = f"HTTP {exc.code}: {detail or str(exc)}"
            if retryable:
                sleep_seconds = retry_after if retry_after > 0 else (
                    NETWORK_POLICY["backoff_seconds"] * (NETWORK_POLICY["backoff_factor"] ** (attempt - 1))
                    + random.uniform(0.0, NETWORK_POLICY["jitter_seconds"])
                )
                log(scope, f"{icon(scope)} Handshake retry {attempt}/{attempt_limit} after HTTP {exc.code}; sleeping {sleep_seconds:.2f}s")
                time.sleep(sleep_seconds)
                continue
            raise RuntimeError(last_error) from exc
        except (urllib.error.URLError, TimeoutError, ssl.SSLError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            if method_name == "POST" and is_timeout_error(exc):
                raise RuntimeError(
                    f"{scope} POST request timed out after {adaptive_timeout}s (attempt {attempt}/{attempt_limit}). "
                    "Failing fast to avoid duplicate long-running retries."
                ) from exc
            if attempt >= attempt_limit:
                break
            sleep_seconds = (
                NETWORK_POLICY["backoff_seconds"] * (NETWORK_POLICY["backoff_factor"] ** (attempt - 1))
                + random.uniform(0.0, NETWORK_POLICY["jitter_seconds"])
            )
            log(scope, f"{icon(scope)} Handshake retry {attempt}/{attempt_limit} after network error; sleeping {sleep_seconds:.2f}s")
            time.sleep(sleep_seconds)

    raise RuntimeError(f"{scope} request failed after {attempt_limit} attempts: {last_error}")


def handshake_ollama(host: str) -> None:
    handshake_id = str(uuid.uuid4())
    seq = next_handshake_sequence("ollama")
    headers = {
        "Accept": "application/json",
        "X-Mini-Agent-Handshake-Id": handshake_id,
        "X-Mini-Agent-Handshake-Seq": str(seq),
        "X-Mini-Agent-Protocol-Version": "1",
    }
    info = http_json_request(
        method="GET",
        url=host.rstrip("/") + "/api/version",
        scope="PIPELINE",
        headers=headers,
        retries=int(NETWORK_POLICY["retries"]),
        base_timeout=8,
        max_timeout=25,
    )
    found_version = str(info.get("version", "")).strip()
    HANDSHAKE_STATE["ollama_version"] = found_version
    required = str(NETWORK_POLICY.get("min_ollama_version", "")).strip()
    if required and not is_version_at_least(found_version, required):
        raise RuntimeError(
            f"Ollama version mismatch: found {found_version or 'unknown'}, "
            f"requires >= {required}. Update Ollama or lower network.min_ollama_version."
        )
    if found_version:
        log("PIPELINE", f"{icon('PIPELINE')} Ollama handshake OK (version {found_version}, seq={seq})")


def ollama_chat(host: str, model: str, system: str, user: str, timeout: int = 120) -> str:
    url = host.rstrip("/") + "/api/chat"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
    }
    seq = next_handshake_sequence("ollama")
    handshake_id = str(uuid.uuid4())
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Mini-Agent-Handshake-Id": handshake_id,
        "X-Mini-Agent-Handshake-Seq": str(seq),
        "X-Mini-Agent-Protocol-Version": "1",
    }
    parsed = http_json_request(
        method="POST",
        url=url,
        scope="PIPELINE",
        headers=headers,
        payload=payload,
        retries=int(NETWORK_POLICY["retries"]),
        base_timeout=max(8, int(timeout)),
        max_timeout=max(timeout, int(NETWORK_POLICY["max_timeout"])),
    )
    message = parsed.get("message", {})
    if not isinstance(message, dict):
        raise RuntimeError("Ollama handshake error: missing response message object")
    content = message.get("content", "")
    return str(content).strip()


def run_cmd(args: list, cwd: str) -> tuple[bool, str]:
    try:
        completed = subprocess.run(
            args,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
            timeout=120,
            shell=False,
        )
    except Exception as exc:
        return False, str(exc)
    output = (completed.stdout or completed.stderr or "").strip()
    return completed.returncode == 0, output


def run_shell_cmd(command: str, cwd: str) -> dict:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
            timeout=180,
            shell=True,
        )
    except Exception as exc:
        return {"command": command, "success": False, "output": str(exc)}
    output = (completed.stdout or completed.stderr or "").strip()
    return {"command": command, "success": completed.returncode == 0, "output": output}


def sanitize_branch(branch_name: str, fallback: str) -> str:
    raw = (branch_name or "").strip()
    if not raw:
        raw = fallback
    cleaned = re.sub(r"[^a-zA-Z0-9/_-]+", "-", raw).strip("-")
    if not cleaned:
        cleaned = fallback
    return cleaned.lower()


def infer_owner_repo(repo_path: str) -> dict:
    ok, remote = run_cmd(["git", "remote", "get-url", "origin"], cwd=repo_path)
    if not ok or not remote:
        return {"owner": "", "repo": "", "remote": remote}

    value = remote.strip()
    patterns = [
        r"github\.com[:/](?P<owner>[^/\s]+)/(?P<repo>[^/\s]+?)(?:\.git)?$",
        r"^https?://[^/]+/(?P<owner>[^/\s]+)/(?P<repo>[^/\s]+?)(?:\.git)?$",
    ]
    for pattern in patterns:
        match = re.search(pattern, value)
        if match:
            return {
                "owner": match.group("owner"),
                "repo": match.group("repo"),
                "remote": value,
            }
    return {"owner": "", "repo": "", "remote": value}


def github_request(method: str, path: str, token: str, payload: dict | None = None) -> tuple[bool, dict]:
    url = f"https://api.github.com{path}"
    seq = next_handshake_sequence("github")
    handshake_id = str(uuid.uuid4())
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mini-mini-agent",
        "Authorization": f"Bearer {token}",
        "X-Mini-Agent-Handshake-Id": handshake_id,
        "X-Mini-Agent-Handshake-Seq": str(seq),
        "X-Mini-Agent-Protocol-Version": "1",
    }
    try:
        parsed = http_json_request(
            method=method,
            url=url,
            scope="GITHUB",
            headers=headers,
            payload=payload,
            retries=max(2, int(NETWORK_POLICY["retries"])),
            base_timeout=max(15, int(NETWORK_POLICY["base_timeout"])),
            max_timeout=max(60, int(NETWORK_POLICY["max_timeout"])),
        )
        return True, parsed
    except Exception as exc:
        detail = str(exc)
        match = re.search(r"HTTP\s+(\d+)", detail)
        if match:
            return False, {"error": f"HTTP {match.group(1)}", "detail": detail}
        return False, {"error": "Request Error", "detail": detail}


def github_create_issue(owner: str, repo: str, title: str, body: str, labels: list, token: str) -> dict:
    log("GITHUB", f"{icon('GITHUB')} Creating issue on {owner}/{repo}: {title}")
    ok, data = github_request(
        "POST",
        f"/repos/{owner}/{repo}/issues",
        token,
        {"title": title, "body": body, "labels": labels or []},
    )
    if not ok:
        return {"success": False, "error": data}
    return {
        "success": True,
        "number": data.get("number"),
        "url": data.get("html_url"),
        "title": data.get("title"),
    }


def github_create_pull_request(owner: str, repo: str, title: str, body: str, head: str, base: str, token: str) -> dict:
    log("GITHUB", f"{icon('GITHUB')} Creating PR {head} -> {base} on {owner}/{repo}")
    ok, data = github_request(
        "POST",
        f"/repos/{owner}/{repo}/pulls",
        token,
        {"title": title, "body": body, "head": head, "base": base},
    )
    if not ok:
        return {"success": False, "error": data}
    return {"success": True, "number": data.get("number"), "url": data.get("html_url")}


def github_list_workflows(owner: str, repo: str, token: str) -> list:
    ok, data = github_request("GET", f"/repos/{owner}/{repo}/actions/workflows", token, None)
    if not ok:
        return []
    workflows = data.get("workflows", [])
    if not isinstance(workflows, list):
        return []
    return workflows


def github_trigger_workflow(owner: str, repo: str, workflow_id: str, ref: str, token: str) -> dict:
    log("GITHUB", f"{icon('GITHUB')} Triggering workflow {workflow_id} on {owner}/{repo}@{ref}")
    ok, data = github_request(
        "POST",
        f"/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
        token,
        {"ref": ref, "inputs": {"triggered_by": "mini-mini-agent"}},
    )
    if ok:
        return {"success": True, "workflow_id": workflow_id}
    return {"success": False, "error": data}


def ensure_branch(repo_path: str, target_branch: str, auto_push: bool) -> dict:
    base_candidates = ["main", "master"]
    checkout_base_ok = False
    active_base = ""
    for base in base_candidates:
        ok, out = run_cmd(["git", "checkout", base], cwd=repo_path)
        if ok:
            checkout_base_ok = True
            active_base = base
            log("GIT", f"{icon('GIT')} Checked out base branch: {base}")
            break
        _ = out

    if auto_push and checkout_base_ok:
        pull_ok, pull_out = run_cmd(["git", "pull", "origin", active_base], cwd=repo_path)
        if pull_ok:
            log("GIT", f"{icon('GIT')} Updated {active_base} from origin")
        else:
            log("GIT", f"{icon('GIT')} Pull skipped/failed: {pull_out}")

    exists_ok, exists_out = run_cmd(["git", "branch", "--list", target_branch], cwd=repo_path)
    if exists_ok and exists_out.strip():
        checkout_ok, checkout_out = run_cmd(["git", "checkout", target_branch], cwd=repo_path)
        return {"success": checkout_ok, "branch": target_branch, "message": checkout_out}

    create_ok, create_out = run_cmd(["git", "checkout", "-b", target_branch], cwd=repo_path)
    return {"success": create_ok, "branch": target_branch, "message": create_out}


def safe_write_file(repo_path: str, relative_path: str, content: str) -> dict:
    rel = str(relative_path).replace("\\", "/").strip("/")
    full = os.path.normpath(os.path.join(repo_path, rel))
    root = os.path.normpath(repo_path)
    if not full.startswith(root):
        return {"path": rel, "status": "error", "error": "Path escapes repository root"}

    parent = os.path.dirname(full)
    os.makedirs(parent, exist_ok=True)
    with open(full, "w", encoding="utf-8") as handle:
        handle.write(content)
    return {"path": rel, "status": "ok", "bytes": len(content)}


def normalize_vitalik_files(vitalik_json: dict, colombo_json: dict, repo_name: str) -> list:
    files = vitalik_json.get("files", [])
    if isinstance(files, list) and files:
        normalized = []
        for item in files:
            if isinstance(item, dict) and item.get("path"):
                normalized.append(
                    {
                        "path": str(item.get("path")),
                        "content": str(item.get("content", "")),
                        "action": str(item.get("action", "create")),
                        "notes": str(item.get("notes", "")),
                    }
                )
        if normalized:
            return normalized

    fallback = []
    for item in colombo_json.get("files_to_change", []):
        if not isinstance(item, dict):
            continue
        path = str(item.get("path", "")).strip()
        if not path:
            continue
        if path.lower().endswith(".md"):
            content = f"# {repo_name}\n\nGenerated by mini-mini-agent.\n"
        elif path.lower().endswith(".yml") or path.lower().endswith(".yaml"):
            content = (
                "name: CI\n\non:\n  push:\n  pull_request:\n\njobs:\n  test:\n"
                "    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n"
            )
        else:
            content = "# Generated by mini-mini-agent\n"
        fallback.append({"path": path, "content": content, "action": item.get("action", "create"), "notes": "fallback"})
    return fallback


def execute_vitalik(repo_path: str, repo_name: str, colombo_json: dict, vitalik_json: dict, cfg: dict, iteration: int) -> dict:
    exec_cfg = cfg.get("execution", {})
    auto_push = bool(exec_cfg.get("auto_push", False))
    branch_prefix = str(exec_cfg.get("branch_prefix", "fleet")).strip() or "fleet"
    branch_from_colombo = str(colombo_json.get("suggested_branch_name", "")).strip()
    default_branch_name = f"{branch_prefix}/{repo_name}-iter-{iteration:02d}"
    branch_name = sanitize_branch(branch_from_colombo, default_branch_name)

    branch_result = {"success": False, "branch": branch_name, "message": "not attempted"}
    if bool(exec_cfg.get("create_feature_branch", True)):
        branch_result = ensure_branch(repo_path, branch_name, auto_push)
        log("GIT", f"{icon('GIT')} Branch step -> {branch_result.get('message', '')}")

    files_payload = normalize_vitalik_files(vitalik_json, colombo_json, repo_name)
    files_written = []
    for item in files_payload:
        result = safe_write_file(repo_path, item.get("path", ""), item.get("content", ""))
        files_written.append(result)
        if result.get("status") == "ok":
            log("VITALIK", f"{icon('VITALIK')} Wrote {result['path']} ({result['bytes']} bytes)")
        else:
            log("VITALIK", f"{icon('VITALIK')} Write failed for {result.get('path')}: {result.get('error')}")

    test_commands = vitalik_json.get("run_tests", [])
    if not isinstance(test_commands, list) or not test_commands:
        test_commands = colombo_json.get("test_commands", [])
    if not isinstance(test_commands, list):
        test_commands = []

    test_results = []
    if bool(exec_cfg.get("run_local_tests", True)):
        for cmd in test_commands:
            if not str(cmd).strip():
                continue
            log("VITALIK", f"{icon('VITALIK')} Running test command: {cmd}")
            test_results.append(run_shell_cmd(str(cmd), repo_path))

    status_ok, status_out = run_cmd(["git", "status", "--porcelain"], cwd=repo_path)
    log("GIT", f"{icon('GIT')} Git status after writes:\n{status_out if status_out else '(clean)'}")

    commit_result = {"success": False, "sha": None, "message": "commit skipped"}
    if bool(exec_cfg.get("auto_commit", True)) and status_ok and status_out.strip():
        goal = "code update"
        if isinstance(colombo_json.get("execution_order"), list) and colombo_json["execution_order"]:
            goal = str(colombo_json["execution_order"][0])
        body_lines = [f"feat(fleet): {goal}", "", "Files changed:"]
        for item in files_written:
            if item.get("status") == "ok":
                body_lines.append(f"- {item.get('path')}")
        body_lines.extend(["", f"Agent: Vitalik mini-mini | Run: iter-{iteration:02d}"])
        commit_msg = "\n".join(body_lines)

        add_ok, add_out = run_cmd(["git", "add", "-A"], cwd=repo_path)
        if add_ok:
            commit_ok, commit_out = run_cmd(["git", "commit", "-m", commit_msg], cwd=repo_path)
            if commit_ok:
                sha_ok, sha_out = run_cmd(["git", "rev-parse", "--short", "HEAD"], cwd=repo_path)
                commit_result = {
                    "success": True,
                    "sha": sha_out.strip() if sha_ok else None,
                    "message": commit_out,
                }
            else:
                commit_result = {"success": False, "sha": None, "message": commit_out}
        else:
            commit_result = {"success": False, "sha": None, "message": add_out}

    push_result = {"success": False, "message": "push disabled"}
    if auto_push and commit_result.get("success"):
        push_ok, push_out = run_cmd(["git", "push", "-u", "origin", "HEAD"], cwd=repo_path)
        push_result = {"success": push_ok, "message": push_out}

    remote_info = infer_owner_repo(repo_path)
    return {
        "repo_path": repo_path,
        "branch": branch_name,
        "branch_result": branch_result,
        "files_written": files_written,
        "test_results": test_results,
        "git_status": status_out,
        "commit": commit_result,
        "push": push_result,
        "remote": remote_info,
    }


def stage_timeout_seconds(stage: str) -> int:
    stage_name = str(stage).strip().lower()
    stage_overrides = NETWORK_POLICY.get("stage_timeouts", {})
    if isinstance(stage_overrides, dict) and stage_name in stage_overrides:
        return max(20, _as_int(stage_overrides.get(stage_name), NETWORK_POLICY["ollama_chat_timeout"]))
    return max(20, _as_int(NETWORK_POLICY.get("ollama_chat_timeout"), 120))


def run_llm_stage(stage: str, host: str, model: str, context: dict) -> tuple[str, dict]:
    fallback_prompt = stage_prompt_fallback(stage)
    system = load_prompt(stage, fallback_prompt)
    stage_context = build_stage_context(stage, context)
    user = (
        f"Current context JSON:\n{json.dumps(stage_context, indent=2)}\n\n"
        f"Generate {stage} output for this repository and this iteration. "
        f"Keep output concise, practical, and valid JSON."
    )
    raw = ollama_chat(host, model, system, user, timeout=stage_timeout_seconds(stage))
    parsed = parse_json_output(raw)
    return raw, parsed


def is_timeout_exception(exc: Exception) -> bool:
    text = str(exc or "").lower()
    return "timed out" in text or "timeout" in text


def compact_json_value(value, max_depth: int = 4, depth: int = 0, max_items: int = 8, max_text: int = 500):
    if depth >= max_depth:
        return "<trimmed-depth>"
    if isinstance(value, dict):
        compacted = {}
        for idx, (key, item) in enumerate(value.items()):
            if idx >= max_items:
                compacted["..."] = f"{len(value) - max_items} keys omitted"
                break
            compacted[str(key)] = compact_json_value(item, max_depth, depth + 1, max_items, max_text)
        return compacted
    if isinstance(value, list):
        items = [
            compact_json_value(item, max_depth, depth + 1, max_items, max_text)
            for item in value[:max_items]
        ]
        if len(value) > max_items:
            items.append(f"... {len(value) - max_items} items omitted")
        return items
    if isinstance(value, str):
        return value if len(value) <= max_text else value[:max_text] + "... <trimmed>"
    return value


def build_compact_stage_context(context: dict) -> dict:
    keep_keys = [
        "iteration",
        "request",
        "selected_repo",
        "selected_repo_snapshot",
        "mission",
        "revision_note",
        "elena",
        "colombo",
        "vitalik",
    ]
    compact = {}
    for key in keep_keys:
        if key in context:
            compact[key] = compact_json_value(context[key])

    execution = context.get("execution", {})
    if isinstance(execution, dict):
        compact_execution = {
            "branch": execution.get("branch", ""),
            "files_written": compact_json_value(execution.get("files_written", []), max_items=12),
            "test_results": compact_json_value(execution.get("test_results", []), max_items=10),
            "commit": compact_json_value(execution.get("commit", {})),
            "push": compact_json_value(execution.get("push", {})),
        }
        compact["execution"] = compact_execution

    return compact


def build_stage_context(stage: str, context: dict) -> dict:
    stage_name = str(stage).strip().lower()
    if stage_name == "athena":
        # Athena gets compact context by default to reduce timeout risk.
        compact = build_compact_stage_context(context)
        compact["qa_scope"] = {
            "goal": "fast concise review",
            "must_return": ["verdict", "top_issues", "required_fixes"],
            "max_items": {"top_issues": 8, "required_fixes": 8},
        }
        return compact
    return context


def run_vitalik_repair_pass(
    *,
    iteration: int,
    selected_repo: dict,
    host: str,
    stage_models: dict,
    default_model: str,
    context: dict,
    cfg: dict,
    required_fixes: list,
) -> tuple[dict, dict, str]:
    repair_context = build_compact_stage_context(context)
    repair_context["repair_mission"] = {
        "owner": "vitalik",
        "priority": "high",
        "required_fixes": required_fixes[:10] if isinstance(required_fixes, list) else [str(required_fixes)],
        "instructions": [
            "Apply fixes directly in files.",
            "Prioritize failing tests and risky modifications.",
            "Return concrete file payloads and test commands.",
        ],
    }
    repair_model = str(stage_models.get("vitalik", default_model)).strip() or default_model
    raw, parsed = run_llm_stage("vitalik", host, repair_model, repair_context)
    execution = execute_vitalik(
        repo_path=selected_repo["path"],
        repo_name=selected_repo["name"],
        colombo_json=context.get("colombo", {}),
        vitalik_json=parsed if isinstance(parsed, dict) else {},
        cfg=cfg,
        iteration=iteration,
    )
    return parsed if isinstance(parsed, dict) else {"raw_output": raw}, execution, raw


def fallback_athena_from_execution(context: dict) -> dict:
    execution = context.get("execution", {})
    if not isinstance(execution, dict):
        return {
            "verdict": "FAIL",
            "top_issues": ["Athena timeout and execution context missing."],
            "required_fixes": ["Re-run Athena with larger timeout or smaller context payload."],
            "next_stage_hint": "vitalik",
            "generated_by": "athena-timeout-fallback",
        }

    top_issues = []
    required_fixes = []

    for item in execution.get("files_written", []):
        if isinstance(item, dict) and item.get("status") != "ok":
            top_issues.append(f"File write failure: {item.get('path', 'unknown')}")
            required_fixes.append(f"Fix write error for {item.get('path', 'unknown')}: {item.get('error', 'unknown error')}")

    for result in execution.get("test_results", []):
        if isinstance(result, dict) and not bool(result.get("success")):
            cmd = str(result.get("command", "")).strip() or "<unknown command>"
            out = str(result.get("output", "")).strip()
            top_issues.append(f"Test failed: {cmd}")
            required_fixes.append(f"Resolve failing test command `{cmd}`. Output: {out[:250]}")

    verdict = "PASS"
    if top_issues:
        verdict = "FAIL"
    else:
        top_issues.append("Athena LLM timed out, but local execution checks found no clear failures.")
        required_fixes.append("Optionally rerun Athena for deeper qualitative review.")

    return {
        "verdict": verdict,
        "top_issues": top_issues[:10],
        "required_fixes": required_fixes[:10],
        "next_stage_hint": "vitalik" if verdict == "FAIL" else "elena",
        "generated_by": "athena-timeout-fallback",
    }


def maybe_create_stage_failure_issue(
    *,
    stage: str,
    error_text: str,
    selected_repo: dict,
    iteration_payload: dict,
    github_cfg: dict,
    token: str,
    enabled: bool,
) -> None:
    if not token or not enabled:
        return
    owner = (
        iteration_payload.get("execution", {}).get("remote", {}).get("owner", "")
        or str(github_cfg.get("owner", "")).strip()
    )
    repo = (
        iteration_payload.get("execution", {}).get("remote", {}).get("repo", "")
        or str(selected_repo.get("name", "")).strip()
    )
    if not owner or not repo:
        return

    title = f"[mini-mini-agent] Stage failure iteration {iteration_payload.get('iteration')}: {stage}"
    body = (
        "Automated stage failure report.\n\n"
        f"Stage: {stage}\n"
        f"Repository: {selected_repo.get('name', '')}\n"
        f"Error: {error_text}\n"
    )
    labels = list(github_cfg.get("default_issue_labels", ["mini-agent", "automation"]))
    result = github_create_issue(owner, repo, title, body, labels, token)
    iteration_payload.setdefault("execution", {})["stage_failure_issue"] = result


def run_pipeline() -> int:
    cfg = load_config()
    configure_network_policy(cfg)
    host = cfg.get("ollama_host", "http://127.0.0.1:11434")
    request = cfg.get(
        "request",
        "Pick one random repo, propose a focused improvement, and produce implementation deliverables.",
    )
    stages = normalize_stages(cfg.get("stages", STAGE_ORDER))
    iterations = int(cfg.get("iterations", 5))
    target_codebase = cfg.get("target_codebase", DEFAULT_TARGET)
    stage_models = cfg.get("stage_models", {})
    default_model = cfg.get("default_model", "qwen2.5-coder:3b")
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    github_cfg = cfg.get("github", {})
    exec_cfg = cfg.get("execution", {})

    forced_repo = None
    revision_note = ""

    repos = discover_repos(target_codebase, max_repos=80)
    section("MINI-MINI-AGENT RUN")
    log("PIPELINE", f"{icon('PIPELINE')} Host: {host}")
    log("PIPELINE", f"{icon('PIPELINE')} Target root: {target_codebase}")
    log("PIPELINE", f"{icon('PIPELINE')} Planned iterations: {iterations}")
    log("PIPELINE", f"{icon('PIPELINE')} Discovered repositories: {len(repos)}")
    log(
        "PIPELINE",
        f"{icon('PIPELINE')} Network policy: retries={NETWORK_POLICY['retries']}, timeout={NETWORK_POLICY['base_timeout']}->{NETWORK_POLICY['max_timeout']}s",
    )
    if token:
        log("PIPELINE", f"{icon('GITHUB')} GITHUB_TOKEN detected; GitHub API enabled")
    else:
        log("PIPELINE", f"{icon('GITHUB')} GITHUB_TOKEN not set; GitHub API calls will be skipped")

    if not repos:
        log("PIPELINE", "No git repos found in target_codebase")
        return 1

    try:
        handshake_ollama(host)
    except Exception as exc:
        log("PIPELINE", f"{icon('PIPELINE')} Ollama handshake failed: {exc}")
        return 1

    for i in range(1, iterations + 1):
        selected_repo = forced_repo if forced_repo else pick_random_repo(repos)
        forced_repo = None
        snapshot = repo_snapshot(selected_repo)
        context = {
            "iteration": i,
            "request": request,
            "selected_repo": selected_repo,
            "selected_repo_snapshot": snapshot,
            "mission": "Produce plan -> build -> QA and apply code changes to repository",
        }
        if revision_note:
            context["revision_note"] = revision_note
            revision_note = ""

        section(f"ITERATION {i}/{iterations}")
        log(
            "PIPELINE",
            f"{icon('PIPELINE')} Target repo: {selected_repo['name']} | files={snapshot['file_count']} | tests={snapshot['has_tests']} | ci={snapshot['has_ci']}",
        )

        iteration_payload = {
            "iteration": i,
            "selected_repo": selected_repo,
            "selected_repo_snapshot": snapshot,
            "stages": {},
            "execution": {},
        }

        for stage in stages:
            if stage == "colombo" and "elena" not in context:
                log("COLOMBO", f"{icon('COLOMBO')} Stage dependency missing: elena")
                return 1
            if stage == "vitalik" and "colombo" not in context:
                log("VITALIK", f"{icon('VITALIK')} Stage dependency missing: colombo")
                return 1
            if stage == "athena" and "vitalik" not in context:
                log("ATHENA", f"{icon('ATHENA')} Stage dependency missing: vitalik")
                return 1

            meta = STAGE_META.get(stage, {"icon": "🔹", "name": stage.upper(), "mission": "Process stage"})
            stage_scope = meta["name"]
            model = str(stage_models.get(stage, default_model)).strip() or default_model
            log(stage_scope, f"{meta['icon']} Role: {meta['mission']}")
            log(stage_scope, f"{meta['icon']} Model: {model}")
            log(stage_scope, f"{meta['icon']} Working on: {selected_repo['name']}")
            try:
                raw, parsed = run_llm_stage(stage, host, model, context)
            except Exception as exc:
                if is_timeout_exception(exc):
                    log(stage_scope, f"{meta['icon']} Timeout detected. Retrying with compact context.")
                    try:
                        compact_context = build_compact_stage_context(context)
                        raw, parsed = run_llm_stage(stage, host, model, compact_context)
                    except Exception as retry_exc:
                        if stage == "athena":
                            log(stage_scope, f"{meta['icon']} Athena timed out again; using deterministic local fallback review.")
                            parsed = fallback_athena_from_execution(context)
                            raw = json.dumps(parsed, indent=2, ensure_ascii=False)
                        else:
                            err_text = str(retry_exc)
                            log(stage_scope, f"{meta['icon']} FAILED after timeout recovery: {err_text}")
                            maybe_create_stage_failure_issue(
                                stage=stage,
                                error_text=err_text,
                                selected_repo=selected_repo,
                                iteration_payload=iteration_payload,
                                github_cfg=github_cfg,
                                token=token,
                                enabled=bool(exec_cfg.get("create_github_issues", True)),
                            )
                            return 1
                else:
                    err_text = str(exc)
                    if stage == "athena":
                        log(stage_scope, f"{meta['icon']} Non-timeout Athena failure; using deterministic local fallback review.")
                        parsed = fallback_athena_from_execution(context)
                        raw = json.dumps(parsed, indent=2, ensure_ascii=False)
                    else:
                        log(stage_scope, f"{meta['icon']} FAILED: {err_text}")
                        maybe_create_stage_failure_issue(
                            stage=stage,
                            error_text=err_text,
                            selected_repo=selected_repo,
                            iteration_payload=iteration_payload,
                            github_cfg=github_cfg,
                            token=token,
                            enabled=bool(exec_cfg.get("create_github_issues", True)),
                        )
                        return 1

            context[stage] = parsed
            iteration_payload["stages"][stage] = parsed
            save_stage_output(f"iteration-{i:02d}-{stage}", raw)
            save_stage_json(f"iteration-{i:02d}-{stage}", parsed)
            log(stage_scope, f"{meta['icon']} Deliverable saved -> outputs/iteration-{i:02d}-{stage}.json")
            if isinstance(parsed, dict):
                log(stage_scope, f"{meta['icon']} Keys: {', '.join(list(parsed.keys())[:10])}")

            if stage == "vitalik":
                execution = execute_vitalik(
                    repo_path=selected_repo["path"],
                    repo_name=selected_repo["name"],
                    colombo_json=context.get("colombo", {}),
                    vitalik_json=parsed,
                    cfg=cfg,
                    iteration=i,
                )
                context["execution"] = execution
                iteration_payload["execution"] = execution
                save_stage_json(f"iteration-{i:02d}-execution", execution)

                owner = execution.get("remote", {}).get("owner", "") or str(github_cfg.get("owner", "")).strip()
                repo = execution.get("remote", {}).get("repo", "")
                branch = execution.get("branch", "main")
                default_base = str(github_cfg.get("default_base", "main")).strip() or "main"

                if token and owner and repo and bool(exec_cfg.get("trigger_github_actions", False)):
                    workflow_id = str(github_cfg.get("workflow_id", "")).strip()
                    if not workflow_id:
                        workflow_id = str(context.get("colombo", {}).get("workflow_id", "")).strip()
                    if not workflow_id:
                        workflows = github_list_workflows(owner, repo, token)
                        if workflows:
                            workflow_id = str(workflows[0].get("id", ""))
                    if workflow_id:
                        action_result = github_trigger_workflow(owner, repo, workflow_id, branch, token)
                        execution["github_actions"] = action_result
                    else:
                        execution["github_actions"] = {"success": False, "error": "No workflow found"}

                if token and owner and repo and bool(exec_cfg.get("create_pull_request", False)):
                    if execution.get("push", {}).get("success"):
                        pr_title = f"[mini-mini-agent] Iteration {i} improvements for {selected_repo['name']}"
                        pr_body = "Automated PR generated by mini-mini-agent local pipeline."
                        execution["pull_request"] = github_create_pull_request(
                            owner=owner,
                            repo=repo,
                            title=pr_title,
                            body=pr_body,
                            head=branch,
                            base=default_base,
                            token=token,
                        )

            if stage == "colombo" and token and bool(exec_cfg.get("create_github_issues", True)):
                owner = str(github_cfg.get("owner", "")).strip()
                repo = selected_repo["name"]
                planned_issues = parsed.get("github_issues", [])
                created = []
                if isinstance(planned_issues, list):
                    for issue in planned_issues[:3]:
                        if not isinstance(issue, dict):
                            continue
                        title = str(issue.get("title", "")).strip()
                        body = str(issue.get("body", "")).strip()
                        labels = issue.get("labels", github_cfg.get("default_issue_labels", []))
                        if not title:
                            continue
                        created.append(github_create_issue(owner, repo, title, body, labels, token))
                if created:
                    iteration_payload["execution"]["colombo_issues"] = created

            if stage == "athena":
                athena = parsed if isinstance(parsed, dict) else {}
                verdict = str(athena.get("verdict", "")).upper()
                if verdict == "FAIL":
                    issues = athena.get("top_issues", [])
                    required_fixes = athena.get("required_fixes", [])
                    next_stage_hint = str(athena.get("next_stage_hint", "vitalik")).strip().lower()
                    revision_note = f"Athena requested fixes: {required_fixes}"
                    forced_repo = selected_repo

                    if bool(exec_cfg.get("vitalik_repair_pass_on_qa_fail", True)):
                        log("VITALIK", f"{icon('VITALIK')} Athena FAIL -> running immediate Vitalik repair pass.")
                        try:
                            repair_parsed, repair_execution, repair_raw = run_vitalik_repair_pass(
                                iteration=i,
                                selected_repo=selected_repo,
                                host=host,
                                stage_models=stage_models,
                                default_model=default_model,
                                context=context,
                                cfg=cfg,
                                required_fixes=required_fixes if isinstance(required_fixes, list) else [str(required_fixes)],
                            )
                            context["vitalik_repair"] = repair_parsed
                            context["execution_repair"] = repair_execution
                            iteration_payload["stages"]["vitalik_repair"] = repair_parsed
                            iteration_payload["execution"]["repair_pass"] = repair_execution
                            save_stage_output(f"iteration-{i:02d}-vitalik-repair", repair_raw)
                            save_stage_json(f"iteration-{i:02d}-vitalik-repair", repair_parsed)
                            save_stage_json(f"iteration-{i:02d}-execution-repair", repair_execution)
                        except Exception as repair_exc:
                            log("VITALIK", f"{icon('VITALIK')} Repair pass failed: {repair_exc}")

                    if token and bool(exec_cfg.get("create_github_issues", True)):
                        owner = (
                            iteration_payload.get("execution", {})
                            .get("remote", {})
                            .get("owner", "")
                            or str(github_cfg.get("owner", "")).strip()
                        )
                        repo = iteration_payload.get("execution", {}).get("remote", {}).get("repo", "")
                        if owner and repo:
                            label_list = list(github_cfg.get("default_issue_labels", ["mini-agent", "automation"]))
                            issue_body = "Athena QA review detected revisions needed.\n\n"
                            if isinstance(issues, list):
                                issue_body += "Top issues:\n" + "\n".join(f"- {x}" for x in issues[:8]) + "\n\n"
                            if isinstance(required_fixes, list):
                                issue_body += "Required fixes:\n" + "\n".join(f"- {x}" for x in required_fixes[:8]) + "\n"
                            issue_title = f"[mini-mini-agent] QA FAIL iteration {i}: {selected_repo['name']}"
                            issue_result = github_create_issue(owner, repo, issue_title, issue_body, label_list, token)
                            iteration_payload["execution"]["qa_issue"] = issue_result
                    log("ATHENA", f"{icon('ATHENA')} Verdict FAIL -> next iteration will revise from {next_stage_hint} on same repo")
                else:
                    log("ATHENA", f"{icon('ATHENA')} Verdict {verdict or 'UNKNOWN'}")

        save_iteration_summary(i, iteration_payload)
        log("PIPELINE", f"{icon('PIPELINE')} Iteration {i} deliverables and execution saved.")

    save_stage_json(
        "run-summary",
        {
            "iterations": iterations,
            "target_codebase": target_codebase,
            "stages": stages,
            "models": {"default": default_model, "stage_models": stage_models},
        },
    )
    section("RUN COMPLETE")
    log("PIPELINE", f"{icon('PIPELINE')} Completed {iterations} iterations")
    return 0


if __name__ == "__main__":
    raise SystemExit(run_pipeline())
