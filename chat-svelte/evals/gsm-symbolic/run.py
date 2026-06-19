#!/usr/bin/env python3
"""Run GSM-Symbolic robustness probes and score.

Usage:
  export CSCS_SERVING_API=...
  python run.py                 # both probes, full set
  python run.py --trace var_473_0
  python run.py --no-cache

Two probes, two honest metrics:
  VARIANCE (main only, N instances per template; only names/numbers change):
    - acc            overall accuracy
    - unstable       templates that are NEITHER all-right NOR all-wrong across
                     their instances -> the model's answer depends on the
                     surface numbers, not the structure. The robustness failure.
    - spread         mean within-template accuracy range (max-min over instances)
  DIFFICULTY (instance 0 at main / p1 / p2; clauses added):
    - per-level accuracy. NOTE: p1/p2 are genuinely harder, so SOME drop is
      warranted -- this is the fragility CURVE, not a claim that the drop is
      unjustified (the unreleased GSM-NoOp control would be needed for that).
"""
from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

from gsm import CONDITIONS, cond_solve, is_correct, DEFAULT_MODEL

HERE = Path(__file__).parent
SCENARIOS = HERE / ".cache" / "scenarios_gsm.jsonl"


def load(only):
    rows = [json.loads(l) for l in SCENARIOS.read_text().splitlines() if l.strip()]
    return [r for r in rows if not only or r["id"] in set(only)]


def main() -> int:
    ap = argparse.ArgumentParser()
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
            print(f"no id '{args.trace}'", file=sys.stderr)
            return 2
        r = rows[0]; res = cond_solve(r["question"], **kw)
        print(json.dumps({"scenario": r, "run": res,
                          "correct": is_correct(res["pred"], r["gold"])},
                         indent=2, ensure_ascii=False))
        return 0

    rows = load(args.only)
    print(f"model: {DEFAULT_MODEL}   n={len(rows)}", file=sys.stderr)
    correct: dict[str, bool] = {}
    for r in rows:
        res = cond_solve(r["question"], **kw)
        correct[r["id"]] = is_correct(res["pred"], r["gold"])

    # ---- VARIANCE ----
    var = [r for r in rows if r["probe"] == "variance"]
    by_t: dict[int, list[bool]] = collections.defaultdict(list)
    for r in var:
        by_t[r["template_id"]].append(correct[r["id"]])
    acc_v = sum(correct[r["id"]] for r in var) / len(var) if var else 0
    unstable = [t for t, cs in by_t.items() if 0 < sum(cs) < len(cs)]
    spreads = [(max(cs) - min(cs)) for cs in by_t.values()]  # 1 if mixed, 0 if uniform
    print("\n=== VARIANCE PROBE (main; names/numbers vary, structure fixed) ===")
    print(f"  overall accuracy : {sum(correct[r['id']] for r in var)}/{len(var)} "
          f"({round(100*acc_v)}%)")
    print(f"  unstable templates: {len(unstable)}/{len(by_t)}  "
          f"(neither all-right nor all-wrong across instances)")
    print(f"  per-template acc : " +
          ", ".join(f"{t}:{sum(cs)}/{len(cs)}" for t, cs in sorted(by_t.items())))

    # ---- DIFFICULTY ----
    print("\n=== DIFFICULTY PROBE (instance 0; main -> p1 -> p2, clauses added) ===")
    diff = [r for r in rows if r["probe"] == "difficulty"]
    for lvl in ("main", "p1", "p2"):
        ids = [r for r in diff if r["level"] == lvl]
        hit = sum(correct[r["id"]] for r in ids)
        print(f"  {lvl:<5} {hit}/{len(ids)} ({round(100*hit/len(ids)) if ids else 0}%)")
    print("  (p1/p2 are legitimately harder; this is the fragility curve, not a"
          " claim the drop is unwarranted)")

    (HERE / "last_run.json").write_text(json.dumps(
        {"correct": correct,
         "variance": {"acc": acc_v, "unstable": unstable, "n_templates": len(by_t)}},
        indent=2))
    print(f"\nwrote {HERE / 'last_run.json'}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
