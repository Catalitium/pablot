"""Standalone direct MiniMax API call script."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime

# Direct key requested by user. You can override via MINIMAX_API_KEY env var.
DEFAULT_API_KEY = "sk-api-dI1sZARqHAzrbuM7xNYDKR8YShp2LxC9XC6Q-bmFCzrW1jOGuJGoPDkjXfES03XWx78PCuUu98IN2qyXU0-leAmq2HEWTL5A46RFaMqs7rQB8x496Xu3Sqo"
DEFAULT_API_URL = "https://api.minimax.io/v1/chat/completions"
DEFAULT_MODEL = "MiniMax-Text-01"


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def log(msg: str) -> None:
    print(f"[{ts()}] [DIRECT] {msg}")


def main() -> int:
    api_key = os.environ.get("MINIMAX_API_KEY", "").strip() or DEFAULT_API_KEY
    api_url = os.environ.get("MINIMAX_API_URL", "").strip() or DEFAULT_API_URL
    model = os.environ.get("MINIMAX_MODEL", "").strip() or DEFAULT_MODEL

    log(f"Using URL: {api_url}")
    log(f"Using model: {model}")
    log(f"Using key ending: ...{api_key[-3:]}")

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Reply with exactly: OK"},
            {"role": "user", "content": "OK"},
        ],
        "temperature": 0.0,
        "max_tokens": 32,
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
            body = response.read().decode("utf-8")
        log(f"HTTP success. Raw response: {body[:800]}")
        return 0
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        log(f"HTTP {exc.code}. Response: {detail[:800]}")
        return 1
    except urllib.error.URLError as exc:
        log(f"URL error: {exc}")
        return 2
    except Exception as exc:
        log(f"Unexpected error: {exc}")
        return 3


if __name__ == "__main__":
    raise SystemExit(main())

