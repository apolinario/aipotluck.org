#!/usr/bin/env python3
"""TEST — principle-grounding for the qualitative / "is it possible" subset.

Hypothesis: the physics / invariant puzzles (Archimedes water-level, mutilated-
chessboard parity, Euler-path traversal, Lights-Out solvability) are NOT solved by
simulating the premise — they're solved by applying a GENERAL law/invariant. The
recite bias attaches to the puzzle's *answer* ("looks like the famous water-level
puzzle → X"), NOT to the *law* ("floating objects displace their weight"), which is
puzzle-independent and recalled reliably. So:

  Stage 1 — elicit the governing PRINCIPLE only, puzzle-independent, no answer.
  Stage 2 — apply that principle to the LITERAL altered premise → FINAL answer.

The principle is a near-external truth source: its recall channel is orthogonal to
the puzzle-answer recite. This is the independence law satisfied a different way than
code execution (ground in the stable general fact, not the treacherous pattern-match).

Compares, on the clean yn subset: direct (recite baseline) vs CoT vs principle-
grounded. Deterministic FINAL-line grader. Model from APERTUS_MODEL (never hard-coded).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from loop import chat  # cached CSCS client re-exported via loop's import
from loop import CHEAP_MODEL
from unpuzzles import load_items, classify, FINAL_DIRECTIVE

HERE = Path(__file__).parent

PRINCIPLE_SYS = (
    "You identify the single general principle that governs a situation — a physical "
    "law, a conservation rule, or a mathematical invariant (e.g. a parity/colouring "
    "argument, an Euler-path condition, Archimedes' principle). State ONLY the general "
    "principle, in one or two sentences, in its general form. Do NOT solve anything, do "
    "NOT mention any specific famous puzzle, and do NOT give a yes/no or numeric answer."
)

APPLY_SYS = (
    "You apply a stated general principle to the exact conditions you are given, "
    "reasoning only from that principle and the literal facts. Do not rely on any "
    "remembered answer to a similar famous puzzle; the conditions here may differ from "
    "the famous version. Reason briefly, then give the answer."
)

COT_SYS = (
    "Read the problem literally; it may differ from a famous puzzle it resembles. "
    "Reason step by step, then give the answer."
)


def _raw(problem: str) -> str:
    return problem[: -len(FINAL_DIRECTIVE)] if problem.endswith(FINAL_DIRECTIVE) else problem


def direct(problem: str, model: str, kind: str, cache: bool) -> str:
    suffix = ("\n\nAnswer with exactly one word, yes or no." if kind == "yn"
              else "\n\nAnswer with a single integer.")
    return chat([{"role": "user", "content": _raw(problem) + suffix}],
                model=model, max_tokens=6, temperature=0, use_cache=cache)


def cot(problem: str, model: str, cache: bool) -> str:
    return chat([{"role": "system", "content": COT_SYS},
                 {"role": "user", "content": _raw(problem) + FINAL_DIRECTIVE}],
                model=model, max_tokens=500, temperature=0, use_cache=cache)


def principle(problem: str, model: str, cache: bool) -> tuple[str, str]:
    raw = _raw(problem)
    P = chat([{"role": "system", "content": PRINCIPLE_SYS},
              {"role": "user", "content": raw}],
             model=model, max_tokens=160, temperature=0, use_cache=cache).strip()
    ans = chat([{"role": "system", "content": APPLY_SYS},
                {"role": "user", "content":
                    f"General principle:\n{P}\n\nExact situation:\n{raw}\n\n"
                    f"Apply the principle to THESE exact conditions.{FINAL_DIRECTIVE}"}],
               model=model, max_tokens=500, temperature=0, use_cache=cache)
    return ans, P


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=["yn", "int", "all"], default="yn")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--show-principle", action="store_true")
    args = ap.parse_args()
    cache = not args.no_cache
    model = CHEAP_MODEL
    if not model:
        raise SystemExit("set APERTUS_MODEL")

    items = load_items()
    if args.kind != "all":
        items = [it for it in items if it["kind"] == args.kind]
    print(f"served model = {model}\nsubset = {args.kind}  items = {len(items)}\n")

    cw = 10
    hdr = f"{'id':<28}{'direct':<{cw}}{'cot':<{cw}}{'principle':<{cw}}"
    print(hdr); print("-" * len(hdr))

    rows = []
    for it in items:
        d = classify(direct(it["problem"], model, it["kind"], cache), it)
        c = classify(cot(it["problem"], model, cache), it)
        pans, P = principle(it["problem"], model, cache)
        p = classify(pans, it)
        rows.append({"id": it["id"], "direct": d, "cot": c, "principle": p, "P": P})
        print(f"{it['id'][:26]:<28}{d:<{cw}}{c:<{cw}}{p:<{cw}}")
        if args.show_principle:
            print(f"      └─ {P[:120]}")

    print("-" * len(hdr))
    n = len(rows)

    def tally(k):
        g = sum(1 for r in rows if r[k] == "gold")
        t = sum(1 for r in rows if r[k] == "trap")
        return g, t

    print(f"\n{'cond':<12}{'gold':>5}{'trap':>5}{'gold%':>7}  vs-direct churn")
    dg, dt = tally("direct")
    print(f"{'direct':<12}{dg:>5}{dt:>5}{100*dg/n:>6.0f}%   (baseline)")
    for k in ("cot", "principle"):
        g, t = tally(k)
        resc = sum(1 for r in rows if r["direct"] != "gold" and r[k] == "gold")
        regr = sum(1 for r in rows if r["direct"] == "gold" and r[k] != "gold")
        print(f"{k:<12}{g:>5}{t:>5}{100*g/n:>6.0f}%   rescue {resc}  regress {regr}  "
              f"net {resc-regr:+d}")

    (HERE / "principle_probe.json").write_text(json.dumps(
        {"model_env": "APERTUS_MODEL", "subset": args.kind, "rows": rows}, indent=2))
    print(f"\nwrote {HERE/'principle_probe.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
