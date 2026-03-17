"""MiniMax endpoint smoke test with explicit per-endpoint diagnostics."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime

from dotenv import load_dotenv


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def log(msg: str) -> None:
    print(f"[{ts()}] [SMOKE] {msg}")


def mask(value: str) -> str:
    if not value:
        return "NOT SET"
    if len(value) <= 6:
        return "***"
    return f"...{value[-3:]}"


def extract_content(result: dict) -> str:
    if isinstance(result.get("base_resp"), dict):
        base = result["base_resp"]
        raise RuntimeError(f"MiniMax API error ({base.get('status_code')}): {base.get('status_msg')}")

    try:
        content = result["choices"][0]["message"]["content"]
        if isinstance(content, str) and content.strip():
            return content.strip()
    except Exception:
        pass

    reply = result.get("reply", "")
    if isinstance(reply, str) and reply.strip():
        return reply.strip()

    raise RuntimeError(f"No usable assistant content. Raw: {json.dumps(result, ensure_ascii=False)[:500]}")


def call_once(url: str, api_key: str, model: str) -> tuple[bool, str]:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Reply with exactly OK"},
            {"role": "user", "content": "OK"},
        ],
        "temperature": 0,
        "max_tokens": 16,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
        parsed = json.loads(raw)
        content = extract_content(parsed)
        return True, content
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        return False, f"HTTP {exc.code}: {detail[:500]}"
    except urllib.error.URLError as exc:
        return False, f"URL error: {exc}"
    except Exception as exc:
        return False, str(exc)


def main() -> int:
    load_dotenv()

    api_key = os.environ.get("MINIMAX_API_KEY", "").strip()
    env_url = os.environ.get("MINIMAX_API_URL", "").strip()
    model = os.environ.get("MINIMAX_MODEL", "MiniMax-Text-01").strip() or "MiniMax-Text-01"

    log("Starting MiniMax smoke test")
    log(f"MINIMAX_API_KEY: {mask(api_key)}")
    log(f"MINIMAX_API_URL (env): {env_url or '(not set)'}")
    log(f"MINIMAX_MODEL: {model}")

    if not api_key:
        log("FAIL: MINIMAX_API_KEY missing")
        return 1

    if not env_url:
        log("FAIL: MINIMAX_API_URL missing. Set one explicit API endpoint in .env")
        return 2

    log(f"Testing endpoint: {env_url}")
    ok, detail = call_once(env_url, api_key, model)
    if ok:
        log(f"PASS endpoint: {env_url}")
        log(f"Response: {detail[:120]}")
        log("RESULT: API key + URL are valid.")
        return 0

    log(f"FAIL endpoint: {env_url} -> {detail}")
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
