#!/usr/bin/env python3
"""Dump REAL open (sovereign 8B) + capable (GLM-5.2) answers for the demo prototype.

We render genuine model outputs in the prototype, not invented text — honesty
extends to the mockup. Cached; de-identified (no checkpoint name in the output).
"""
import json
from pathlib import Path

from spike_escalation import _solve, _final_token
from hf_probe import hf_chat, _strip_think, SYS as HF_SYS
from unpuzzles import load_items, classify

DEMO_IDS = ["17_monty_hall", "00_faulty_fruit_labeling", "28_the_blue_eyes_island_puzzle"]
GLM = "zai-org/GLM-5.2-FP8"

items = {it["id"]: it for it in load_items()}
out = []
for did in DEMO_IDS:
    it = items[did]
    open_ans = _solve(it["problem"])
    cap_ans = _strip_think(hf_chat(
        [{"role": "system", "content": HF_SYS},
         {"role": "user", "content": it["problem"]}], model=GLM, max_tokens=4096))
    out.append({
        "id": did,
        "name": it["puzzle_name"],
        "problem": it["problem"].split("\n\nAnswer the question")[0].strip(),
        "gold": it["gold"], "trap": it["trap"], "kind": it["kind"],
        "open_answer": open_ans.strip(), "open_class": classify(open_ans, it),
        "capable_answer": cap_ans.strip(), "capable_class": classify(cap_ans, it),
    })

Path("demo_assets.json").write_text(json.dumps(out, indent=2))
for r in out:
    print(f"{r['id']}: open={r['open_class']} capable={r['capable_class']} "
          f"(gold={r['gold']} trap={r['trap']})")
print("wrote demo_assets.json")
