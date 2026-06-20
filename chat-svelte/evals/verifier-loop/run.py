#!/usr/bin/env python3
"""Run the verifier loop vs a draft-only baseline on the smoke set.

  export CSCS_SERVING_API=...
  export APERTUS_MODEL=...                # the cheap/served model
  python run.py                           # baseline vs loop (strong verifier)
  python run.py --verify cheap            # ablation: 8B verifies itself
  python run.py --max-rounds 1
  python run.py --trace dead_cat          # full trace for one item
  python run.py --no-cache

The point: does EXTRACT->DRAFT->VERIFY->REVISE beat draft-only, and does the
STRONG verifier matter (run --verify cheap to see the gen-verification gap)?
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from loop import (
    run_baseline, run_loop, grade, CHEAP_MODEL, STRONG_MODEL,
)

HERE = Path(__file__).parent
SMOKE = HERE / "smoke.jsonl"


def load(only: list[str] | None) -> list[dict]:
    rows = [json.loads(l) for l in SMOKE.read_text().splitlines() if l.strip()]
    return [r for r in rows if not only or r["id"] in set(only)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verify", choices=["strong", "cheap"], default="strong",
                    help="verifier tier: strong=70B (default), cheap=the served 8B")
    ap.add_argument("--max-rounds", type=int, default=2)
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--trace")
    ap.add_argument("--no-cache", action="store_true")
    args = ap.parse_args()

    verify_model = STRONG_MODEL if args.verify == "strong" else CHEAP_MODEL
    kw = {"use_cache": not args.no_cache}

    if args.trace:
        rows = load([args.trace])
        if not rows:
            print(f"no item '{args.trace}'", file=sys.stderr)
            return 2
        r = run_loop(rows[0]["problem"], verify_model=verify_model,
                     max_rounds=args.max_rounds, **kw)
        print(json.dumps({"item": rows[0], **r}, indent=2, ensure_ascii=False))
        return 0

    rows = load(args.only)
    print(f"cheap={CHEAP_MODEL or '(unset APERTUS_MODEL)'}  verify={verify_model}  "
          f"rounds={args.max_rounds}\n")
    hdr = f"{'id':<24}{'baseline':<10}{'loop':<10}{'rounds':<8}"
    print(hdr)
    print("-" * len(hdr))
    b_ok = l_ok = 0
    for it in rows:
        base = run_baseline(it["problem"], model=CHEAP_MODEL, **kw)
        loop = run_loop(it["problem"], verify_model=verify_model,
                        max_rounds=args.max_rounds, **kw)
        bp = grade(base["answer"], it)
        lp = grade(loop["answer"], it)
        b_ok += bp
        l_ok += lp
        print(f"{it['id']:<24}{'PASS' if bp else 'FAIL':<10}"
              f"{'PASS' if lp else 'FAIL':<10}{loop['revise_rounds']:<8}")
    n = len(rows)
    print("-" * len(hdr))
    print(f"{'TOTAL':<24}{f'{b_ok}/{n}':<10}{f'{l_ok}/{n}':<10}")

    (HERE / "last_run.json").write_text(json.dumps(
        {"verify": args.verify, "baseline": b_ok, "loop": l_ok, "n": n}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
