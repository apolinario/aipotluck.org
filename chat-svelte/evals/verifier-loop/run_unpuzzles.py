#!/usr/bin/env python3
"""Run the verifier loop on the UNPUZZLES discriminating set, any set of judges.

  export CSCS_SERVING_API=...
  export APERTUS_MODEL=...                  # served cheap model (extract+draft)
  ./fetch_unpuzzles.sh
  # default: baseline + same-family judges (Apertus 70B, Apertus 8B)
  python run_unpuzzles.py
  # cross-family independence test — add non-Apertus judges (same CSCS endpoint):
  python run_unpuzzles.py --judge Qwen/Qwen2.5-72B-Instruct \
                          --judge meta-llama/Llama-3.3-70B-Instruct
  python run_unpuzzles.py --limit 8         # pilot

extract+draft always run on the served cheap model; only the VERIFY model varies
per condition, so the extract/draft calls are cached and shared across judges —
the comparison isolates the judge. The independence law predicts a CROSS-FAMILY
judge (different prior) should rescue more than a same-family 70B (which recites
in unison with the generator). We report rescue/regress churn, not just net.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from loop import run_baseline, run_loop, CHEAP_MODEL, STRONG_MODEL
from unpuzzles import load_items, classify

HERE = Path(__file__).parent


def short(model: str) -> str:
    """A compact column label from a model id."""
    tail = model.split("/")[-1]
    return re.sub(r"-Instruct.*$|-2509$", "", tail)[:14] or tail[:14]


def tally(rows: list[dict], key: str) -> dict:
    g = sum(1 for r in rows if r[key]["class"] == "gold")
    t = sum(1 for r in rows if r[key]["class"] == "trap")
    o = sum(1 for r in rows if r[key]["class"] == "other")
    rr = [r[key].get("rounds", 0) for r in rows]
    return {"gold": g, "trap": t, "other": o, "n": len(rows),
            "mean_rounds": round(sum(rr) / max(len(rr), 1), 2)}


def churn(rows: list[dict], key: str) -> dict:
    rescued = [r["id"] for r in rows
               if r["base"]["class"] != "gold" and r[key]["class"] == "gold"]
    regressed = [r["id"] for r in rows
                 if r["base"]["class"] == "gold" and r[key]["class"] != "gold"]
    return {"rescued": rescued, "regressed": regressed,
            "net": len(rescued) - len(regressed)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--judge", action="append", default=[],
                    help="extra verify model (repeatable); replaces same-family "
                         "defaults if --only-judges is set")
    ap.add_argument("--only-judges", action="store_true",
                    help="use ONLY the --judge models (skip Apertus 70B/8B defaults)")
    ap.add_argument("--max-rounds", type=int, default=2)
    ap.add_argument("--limit", type=int, help="pilot on first N items")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--out", default="unpuzzles_run.json")
    args = ap.parse_args()

    # Conditions: (label, verify_model). Same-family defaults unless --only-judges.
    conds: list[tuple[str, str]] = []
    if not args.only_judges:
        conds += [("apertus70b", STRONG_MODEL), ("apertus8b", CHEAP_MODEL)]
    conds += [(short(m), m) for m in args.judge]
    # de-dup by model, preserving order
    seen: set[str] = set()
    conds = [(l, m) for l, m in conds if not (m in seen or seen.add(m))]

    items = load_items()
    if args.limit:
        items = items[: args.limit]
    kw = {"use_cache": not args.no_cache}

    print(f"extract/draft = {CHEAP_MODEL or '(unset APERTUS_MODEL)'}")
    print(f"items={len(items)}  rounds={args.max_rounds}")
    print("judges: " + ", ".join(f"{l}={m}" for l, m in conds) + "\n")

    labels = [l for l, _ in conds]
    cw = 12
    hdr = f"{'id':<30}{'kind':<5}{'base':<{cw}}" + "".join(f"{l:<{cw}}" for l in labels)
    print(hdr)
    print("-" * len(hdr))

    rows: list[dict] = []
    for it in items:
        rec: dict = {"id": it["id"], "kind": it["kind"]}
        base = run_baseline(it["problem"], model=CHEAP_MODEL, **kw)
        rec["base"] = {"class": classify(base["answer"], it)}
        line = f"{it['id'][:28]:<30}{it['kind']:<5}{rec['base']['class']:<{cw}}"
        for label, vmodel in conds:
            lp = run_loop(it["problem"], verify_model=vmodel,
                          max_rounds=args.max_rounds, **kw)
            rec[label] = {"class": classify(lp["answer"], it),
                          "rounds": lp["revise_rounds"]}
            line += f"{rec[label]['class']:<{cw}}"
        rows.append(rec)
        print(line)

    print("-" * len(hdr))

    # ── summary ──────────────────────────────────────────────────────────────
    summary = {"baseline": tally(rows, "base")}
    for label, _ in conds:
        summary[label] = {**tally(rows, label), **churn(rows, label)}

    n = len(items)
    print(f"\n{'condition':<16}{'gold':>5}{'trap':>5}{'gold%':>7}{'trap%':>7}"
          f"{'resc':>6}{'regr':>6}{'net':>5}{'rounds':>8}")
    b = summary["baseline"]
    print(f"{'baseline':<16}{b['gold']:>5}{b['trap']:>5}"
          f"{100*b['gold']/n:>6.0f}%{100*b['trap']/n:>6.0f}%"
          f"{'-':>6}{'-':>6}{'-':>5}{'-':>8}")
    for label, _ in conds:
        s = summary[label]
        print(f"{label:<16}{s['gold']:>5}{s['trap']:>5}"
              f"{100*s['gold']/n:>6.0f}%{100*s['trap']/n:>6.0f}%"
              f"{len(s['rescued']):>6}{len(s['regressed']):>6}{s['net']:>+5}"
              f"{s['mean_rounds']:>8}")

    (HERE / args.out).write_text(json.dumps(
        {"n": n, "max_rounds": args.max_rounds, "conditions": labels,
         "summary": summary, "rows": rows}, indent=2))
    print(f"\nwrote {HERE / args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
