#!/usr/bin/env python3
"""Is ROBUSTNESS a model-capability thing? UNPUZZLES recite set across the open zoo.

The harness can't manufacture premise-faithful reasoning the weights lack. But we
have the whole open HF/CSCS catalog. This asks the grounded question: does a stronger
/ reasoning-tuned OPEN model just *have* robustness to small changes to classic
riddles, where Apertus recites?

Same 50 cleanly-gradeable discriminating UNPUZZLES items, deterministic FINAL-line
grader, gold = correct altered answer, trap = recited famous answer. No harness, no
loop — just each model answering directly. Cached.

Model ids passed on argv (all open-weights; none hard-coded here).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from loop import chat
from unpuzzles import load_items, classify

HERE = Path(__file__).parent
SYS = ("You are a careful problem solver. Read the problem literally — it may differ "
       "from a famous puzzle it resembles. Reason step by step, then answer.")


def main() -> int:
    models = sys.argv[1:]
    if not models:
        raise SystemExit("usage: probe_models.py <model_id> [<model_id> ...]")
    items = load_items()
    print(f"items = {len(items)}\n")

    short = lambda m: m.split("/")[-1][:26]
    hdr = f"{'id':<28}" + "".join(f"{short(m):<28}" for m in models)
    print(hdr); print("-" * len(hdr))

    rows = []
    for it in items:
        rec = {"id": it["id"]}
        line = f"{it['id'][:26]:<28}"
        for m in models:
            ans = chat([{"role": "system", "content": SYS},
                        {"role": "user", "content": it["problem"]}],
                       model=m, max_tokens=800, temperature=0, use_cache=True)
            c = classify(ans, it)
            rec[m] = c
            line += f"{c:<28}"
        rows.append(rec)
        print(line)

    print("-" * len(hdr))
    n = len(items)
    print(f"\n{'model':<30}{'gold':>5}{'trap':>5}{'other':>6}{'gold%':>7}{'trap%':>7}")
    summary = {}
    for m in models:
        g = sum(1 for r in rows if r[m] == "gold")
        t = sum(1 for r in rows if r[m] == "trap")
        o = sum(1 for r in rows if r[m] == "other")
        summary[m] = {"gold": g, "trap": t, "other": o}
        print(f"{short(m):<30}{g:>5}{t:>5}{o:>6}{100*g/n:>6.0f}%{100*t/n:>6.0f}%")

    (HERE / "models_probe.json").write_text(json.dumps(
        {"n": n, "models": models, "summary": summary, "rows": rows}, indent=2))
    print(f"\nwrote {HERE/'models_probe.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
