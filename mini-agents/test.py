"""MiniMax API diagnostic test: connectivity, prompt response, and credit/quota status."""

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
    print(f"[{ts()}] [TEST] {msg}")


def mask(value: str) -> str:
    if not value:
        return "NOT SET"
    if len(value) <= 6:
        return "***"
    return f"...{value[-3:]}"


def run_test() -> int:
    load_dotenv()

    api_key = os.environ.get("MINIMAX_API_KEY", "").strip()
    api_url = os.environ.get("MINIMAX_API_URL", "https://api.minimax.io/v1/chat/completions").strip()
    model = os.environ.get("MINIMAX_MODEL", "MiniMax-Text-01").strip()

    log("Starting MiniMax diagnostic")
    log(f"MINIMAX_API_KEY: {mask(api_key)}")
    log(f"MINIMAX_API_URL: {api_url}")
    log(f"MINIMAX_MODEL: {model}")

    if not api_key:
        log("FAIL: MINIMAX_API_KEY is missing")
        return 1

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a concise assistant."},
            {"role": "user", "content": "Reply with exactly: API_OK"},
        ],
        "temperature": 0.0,
        "max_tokens": 64,
    }

    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
            status = response.status
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        log(f"HTTP {exc.code}: {detail[:800]}")
        if "insufficient_balance" in detail or "1008" in detail:
            log("CREDITS: Insufficient balance/quota for this key.")
        elif "invalid api key" in detail.lower() or "2049" in detail:
            log("AUTH: API key rejected/invalid for this endpoint.")
        return 2
    except urllib.error.URLError as exc:
        log(f"NETWORK FAIL: {exc}")
        return 3
    except Exception as exc:
        log(f"UNEXPECTED FAIL: {exc}")
        return 4

    log(f"HTTP {status} OK")
    log(f"RAW RESPONSE: {raw[:800]}")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        log("FAIL: Response is not valid JSON")
        return 5

    content = ""
    try:
        content = parsed["choices"][0]["message"]["content"]
    except Exception:
        if isinstance(parsed.get("reply"), str):
            content = parsed.get("reply", "")

    usage = parsed.get("usage")
    if usage:
        log(f"USAGE: {usage}")
    else:
        log("USAGE: not provided by endpoint")

    clean = (content or "").strip()
    log(f"CONTENT: {clean[:200]}")

    if "API_OK" in clean:
        log("PASS: API works and prompt response is valid.")
        return 0

    log("WARN: API responded but content did not match expected token.")
    return 6


if __name__ == "__main__":
    raise SystemExit(run_test())
