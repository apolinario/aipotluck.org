#!/usr/bin/env python3
"""Recite set via the HF ROUTER (ensemble fallback path) — heavy open reasoners.

CSCS is the sovereign preference; HF router is the approved fallback for the
ensemble. This reaches models CSCS doesn't serve (GLM-5.2, Qwen3-235B, DeepSeek-R1).
Thinking-aware: strips <think>…</think> before grading. Generous max_tokens.

HF token is read from HF_ROUTER_KEY env (recovered from .env.local's commented
pre-1.5-flip line; never hard-coded, never logged). Cached to .cache/.

  export HF_ROUTER_KEY=...    # the hf_ token
  python hf_probe.py "zai-org/GLM-5.2" "Qwen/Qwen3-235B-A22B-Instruct-2507" --limit 5
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

from unpuzzles import load_items, classify

HERE = Path(__file__).parent
CACHE = HERE / ".cache"
BASE = "https://router.huggingface.co/v1"
SYS = ("You are a careful problem solver. Read the problem literally — it may differ "
       "from a famous puzzle it resembles. Reason step by step, then answer.")


def _strip_think(t: str) -> str:
    return re.sub(r"<think>.*?</think>", "", t or "", flags=re.S | re.I).strip()


def hf_chat(messages, *, model, max_tokens=4096, use_cache=True) -> str:
    CACHE.mkdir(exist_ok=True)
    ck = "hf_" + hashlib.sha256(json.dumps(
        {"m": model, "msg": messages, "mt": max_tokens}, sort_keys=True).encode()
    ).hexdigest()[:22]
    cpath = CACHE / f"{ck}.json"
    if use_cache and cpath.exists():
        return json.loads(cpath.read_text())["content"]
    key = os.environ.get("HF_ROUTER_KEY")
    if not key:
        raise SystemExit("set HF_ROUTER_KEY")
    body = json.dumps({"model": model, "messages": messages, "temperature": 0,
                       "max_tokens": max_tokens, "stream": False}).encode()
    req = urllib.request.Request(f"{BASE}/chat/completions", data=body,
                                 headers={"Content-Type": "application/json",
                                          "Authorization": f"Bearer {key}"}, method="POST")
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.loads(r.read().decode())
    msg = d["choices"][0]["message"]
    content = msg.get("content") or ""
    # some thinking models put the answer in content after reasoning_content
    if not content and msg.get("reasoning_content"):
        content = msg["reasoning_content"]
    if use_cache:
        cpath.write_text(json.dumps({"content": content}))
    return content


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("models", nargs="+")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--max-tokens", type=int, default=4096)
    args = ap.parse_args()

    items = load_items()
    if args.limit:
        items = items[: args.limit]
    short = lambda m: m.split("/")[-1][:24]
    print(f"HF router · items={len(items)}\n")
    hdr = f"{'id':<26}" + "".join(f"{short(m):<26}" for m in args.models)
    print(hdr); print("-" * len(hdr))

    rows = []
    for it in items:
        rec = {"id": it["id"]}
        line = f"{it['id'][:24]:<26}"
        for m in args.models:
            try:
                ans = _strip_think(hf_chat([{"role": "system", "content": SYS},
                                            {"role": "user", "content": it["problem"]}],
                                           model=m, max_tokens=args.max_tokens))
                c = classify(ans, it)
            except Exception as e:
                c = f"ERR:{type(e).__name__}"
            rec[m] = c
            line += f"{c:<26}"
        rows.append(rec)
        print(line, flush=True)

    print("-" * len(hdr))
    n = len(items)
    print(f"\n{'model':<26}{'gold':>5}{'trap':>5}{'other':>6}{'gold%':>7}{'trap%':>7}")
    for m in args.models:
        g = sum(1 for r in rows if r[m] == "gold")
        t = sum(1 for r in rows if r[m] == "trap")
        o = sum(1 for r in rows if r[m] == "other")
        print(f"{short(m):<26}{g:>5}{t:>5}{o:>6}{100*g//max(n,1):>6}%{100*t//max(n,1):>6}%")

    (HERE / "hf_probe.json").write_text(json.dumps({"models": args.models, "rows": rows}))
    print(f"\nwrote {HERE/'hf_probe.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
