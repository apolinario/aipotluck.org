#!/usr/bin/env python3
"""Run the citation-reason classification eval and score it honestly.

Usage:
  export CSCS_SERVING_API=...
  python run.py                      # both conditions, full set
  python run.py --cond F_defs
  python run.py --trace historical_00
  python run.py --no-cache

Scoring goes well beyond bare accuracy, because bare accuracy lies on a noisy
human-labeled task:
  acc            overall accuracy (gold = majority of 3 annotators)
  acc_unanimous  accuracy on the 3/3-agreement subset (the CLEAN signal)
  macro_f1       mean per-category F1 -> exposes majority-class / lopsided guess
  factual_vs_op  accuracy of the product-relevant collapse (checkable-fact vs
                 opinion/controversial) -- the routing decision that matters
Reference lines: human inter-annotator agreement ~63% (Redi 2019); random over
8 balanced categories = 12.5%.
"""
from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

from prov import CONDITIONS, _classify, DEFAULT_MODEL
from taxonomy import NAMES, FACTUAL, ATTRIBUTE

HERE = Path(__file__).parent
SCENARIOS = HERE / "scenarios_prov.jsonl"
HUMAN_CEILING = 0.63  # Redi 2019 avg inter-annotator agreement


def load(only):
    rows = [json.loads(l) for l in SCENARIOS.read_text().splitlines() if l.strip()]
    return [r for r in rows if not only or r["id"] in set(only)]


def _grp(name):
    return "factual" if name in FACTUAL else ("attribute" if name in ATTRIBUTE else "other")


def macro_f1(rows, preds):
    f1s = []
    for cat in NAMES:
        tp = sum(1 for r in rows if r["gold"] == cat and preds.get(r["id"]) == cat)
        fp = sum(1 for r in rows if r["gold"] != cat and preds.get(r["id"]) == cat)
        fn = sum(1 for r in rows if r["gold"] == cat and preds.get(r["id"]) != cat)
        p = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1s.append(2 * p * rec / (p + rec) if p + rec else 0.0)
    return sum(f1s) / len(f1s)


def score(rows, preds):
    n = len(rows)
    acc = sum(1 for r in rows if preds.get(r["id"]) == r["gold"]) / n
    uni = [r for r in rows if r["agreement"] == 3]
    acc_u = (sum(1 for r in uni if preds.get(r["id"]) == r["gold"]) / len(uni)) if uni else 0.0
    # product collapse: only on factual+attribute items (exclude 'other')
    fa = [r for r in rows if _grp(r["gold"]) in ("factual", "attribute")]
    fa_ok = sum(1 for r in fa if preds.get(r["id"]) and _grp(preds[r["id"]]) == _grp(r["gold"]))
    ungraded = sum(1 for r in rows if preds.get(r["id"]) is None)
    return {
        "acc": round(100 * acc),
        "acc_unanimous": f"{round(100*acc_u)}% (n={len(uni)})",
        "macro_f1": round(macro_f1(rows, preds), 3),
        "factual_vs_op": f"{round(100*fa_ok/len(fa))}% (n={len(fa)})",
        "ungraded": ungraded,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cond", nargs="*", default=list(CONDITIONS))
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--trace")
    ap.add_argument("--confusion", action="store_true", help="print confusion matrix for a cond")
    ap.add_argument("--no-cache", action="store_true")
    args = ap.parse_args()
    kw = {"use_cache": not args.no_cache}

    if args.trace:
        rows = load([args.trace])
        if not rows:
            print(f"no id '{args.trace}'", file=sys.stderr)
            return 2
        r = rows[0]
        out = {c: _classify(r["statement"], with_defs=(c == "F_defs"), **kw) for c in CONDITIONS}
        print(json.dumps({"scenario": r, "runs": out}, indent=2, ensure_ascii=False))
        return 0

    rows = load(args.only)
    print(f"model: {DEFAULT_MODEL}   n={len(rows)}   "
          f"(human ceiling ~{round(100*HUMAN_CEILING)}%, random 12.5%)", file=sys.stderr)
    results = {c: {} for c in args.cond}
    for r in rows:
        for c in args.cond:
            results[c][r["id"]] = CONDITIONS[c](r["statement"], **kw)["pred"]

    print(f"\n{'cond':<10}{'acc':<7}{'acc_unanimous':<18}{'macro_f1':<11}"
          f"{'factual_vs_op':<18}{'ungraded':<9}")
    print("-" * 73)
    sb = {}
    for c in args.cond:
        s = score(rows, results[c]); sb[c] = s
        print(f"{c:<10}{str(s['acc'])+'%':<7}{s['acc_unanimous']:<18}{str(s['macro_f1']):<11}"
              f"{s['factual_vs_op']:<18}{str(s['ungraded']):<9}")
    print(f"\nreference: human agreement ~{round(100*HUMAN_CEILING)}% · random (8-way) 12.5%")

    # per-category recall for the first condition
    print("\nPER-CATEGORY RECALL")
    print(f"{'category':<14}" + "".join(f"{c:<10}" for c in args.cond))
    for cat in NAMES:
        ids = [r["id"] for r in rows if r["gold"] == cat]
        cells = ""
        for c in args.cond:
            hit = sum(1 for i in ids if results[c].get(i) == cat)
            cells += f"{f'{hit}/{len(ids)}':<10}"
        print(f"{cat:<14}{cells}")

    if args.confusion:
        c = args.cond[0]
        print(f"\nCONFUSION ({c}): rows=gold, cols=pred")
        cm = collections.Counter((r["gold"], results[c].get(r["id"]) or "—") for r in rows)
        cols = NAMES + ["—"]
        print(f"{'':<13}" + "".join(f"{n[:4]:<5}" for n in cols))
        for g in NAMES:
            print(f"{g:<13}" + "".join(f"{cm.get((g,p),0):<5}" for p in cols))

    (HERE / "last_run.json").write_text(
        json.dumps({"results": results, "scoreboard": sb}, indent=2, ensure_ascii=False))
    print(f"\nwrote {HERE / 'last_run.json'}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
