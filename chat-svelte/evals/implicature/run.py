#!/usr/bin/env python3
"""Run the conversational-implicature eval and score.

Usage:
  export CSCS_SERVING_API=...
  python run.py                  # both conditions, full set
  python run.py --trace part_no_03
  python run.py --no-cache

Binary task (yes/no), so the reference lines matter:
  chance        50%
  majority      always-Yes baseline (set is balanced -> 50%)
  human ceiling ~86% (Ruis et al. 2022)
Reported per coarse type: PARTICULARISED (context-dependent, the hard ones) vs
GENERALISED (more context-free). Few-shot vs zero-shot is the headline axis.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from implicature import CONDITIONS, cond_zeroshot, cond_fewshot, DEFAULT_MODEL

HERE = Path(__file__).parent
SCENARIOS = HERE / ".cache" / "scenarios_impl.jsonl"
HUMAN_CEILING = 0.86


def load(only):
    rows = [json.loads(l) for l in SCENARIOS.read_text().splitlines() if l.strip()]
    return [r for r in rows if not only or r["id"] in set(only)]


def acc(rows, preds):
    g = sum(1 for r in rows if preds.get(r["id"]) == r["gold"])
    return g, len(rows)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cond", nargs="*", default=list(CONDITIONS))
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--trace")
    ap.add_argument("--no-cache", action="store_true")
    args = ap.parse_args()
    kw = {"use_cache": not args.no_cache}

    if not SCENARIOS.exists():
        print("no scenarios — run build_set.py first", file=sys.stderr)
        return 2

    if args.trace:
        rows = load([args.trace])
        if not rows:
            print(f"no id '{args.trace}'", file=sys.stderr); return 2
        r = rows[0]
        out = {"zeroshot": cond_zeroshot(r["context"], r["response"], **kw),
               "fewshot": cond_fewshot(r["context"], r["response"], **kw)}
        print(json.dumps({"scenario": r, "runs": out}, indent=2, ensure_ascii=False))
        return 0

    rows = load(args.only)
    print(f"model: {DEFAULT_MODEL}   n={len(rows)}   "
          f"(chance 50%, human ~{round(100*HUMAN_CEILING)}%)", file=sys.stderr)
    preds = {c: {} for c in args.cond}
    for r in rows:
        for c in args.cond:
            preds[c][r["id"]] = CONDITIONS[c](r["context"], r["response"], **kw)["pred"]

    print(f"\n{'cond':<12}{'overall':<12}{'particularised':<17}{'generalised':<15}"
          f"{'needs_world':<13}{'ungraded':<9}")
    print("-" * 78)
    sb = {}
    for c in args.cond:
        g, n = acc(rows, preds[c])
        part = acc([r for r in rows if r["coarse"] == "particularised"], preds[c])
        gen = acc([r for r in rows if r["coarse"] == "generalised"], preds[c])
        nw = acc([r for r in rows if r["needs_world"]], preds[c])
        ung = sum(1 for r in rows if preds[c].get(r["id"]) is None)
        sb[c] = {"overall": f"{g}/{n}", "pct": round(100*g/n)}
        print(f"{c:<12}{f'{g}/{n} ({round(100*g/n)}%)':<12}"
              f"{f'{part[0]}/{part[1]} ({round(100*part[0]/part[1])}%)':<17}"
              f"{f'{gen[0]}/{gen[1]} ({round(100*gen[0]/gen[1])}%)':<15}"
              f"{f'{nw[0]}/{nw[1]}':<13}{str(ung):<9}")
    print(f"\nreference: chance 50% · majority-class (balanced) 50% · human ~{round(100*HUMAN_CEILING)}%")

    (HERE / "last_run.json").write_text(json.dumps({"preds": preds, "scoreboard": sb}, indent=2))
    print(f"\nwrote {HERE / 'last_run.json'}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
