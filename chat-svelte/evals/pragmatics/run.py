#!/usr/bin/env python3
"""Run the walk-or-drive pragmatic-trap eval across conditions and score.

Usage:
  export CSCS_SERVING_API=...           # your CSCS serving key
  python run.py                         # all conditions, all scenarios
  python run.py --cond A_baseline C_hybrid
  python run.py --only carwash gas      # subset of scenario ids
  python run.py --trace carwash         # dump the full hybrid trace for one id
  python run.py --no-cache              # force re-call the endpoint

Scoring separates two things a single accuracy number would hide:
  - trap recall    : on gold=drive items, did we correctly say drive?
  - walk precision : on gold=walk items, did we WRONGLY flip to drive?
A trick that says "drive" everywhere scores 100% trap recall and 0% walk
preservation. We want both high.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pragmatics import CONDITIONS, cond_hybrid

HERE = Path(__file__).parent
SCENARIOS = HERE / "scenarios.jsonl"


def load_scenarios(only: list[str] | None, path: Path | None = None) -> list[dict]:
    src = path or SCENARIOS
    rows = [json.loads(l) for l in src.read_text().splitlines() if l.strip()]
    if only:
        rows = [r for r in rows if r["id"] in set(only)]
    return rows


def score(rows: list[dict], results: dict[str, dict]) -> dict:
    """results: cond -> {id -> answer}."""
    gold = {r["id"]: r["gold"] for r in rows}
    drive_ids = [r["id"] for r in rows if r["gold"] == "drive"]
    walk_ids = [r["id"] for r in rows if r["gold"] == "walk"]
    out = {}
    for cond, ans in results.items():
        correct = sum(1 for i, g in gold.items() if ans.get(i) == g)
        trap_hit = sum(1 for i in drive_ids if ans.get(i) == "drive")
        walk_keep = sum(1 for i in walk_ids if ans.get(i) == "walk")
        out[cond] = {
            "overall": f"{correct}/{len(gold)}",
            "overall_pct": round(100 * correct / len(gold)),
            "trap_recall": f"{trap_hit}/{len(drive_ids)}",
            "walk_preserved": f"{walk_keep}/{len(walk_ids)}",
            "false_flips": len(walk_ids) - walk_keep,
        }
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cond", nargs="*", default=list(CONDITIONS))
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--trace")
    ap.add_argument("--file", help="alternate scenarios jsonl (e.g. scenarios_large.jsonl)")
    ap.add_argument("--by-cat", action="store_true", help="print per-structure accuracy")
    ap.add_argument("--no-cache", action="store_true")
    args = ap.parse_args()

    kw = {"use_cache": not args.no_cache}
    fpath = (HERE / args.file) if args.file else None

    if args.trace:
        rows = load_scenarios([args.trace], fpath)
        if not rows:
            print(f"no scenario id '{args.trace}'", file=sys.stderr)
            return 2
        r = cond_hybrid(rows[0]["text"], return_trace=True, **kw)
        print(json.dumps({"scenario": rows[0], "hybrid": r}, indent=2, ensure_ascii=False))
        return 0

    rows = load_scenarios(args.only, fpath)
    results: dict[str, dict] = {c: {} for c in args.cond}
    per_item: list[dict] = []

    for r in rows:
        line = {"id": r["id"], "gold": r["gold"], "cat": r["category"]}
        for cond in args.cond:
            res = CONDITIONS[cond](r["text"], **kw)
            results[cond][r["id"]] = res["answer"]
            line[cond] = res["answer"]
        per_item.append(line)

    # ---- per-item table ----
    conds = args.cond
    w = max(len(c) for c in conds + ["gold"]) + 1
    hdr = f"{'id':<16}{'cat':<10}{'gold':<{w}}" + "".join(f"{c:<{w}}" for c in conds)
    print(hdr)
    print("-" * len(hdr))
    for it in per_item:
        cells = ""
        for c in conds:
            mark = "" if it[c] == it["gold"] else " x"
            cells += f"{it[c] + mark:<{w}}"
        print(f"{it['id']:<16}{it['cat']:<10}{it['gold']:<{w}}{cells}")

    # ---- scoreboard ----
    sb = score(rows, results)
    print("\nSCOREBOARD")
    print(f"{'cond':<14}{'overall':<10}{'trap_recall':<14}{'walk_preserved':<16}{'false_flips':<12}")
    for c in conds:
        s = sb[c]
        print(f"{c:<14}{s['overall']:<10}{s['trap_recall']:<14}{s['walk_preserved']:<16}{s['false_flips']:<12}")

    # ---- per-structure accuracy ----
    if args.by_cat:
        cats = sorted({r["category"] for r in rows})
        gold = {r["id"]: r["gold"] for r in rows}
        cat_of = {r["id"]: r["category"] for r in rows}
        print("\nBY STRUCTURE (correct / n)")
        print(f"{'structure':<22}" + "".join(f"{c:<12}" for c in conds))
        for cat in cats:
            ids = [i for i in gold if cat_of[i] == cat]
            cells = ""
            for c in conds:
                hit = sum(1 for i in ids if results[c].get(i) == gold[i])
                cells += f"{f'{hit}/{len(ids)}':<12}"
            print(f"{cat:<22}{cells}")

    (HERE / "last_run.json").write_text(
        json.dumps({"per_item": per_item, "scoreboard": sb}, indent=2, ensure_ascii=False)
    )
    print(f"\nwrote {HERE / 'last_run.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
