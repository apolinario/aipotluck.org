"""Thin CSCS (Swiss AI / Apertus) chat client with on-disk response caching.

The endpoint is OpenAI-compatible, so we just POST /v1/chat/completions.
Every (model, messages, temperature, max_tokens) tuple is hashed; identical
calls return the cached JSON from disk instead of re-billing the endpoint.
That makes the A/B baselines free to re-run while you iterate on condition C.

Key is read from the CSCS_SERVING_API env var (never hard-coded, never logged).
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

# CSCS-direct serving endpoint (Apertus 1.5 lives here, not on the HF router).
BASE_URL = os.environ.get("CSCS_BASE_URL", "https://api.swissai.svc.cscs.ch/v1")
# Default to the model production actually serves, so an unset run tests what
# users get — not a stale checkpoint. Override with APERTUS_MODEL to probe others.
DEFAULT_MODEL = os.environ.get("APERTUS_MODEL", "swiss-ai/Apertus-1.5-8B-Instruct-sft-dpo-tools")
CACHE_DIR = Path(__file__).parent / ".cache"


class MissingKey(RuntimeError):
    pass


def _key() -> str:
    k = os.environ.get("CSCS_SERVING_API")
    if not k:
        raise MissingKey(
            "Set CSCS_SERVING_API to your CSCS serving key, e.g.\n"
            "  export CSCS_SERVING_API=$(cat /path/to/key)\n"
            "then re-run."
        )
    return k


def _cache_key(model: str, messages: list[dict], temperature: float, max_tokens: int) -> str:
    blob = json.dumps(
        {"model": model, "messages": messages, "t": temperature, "m": max_tokens},
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:24]


def chat(
    messages: list[dict],
    *,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.0,
    max_tokens: int = 512,
    use_cache: bool = True,
    retries: int = 3,
) -> str:
    """Return the assistant message content. Cached on disk by content hash."""
    CACHE_DIR.mkdir(exist_ok=True)
    ck = _cache_key(model, messages, temperature, max_tokens)
    cpath = CACHE_DIR / f"{ck}.json"
    if use_cache and cpath.exists():
        return json.loads(cpath.read_text())["content"]

    payload = json.dumps(
        {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
    ).encode("utf-8")

    last_err: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(
            f"{BASE_URL}/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {_key()}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            content = data["choices"][0]["message"]["content"]
            if use_cache:
                cpath.write_text(json.dumps({"content": content, "raw_usage": data.get("usage")}))
            return content
        except (urllib.error.HTTPError, urllib.error.URLError, KeyError, TimeoutError) as e:
            last_err = e
            if isinstance(e, urllib.error.HTTPError) and e.code in (400, 401, 403):
                # Auth / bad-request errors won't fix themselves on retry.
                body = e.read().decode("utf-8", "replace")[:300]
                raise RuntimeError(f"CSCS {e.code}: {body}") from e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"CSCS call failed after {retries} attempts: {last_err}")
