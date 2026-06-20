#!/usr/bin/env python3
"""TEST A3 — does context-aware contrastive decoding (CoCoA/CAD-lite) recover gold?

Assumption A3 (gates prod fix #2): contrasting the answer distribution under the
ALTERED premise vs the CANONICAL (famous) premise shifts mass toward the gold
(premise-faithful) answer on recite items.

CAD/CoCoA at the answer token. For x in {gold, trap}:
    score_adj(x) = (1+λ)·log p_alt(x) − λ·log p_can(x)
where p_alt = prob under the altered problem, p_can = prob under the canonical
problem (the dataset's original_puzzle — the model's parametric prior, made
explicit). Tokens the altered premise favors *relative to* the canonical get
amplified; the recited-canonical answer gets penalised.

Decision = argmax over {gold, trap} of score_adj. Baseline decision = argmax of
p_alt alone (≈ the direct emit). We count flips:
    rescue  = baseline picked trap, CAD picks gold
    regress = baseline picked gold, CAD picks trap
Net>0 over a λ sweep ⇒ A3 holds and #2 is worth building. Net≈0 ⇒ the truth isn't
in the answer-token distribution to amplify (Test 1's locked-distribution ceiling
reappears) ⇒ #2 can't beat it at the answer token either.

Honest caveat this tests: Test 1 found p_alt(gold)≈0 on 11/14 recite items. CAD can
only amplify tokens that have SOME mass; it cannot conjure a fully-locked-out token.
So A3 is partly a test of whether that ceiling is fatal to #2.

Model id from APERTUS_MODEL (never hard-coded). Calls cached to .cache/.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from loop import CHEAP_MODEL
from unpuzzles import load_items, FINAL_DIRECTIVE
from probe_logits import chat_logprobs, _answer_token_index, _mass, CONSTRAIN

HERE = Path(__file__).parent
FLOOR = 1e-5
LAMBDAS = [0.5, 1.0, 2.0]


def _probs(prompt: str, kind: str, gold: str, trap: str, model: str) -> tuple[float, float]:
    r = chat_logprobs([{"role": "user", "content": prompt}], model=model, max_tokens=6)
    toks = r["tokens"]
    ai = _answer_token_index(toks, kind)
    if ai is None or not toks[ai].get("top"):
        return 0.0, 0.0
    top = toks[ai]["top"]
    return _mass(top, kind, gold), _mass(top, kind, trap)


def _adj(p_alt: float, p_can: float, lam: float) -> float:
    return (1 + lam) * math.log(max(p_alt, FLOOR)) - lam * math.log(max(p_can, FLOOR))


def main() -> int:
    model = CHEAP_MODEL
    if not model:
        raise SystemExit("set APERTUS_MODEL")
    items = [it for it in load_items() if it.get("canonical")]
    print(f"served model = {model}\nitems with canonical text = {len(items)}\n")

    cw = 9
    hdr = (f"{'id':<28}{'kind':<4}{'pA_g':>6}{'pA_t':>6}{'pC_g':>6}{'pC_t':>6}"
           f"{'base':>6}" + "".join(f"{'λ'+str(l):>6}" for l in LAMBDAS))
    print(hdr); print("-" * len(hdr))

    rows = []
    for it in items:
        g, t, k = it["gold"], it["trap"], it["kind"]
        alt = it["problem"]
        # strip the FINAL directive from problem, add the constrain suffix
        raw = alt[: -len(FINAL_DIRECTIVE)] if alt.endswith(FINAL_DIRECTIVE) else alt
        pA_g, pA_t = _probs(raw + CONSTRAIN[k], k, g, t, model)
        pC_g, pC_t = _probs(it["canonical"] + CONSTRAIN[k], k, g, t, model)

        base = "gold" if pA_g >= pA_t else "trap"
        decs = {}
        for lam in LAMBDAS:
            sg, st = _adj(pA_g, pC_g, lam), _adj(pA_t, pC_t, lam)
            decs[lam] = "gold" if sg >= st else "trap"
        rows.append({"id": it["id"], "kind": k, "base": base, "decs": decs,
                     "pA_g": pA_g, "pA_t": pA_t, "pC_g": pC_g, "pC_t": pC_t})
        print(f"{it['id'][:26]:<28}{k:<4}{pA_g:>6.2f}{pA_t:>6.2f}{pC_g:>6.2f}{pC_t:>6.2f}"
              f"{base:>6}" + "".join(f"{decs[l]:>6}" for l in LAMBDAS))

    print("-" * len(hdr))

    # ── A3 verdict: flips vs the with-context-only baseline ────────────────────
    print(f"\n{'λ':>5}{'gold_picks':>12}{'rescue':>8}{'regress':>9}{'net':>6}"
          "   (rescue=base trap→gold, regress=base gold→trap)")
    base_gold = sum(1 for r in rows if r["base"] == "gold")
    print(f"{'base':>5}{base_gold:>12}{'-':>8}{'-':>9}{'-':>6}")
    best = None
    for lam in LAMBDAS:
        gp = sum(1 for r in rows if r["decs"][lam] == "gold")
        resc = sum(1 for r in rows if r["base"] != "gold" and r["decs"][lam] == "gold")
        regr = sum(1 for r in rows if r["base"] == "gold" and r["decs"][lam] != "gold")
        net = resc - regr
        print(f"{lam:>5}{gp:>12}{resc:>8}{regr:>9}{net:>+6}")
        if best is None or net > best[1]:
            best = (lam, net)

    # clean yn-only view (single-token answers — least measurement noise)
    yn = [r for r in rows if r["kind"] == "yn"]
    print(f"\nyn-only subset (n={len(yn)}, cleanest single-token answers):")
    print(f"  base gold: {sum(1 for r in yn if r['base']=='gold')}")
    for lam in LAMBDAS:
        gp = sum(1 for r in yn if r["decs"][lam] == "gold")
        resc = sum(1 for r in yn if r["base"] != "gold" and r["decs"][lam] == "gold")
        regr = sum(1 for r in yn if r["base"] == "gold" and r["decs"][lam] != "gold")
        print(f"  λ{lam}: gold {gp}  rescue {resc}  regress {regr}  net {resc-regr:+d}")

    (HERE / "contrast_probe.json").write_text(json.dumps(
        {"model_env": "APERTUS_MODEL", "lambdas": LAMBDAS, "rows": rows}, indent=2))
    print(f"\nbest λ by net = {best}\nwrote {HERE/'contrast_probe.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
