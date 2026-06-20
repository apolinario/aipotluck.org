#!/usr/bin/env python3
"""SPIKE tradeoff: how much does trigger RECALL cost in escalation rate?

The spike's trigger is a dial, not a fixed thing. This sweeps it and prints the
Pareto table so we know the tradeoff before tuning anything. Two knobs:

  (1) perturbation strength k-of-N  [SOVEREIGN-ONLY, no second model]
      Fire if the local verdict is floundered OR stays unchanged under >= k of N
      premise perturbations. k=N is strict (only fire when the model is invariant
      to EVERY perturbation = strongest recite evidence, low recall, low escalation);
      k=1 is loose (any single non-load-bearing perturbation that doesn't move the
      answer trips it = high recall, but escalates almost everything).
  (2) cross-family disagreement  [adds ONE cheap different-prior model]
      Fire if a second open model (different pretraining prior) gives a different
      verdict. Orthogonal across priors; needs no premise identification. Catches
      recited traps the perturbation misses IFF the second prior doesn't recite the
      same famous answer.

Endpoints for context: escalate-none = local-only (sovereignty 100%, no rescue);
escalate-all = just use GLM (= 82%, but the sovereign model is bypassed entirely).
The trigger's whole job is to buy most of the rescue while keeping the sovereign
model primary on the easy majority. This table is that buy-vs-cost, measured.

All Apertus calls cached; the second-model column adds ~50 cached calls.
"""
from __future__ import annotations

import json
from pathlib import Path

from loop import chat
from unpuzzles import load_items, classify
from spike_escalation import _solve, _perturb, _final_token, LOCAL_MODEL, SOLVE_SYS

HERE = Path(__file__).parent
SECOND_MODEL = "Qwen/Qwen2.5-72B-Instruct"  # cheap-ish different-prior second opinion

# 4 perturbation styles; first two match spike_escalation's strings to reuse cache.
STYLES = [
    "alter one number to a clearly different number",
    "negate or flip one stated condition (e.g. 'random' <-> 'deliberate', add/remove a 'not')",
    "replace one named object or entity with a different one",
    "swap the values of two stated quantities",
]


def _second_verdict(item: dict) -> str | None:
    ans = chat([{"role": "system", "content": SOLVE_SYS},
                {"role": "user", "content": item["problem"]}],
               model=SECOND_MODEL, max_tokens=800, temperature=0, use_cache=True)
    return _final_token(ans, item["kind"])


def gather(items):
    """Per item: local class/verdict, invariant-count over N perturbations, second
    model's verdict + disagreement, and the cached GLM class."""
    glm = {r["id"]: r["zai-org/GLM-5.2-FP8"] for r in
           json.loads((HERE / "hf_probe.json").read_text())["rows"]}
    out = []
    for it in items:
        base = _solve(it["problem"])
        v0 = _final_token(base, it["kind"])
        local_cls = classify(base, it)
        inv = 0
        for s in STYLES:
            vi = _final_token(_solve(_perturb(it["problem"], s)), it["kind"])
            if v0 is not None and vi is not None and vi == v0:
                inv += 1
        q0 = _second_verdict(it)
        disagree = (v0 is None) or (q0 is None) or (q0 != v0)
        out.append({"id": it["id"], "kind": it["kind"], "local": local_cls,
                    "v0": v0, "floundered": v0 is None, "inv": inv,
                    "q0": q0, "disagree": disagree, "glm": glm.get(it["id"], "MISSING")})
        print(f"  {it['id'][:34]:<35} local={local_cls:<5} inv={inv}/{len(STYLES)} "
              f"2nd={'≠' if disagree else '='} glm={glm.get(it['id'],'?')}", flush=True)
    return out


def final_class(rec, fire):
    if not fire:
        return rec["local"]
    g = rec["glm"]
    return g if g in ("gold", "trap") else "decline"


def score(recs, fire_fn, n_styles):
    fires = [fire_fn(r) for r in recs]
    n = len(recs)
    esc = sum(fires)
    wrong = [r["local"] != "gold" for r in recs]
    tp = sum(1 for r, f, w in zip(recs, fires, wrong) if w and f)
    fp = sum(1 for r, f, w in zip(recs, fires, wrong) if not w and f)
    fn = sum(1 for r, f, w in zip(recs, fires, wrong) if w and not f)
    finals = [final_class(r, f) for r, f in zip(recs, fires)]
    gold = sum(1 for c in finals if c == "gold")
    trap = sum(1 for c in finals if c == "trap")
    decl = sum(1 for c in finals if c == "decline")
    rec_rate = tp / max(tp + fn, 1)
    prec = tp / max(tp + fp, 1)
    return {"esc": esc, "esc_pct": esc / n, "recall": rec_rate, "prec": prec,
            "gold": gold, "gold_pct": gold / n, "trap": trap, "decline": decl}


def main():
    items = load_items()
    print(f"gathering signals · items={len(items)} · N_perturb={len(STYLES)} "
          f"· 2nd={SECOND_MODEL.split('/')[-1]}\n")
    recs = gather(items)
    n = len(recs)
    oracle = sum(1 for r in recs if r["local"] == "gold") + sum(
        1 for r in recs if r["local"] != "gold" and r["glm"] == "gold")

    policies = [
        ("escalate-none", lambda r: False),
        ("k=4 (strict) + flounder", lambda r: r["floundered"] or r["inv"] >= 4),
        ("k=3 + flounder", lambda r: r["floundered"] or r["inv"] >= 3),
        ("k=2 + flounder", lambda r: r["floundered"] or r["inv"] >= 2),
        ("k=1 (loose) + flounder", lambda r: r["floundered"] or r["inv"] >= 1),
        ("cross-family only", lambda r: r["disagree"]),
        ("k=2 OR cross-family", lambda r: r["floundered"] or r["inv"] >= 2 or r["disagree"]),
        ("escalate-all (=GLM)", lambda r: True),
    ]

    print(f"\n{'policy':<26}{'esc%':>6}{'recall':>8}{'prec':>7}{'gold%':>8}{'trap':>6}{'decl':>6}")
    print("-" * 67)
    table = []
    for name, fn in policies:
        s = score(recs, fn, len(STYLES))
        table.append({"policy": name, **s})
        print(f"{name:<26}{s['esc_pct']*100:>5.0f}%{s['recall']*100:>7.0f}%"
              f"{s['prec']*100:>6.0f}%{s['gold_pct']*100:>7.0f}%{s['trap']:>6}{s['decline']:>6}")
    print("-" * 67)
    print(f"{'oracle (perfect trigger)':<26}{'':>6}{'100%':>8}{'':>7}{oracle*100//n:>6}%")

    (HERE / "spike_tradeoff.json").write_text(json.dumps(
        {"n": n, "n_perturb": len(STYLES), "oracle": oracle,
         "second_model": SECOND_MODEL, "policies": table, "rows": recs}, indent=2))
    print(f"\nwrote {HERE/'spike_tradeoff.json'}")


if __name__ == "__main__":
    main()
