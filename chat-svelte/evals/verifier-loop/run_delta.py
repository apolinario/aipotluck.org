#!/usr/bin/env python3
"""Delta-extract experiment on the UNPUZZLES discriminating set.

  export CSCS_SERVING_API=...
  export APERTUS_MODEL=...                  # served cheap model (extract+draft)
  ./fetch_unpuzzles.sh
  python run_delta.py            # baseline vs generic-loop(70B) vs delta-extract
  python run_delta.py --limit 8 # pilot

The generic loop only CHURNED on this class because the bias hit the extract
stage — the constraints it produced laundered the altered premise back to the
famous puzzle, so the judge had no independent foothold. The delta variant
replaces generic extract with a NAMED-DIFFERENCE step (canonical puzzle? what
changed? does it invalidate the famous answer?) and injects that difference as
an authoritative fact the drafter defers to — manufacturing the "elicited fact
the generator DEFERS to" the independence law requires. No judge model.

We report, per condition: gold / trap / other, and rescue/regress churn vs
baseline. The delta column also reports how often a delta was actually injected
(canonical puzzle recognised) and the trap-rate AMONG injected items — the clean
test of whether naming the change defeats the recite reflex.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from loop import (run_baseline, run_loop, run_delta, CHEAP_MODEL, STRONG_MODEL)
from unpuzzles import load_items, classify

HERE = Path(__file__).parent


def tally(rows: list[dict], key: str) -> dict:
    g = sum(1 for r in rows if r[key]["class"] == "gold")
    t = sum(1 for r in rows if r[key]["class"] == "trap")
    o = sum(1 for r in rows if r[key]["class"] == "other")
    return {"gold": g, "trap": t, "other": o, "n": len(rows)}


def churn(rows: list[dict], key: str) -> dict:
    resc = [r["id"] for r in rows
            if r["base"]["class"] != "gold" and r[key]["class"] == "gold"]
    regr = [r["id"] for r in rows
            if r["base"]["class"] == "gold" and r[key]["class"] != "gold"]
    return {"rescued": resc, "regressed": regr, "net": len(resc) - len(regr)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="pilot on first N items")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--max-rounds", type=int, default=2)
    ap.add_argument("--out", default="delta_run.json")
    args = ap.parse_args()
    kw = {"use_cache": not args.no_cache}

    items = load_items()
    if args.limit:
        items = items[: args.limit]

    print(f"extract/draft = {CHEAP_MODEL or '(unset APERTUS_MODEL)'}")
    print(f"items={len(items)}\n")
    cw = 12
    cols = ["base", "loop70b", "delta"]
    hdr = f"{'id':<30}{'kind':<5}" + "".join(f"{c:<{cw}}" for c in cols) + "inj  canonical"
    print(hdr)
    print("-" * len(hdr))

    rows: list[dict] = []
    for it in items:
        rec: dict = {"id": it["id"], "kind": it["kind"]}

        base = run_baseline(it["problem"], model=CHEAP_MODEL, **kw)
        rec["base"] = {"class": classify(base["answer"], it)}

        # cached from the earlier run — the generic loop with the 70B judge
        lp = run_loop(it["problem"], verify_model=STRONG_MODEL,
                      max_rounds=args.max_rounds, **kw)
        rec["loop70b"] = {"class": classify(lp["answer"], it)}

        dl = run_delta(it["problem"], **kw)
        rec["delta"] = {"class": classify(dl["answer"], it),
                        "injected": dl["injected"],
                        "canonical": (dl["delta"].get("canonical") or "")[:24]}

        rows.append(rec)
        inj = "Y" if rec["delta"]["injected"] else "."
        line = (f"{it['id'][:28]:<30}{it['kind']:<5}"
                f"{rec['base']['class']:<{cw}}{rec['loop70b']['class']:<{cw}}"
                f"{rec['delta']['class']:<{cw}}{inj:<5}{rec['delta']['canonical']}")
        print(line)

    print("-" * len(hdr))

    n = len(items)
    summary = {"baseline": tally(rows, "base")}
    for k in ("loop70b", "delta"):
        summary[k] = {**tally(rows, k), **churn(rows, k)}

    inj_rows = [r for r in rows if r["delta"]["injected"]]
    inj_n = len(inj_rows)
    inj_trap = sum(1 for r in inj_rows if r["delta"]["class"] == "trap")
    inj_gold = sum(1 for r in inj_rows if r["delta"]["class"] == "gold")

    print(f"\n{'condition':<14}{'gold':>5}{'trap':>5}{'gold%':>7}{'trap%':>7}"
          f"{'resc':>6}{'regr':>6}{'net':>5}")
    b = summary["baseline"]
    print(f"{'baseline':<14}{b['gold']:>5}{b['trap']:>5}"
          f"{100*b['gold']/n:>6.0f}%{100*b['trap']/n:>6.0f}%"
          f"{'-':>6}{'-':>6}{'-':>5}")
    for k in ("loop70b", "delta"):
        s = summary[k]
        print(f"{k:<14}{s['gold']:>5}{s['trap']:>5}"
              f"{100*s['gold']/n:>6.0f}%{100*s['trap']/n:>6.0f}%"
              f"{len(s['rescued']):>6}{len(s['regressed']):>6}{s['net']:>+5}")

    print(f"\ndelta injected on {inj_n}/{n} items (canonical puzzle recognised)")
    if inj_n:
        print(f"  among injected: gold {inj_gold}/{inj_n} ({100*inj_gold/inj_n:.0f}%), "
              f"trap {inj_trap}/{inj_n} ({100*inj_trap/inj_n:.0f}%)")
    print("  delta rescued :", ", ".join(summary["delta"]["rescued"]) or "(none)")
    print("  delta regressed:", ", ".join(summary["delta"]["regressed"]) or "(none)")

    (HERE / args.out).write_text(json.dumps(
        {"n": n, "summary": summary,
         "injected": {"n": inj_n, "gold": inj_gold, "trap": inj_trap},
         "rows": rows}, indent=2))
    print(f"\nwrote {HERE / args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
