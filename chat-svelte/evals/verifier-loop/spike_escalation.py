#!/usr/bin/env python3
"""SPIKE: the visible-escalation pipeline end-to-end on the UNPUZZLES recite set.

Architecture under test (decided 2026-06-19):
    local primary (served Apertus, sovereign)
        -> humility-trigger  [perturbation-invariance, recognition-free]
        -> VISIBLE escalation on the stack map
        -> heavier open reasoner (GLM-5.2, open-weights via HF router)
        -> honest decline floor for what even the reasoner misses

Everything downstream of the trigger is already proven:
  - GLM-5.2 rescue = 82% gold on this set (hf_probe.json, cached)
  - honest decline = trivial
The ONE unvalidated piece is the TRIGGER: does a cheap, recognition-free signal
fire on the turns the local model gets WRONG without firing on everything?

The trigger we test is perturbation-invariance (the established design): a model
that is RECITING a famous answer is INSENSITIVE to the altered premise. So we
perturb a stated quantity/condition and re-ask; if the verdict does not move when
a load-bearing premise moves, the model is not reasoning over the premise -> fire.
This reads an ORTHOGONAL channel (input perturbation -> output divergence), not the
shared-prior judgment channel that every LLM-judge loop died in (A1/A3).

This is a SPIKE: throwaway, measures precision/recall of the trigger and the
end-to-end pipeline accuracy vs local-only. Generator outputs are cached to disk;
only the trigger makes new (cached) CSCS calls. No app code is touched.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from loop import chat, CHEAP_MODEL
from unpuzzles import load_items, classify

HERE = Path(__file__).parent

# Served sovereign primary = the cheap model prod actually runs.
LOCAL_MODEL = CHEAP_MODEL

SOLVE_SYS = (
    "You are a careful problem solver. Read the problem literally — it may differ "
    "from a famous puzzle it resembles. Reason step by step, then answer."
)

# The perturbation generator. It must NOT solve; it changes exactly one stated
# value so a premise-faithful solver's answer is LIKELY to move while a reciter's
# (locked on the famous answer) stays put. Two styles for independent evidence.
PERTURB_SYS = (
    "You rewrite a word problem by changing exactly ONE stated quantity or "
    "condition to a different concrete value — {style}. Change nothing else; keep "
    "every other word identical. Do NOT solve it or comment. Output only the "
    "rewritten problem."
)
PERTURB_STYLES = [
    "alter one number to a clearly different number",
    "negate or flip one stated condition (e.g. 'random' <-> 'deliberate', add/remove a 'not')",
]


def _final_token(answer: str, kind: str) -> str | None:
    """The yes/no or integer in the FINAL line (raw, not graded)."""
    hits = re.findall(r"final\s*:\s*(.+)", answer or "", re.I)
    fin = hits[-1] if hits else ((answer or "").strip().splitlines() or [""])[-1]
    if kind == "yn":
        m = re.search(r"\b(yes|no)\b", fin, re.I)
        return m.group(1).lower() if m else None
    m = re.search(r"-?\d+", fin)
    return m.group(0) if m else None


def _solve(problem: str) -> str:
    return chat(
        [{"role": "system", "content": SOLVE_SYS},
         {"role": "user", "content": problem}],
        model=LOCAL_MODEL, max_tokens=800, temperature=0, use_cache=True,
    )


def _perturb(problem: str, style: str) -> str:
    raw = problem.split("\n\nAnswer the question exactly as asked.")[0]  # drop FINAL directive
    out = chat(
        [{"role": "system", "content": PERTURB_SYS.format(style=style)},
         {"role": "user", "content": raw}],
        model=LOCAL_MODEL, max_tokens=600, temperature=0, use_cache=True,
    ).strip()
    return out + ("\n\nAnswer the question exactly as asked. Reason briefly, then end "
                  "with a single line in the form:\nFINAL: <your answer>")


def humility_trigger(item: dict) -> dict:
    """Perturbation-invariance. Fire (escalate) iff the verdict is INVARIANT across
    premise perturbations — i.e. the model ignores the altered premise (reciting).

    Returns {fire, v0, perturbed: [v1, v2], base_answer}.
    """
    base_answer = _solve(item["problem"])
    v0 = _final_token(base_answer, item["kind"])
    pv = []
    for style in PERTURB_STYLES:
        pa = _solve(_perturb(item["problem"], style))
        pv.append(_final_token(pa, item["kind"]))
    # Escalate when the local model is NOT reliably reasoning over the premise:
    #  (a) it floundered — no clean verdict at all (v0 is None), or
    #  (b) it was premise-INVARIANT — verdict never moved under perturbation (recite).
    # Both are "don't trust local here" signals; escalation is safe (routes to GLM),
    # so we bias toward recall. (a) catches the 'other' class the pure-invariance
    # detector is blind to; (b) is the recognition-free recite signal.
    floundered = v0 is None
    moved = any(vi is not None and v0 is not None and vi != v0 for vi in pv)
    invariant = (v0 is not None) and (not moved)
    fire = floundered or invariant
    why = "floundered" if floundered else ("invariant" if invariant else "premise-sensitive")
    return {"fire": fire, "v0": v0, "perturbed": pv, "why": why,
            "base_answer": base_answer}


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    items = load_items()
    if args.limit:
        items = items[: args.limit]

    glm = {r["id"]: r["zai-org/GLM-5.2-FP8"] for r in
           json.loads((HERE / "hf_probe.json").read_text())["rows"]}

    print(f"SPIKE: visible-escalation pipeline · items={len(items)} · local=served sovereign 8B\n")
    hdr = f"{'id':<40}{'local':<7}{'fire':<6}{'glm':<7}{'final':<7}"
    print(hdr); print("-" * len(hdr))

    rows = []
    for it in items:
        local_cls = classify(_solve(it["problem"]), it)  # cached, same call as trigger's base
        trig = humility_trigger(it)
        gcls = glm.get(it["id"], "MISSING")
        escalated = trig["fire"]
        if escalated:
            # route to GLM; honest decline floor if even GLM can't produce a clean verdict
            final = gcls if gcls in ("gold", "trap") else "decline"
        else:
            final = local_cls
        rows.append({"id": it["id"], "local": local_cls, "fire": escalated,
                     "glm": gcls, "final": final})
        print(f"{it['id'][:39]:<40}{local_cls:<7}{'YES' if escalated else '·':<6}{gcls:<7}{final:<7}", flush=True)

    print("-" * len(hdr))
    n = len(rows)

    def rate(pred):
        return sum(1 for r in rows if pred(r))

    # trigger as a detector of "local was wrong" (non-gold)
    wrong = lambda r: r["local"] != "gold"
    tp = rate(lambda r: wrong(r) and r["fire"])
    fn = rate(lambda r: wrong(r) and not r["fire"])
    fp = rate(lambda r: not wrong(r) and r["fire"])
    tn = rate(lambda r: not wrong(r) and not r["fire"])
    prec = tp / max(tp + fp, 1)
    rec = tp / max(tp + fn, 1)

    local_gold = rate(lambda r: r["local"] == "gold")
    final_gold = rate(lambda r: r["final"] == "gold")
    final_trap = rate(lambda r: r["final"] == "trap")
    final_decl = rate(lambda r: r["final"] == "decline")
    escalations = rate(lambda r: r["fire"])

    # oracle ceiling: escalate exactly the wrong ones, trust GLM there
    oracle = rate(lambda r: r["local"] == "gold") + rate(
        lambda r: r["local"] != "gold" and r["glm"] == "gold")

    print(f"""
TRIGGER (perturbation-invariance) as detector of 'local wrong':
  TP={tp}  FN={fn}  FP={fp}  TN={tn}   precision={prec:.0%}  recall={rec:.0%}
  escalations: {escalations}/{n}  ({escalations/n:.0%} of turns routed to the reasoner)

END-TO-END accuracy (gold rate):
  local only ............ {local_gold}/{n}  {local_gold/n:.0%}
  PIPELINE .............. {final_gold}/{n}  {final_gold/n:.0%}   (+{final_gold-local_gold})
  ...still trap (wrong) .. {final_trap}/{n}  {final_trap/n:.0%}
  ...honest decline ..... {final_decl}/{n}  {final_decl/n:.0%}
  oracle ceiling ........ {oracle}/{n}  {oracle/n:.0%}   (perfect trigger)
""")

    (HERE / "spike_run.json").write_text(json.dumps(
        {"n": n, "local_gold": local_gold, "pipeline_gold": final_gold,
         "trap": final_trap, "decline": final_decl, "escalations": escalations,
         "oracle": oracle, "precision": prec, "recall": rec, "rows": rows}, indent=2))
    print(f"wrote {HERE/'spike_run.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
