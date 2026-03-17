"""MiniMax LLM client using urllib.request with retries and endpoint fallbacks."""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Dict, List

PRIMARY_URL = "https://api.minimax.chat/v1/text/chatcompletion_v2"
FALLBACK_URL = "https://api.minimax.io/v1/chat/completions"
DEFAULT_MODEL = "MiniMax-Text-01"


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _print(msg: str) -> None:
    print(f"[{_ts()}] [LLM] {msg}")


def _endpoints() -> List[str]:
    env_url = os.environ.get("MINIMAX_API_URL", "").strip()
    # If user explicitly sets MINIMAX_API_URL, trust that endpoint only.
    # Optional fallback can be enabled via MINIMAX_ALLOW_FALLBACK=true.
    if env_url:
        allow_fallback = os.environ.get("MINIMAX_ALLOW_FALLBACK", "").strip().lower() in {"1", "true", "yes"}
        if not allow_fallback:
            return [env_url]
        urls = [env_url]
        if env_url != PRIMARY_URL:
            urls.append(PRIMARY_URL)
        if env_url != FALLBACK_URL:
            urls.append(FALLBACK_URL)
        return urls
    return [PRIMARY_URL, FALLBACK_URL]


def _extract_content(result: Dict[str, Any]) -> str:
    # Explicit API error envelope from MiniMax.
    if isinstance(result, dict) and isinstance(result.get("base_resp"), dict):
        base_resp = result.get("base_resp", {})
        status_code = base_resp.get("status_code")
        status_msg = base_resp.get("status_msg", "unknown error")
        raise RuntimeError(f"MiniMax API error ({status_code}): {status_msg}")

    # 1) Standard OpenAI-compatible path.
    try:
        content = result["choices"][0]["message"]["content"]
        if isinstance(content, str) and content.strip():
            return content
    except Exception:
        pass

    # 2) Handle reasoning_details fallback when content is empty.
    try:
        message = result["choices"][0]["message"]
        content = message.get("content", "") if isinstance(message, dict) else ""
        if isinstance(content, str) and content.strip():
            return content

        reasoning_details = message.get("reasoning_details", []) if isinstance(message, dict) else []
        if isinstance(reasoning_details, list):
            parts = []
            for item in reasoning_details:
                if isinstance(item, dict):
                    text = item.get("text", "")
                    if isinstance(text, str) and text.strip():
                        parts.append(text)
                elif isinstance(item, str) and item.strip():
                    parts.append(item)
            if parts:
                return "\n".join(parts)
    except Exception:
        pass

    # 3) reply fallback for alternative MiniMax endpoints.
    reply = result.get("reply", "") if isinstance(result, dict) else ""
    if isinstance(reply, str) and reply.strip():
        return reply

    raise ValueError("MiniMax response missing usable assistant content")


def _request_once(url: str, model: str, api_key: str, payload: Dict[str, Any]) -> str:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(req, timeout=120) as response:
        raw = response.read().decode("utf-8")
    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON from MiniMax ({url}): {raw[:500]}") from exc

    try:
        content = _extract_content(result)
        _print(f"Response received ({len(content)} chars)")
        return content
    except Exception as parse_exc:
        _print(f"RAW RESPONSE: {json.dumps(result, ensure_ascii=False)[:500]}")
        raise RuntimeError(
            f"Failed to parse MiniMax response from {url}: {parse_exc} | raw={json.dumps(result, ensure_ascii=False)[:500]}"
        ) from parse_exc


def chat_completion(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """Call MiniMax chat completion API with retries and fallback endpoints."""
    api_key = os.environ.get("MINIMAX_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("MINIMAX_API_KEY is not set")

    model = os.environ.get("MINIMAX_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    errors: List[str] = []
    urls = _endpoints()

    for attempt in range(2):
        if attempt > 0:
            _print("Retry attempt 2/2 after 2 seconds")
            time.sleep(2)
        for url in urls:
            _print(f"Calling MiniMax API (model={model}, url={url})")
            try:
                return _request_once(url, model, api_key, payload)
            except urllib.error.HTTPError as exc:
                detail = ""
                try:
                    detail = exc.read().decode("utf-8")
                except Exception:
                    detail = ""
                err = f"HTTP {exc.code} at {url}: {detail[:500]}"
                _print(err)
                errors.append(err)
            except urllib.error.URLError as exc:
                err = f"URL error at {url}: {exc}"
                _print(err)
                errors.append(err)
            except Exception as exc:
                err = f"Call failed at {url}: {exc}"
                _print(err)
                errors.append(err)

    raise RuntimeError("MiniMax call failed after retries. Errors: " + " | ".join(errors))


def chat_completion_json(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.4,
) -> dict:
    """Call MiniMax and parse returned content as JSON."""
    raw = chat_completion(system_prompt, user_prompt, temperature=temperature)
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def strip_think_blocks(text: str) -> str:
    """Remove <think>...</think> blocks and trim remaining text."""
    if not isinstance(text, str):
        return ""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    return cleaned.strip()
