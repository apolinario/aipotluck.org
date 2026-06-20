#!/usr/bin/env python3
"""DEMO-RISK probe: the car-wash co-presence trap on the ACTUAL served models.

The Geneva-launch fear: an audience member asks the famous car-wash question, the
open model says "walk", and it undercuts everything. The car-wash is the co-presence
class — the ONE class we solved with a real external truth source (worldModel.ts's
deterministic gate). This probe checks, on the served 8B AND 70B:

  1. BARE: does the model whiff the car-wash trap (say walk) without the gate?
  2. GATE: does our gate (occlude distance → extract 2 neutral facts → deterministic
     reframe2Gate) correctly FIRE on the trap (requires_vehicle = true)?
  3. CONTROLS: on genuine walk errands, does the gate correctly NOT fire (no false-flip)?

Replicates worldModel.ts logic in Python against the CSCS endpoint. Model ids from
argv (never hard-coded the pre-release id). Cached.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from loop import chat  # cached CSCS client

# ── ported verbatim from worldModel.ts ──────────────────────────────────────
DIST_RE = re.compile(
    r"\b(only |just )?\d+(\.\d+)?\s?(m|km|meters?|metres?|kilom\w*)\b"
    r"( away| down the road| from (my|the) (house|home))?", re.I)


def occlude_distance(t: str) -> str:
    return DIST_RE.sub("nearby", t)


REFRAME_SYS = ("You extract two neutral yes/no facts about a situation as JSON. You do "
               "NOT give travel advice and you do NOT decide walk vs drive. Answer only "
               "the JSON.")


def reframe_user(s: str) -> str:
    return (f"Situation: {s}\n\nAnswer as JSON with exactly these two keys:\n"
            '- "services_a_vehicle": does the purpose involve servicing, fuelling, '
            "charging, repairing, inspecting, or otherwise acting ON a road vehicle "
            "(car, van, motorbike) — so that the vehicle itself must be physically at "
            'the destination? "yes" or "no"\n'
            '- "moves_heavy_load": to accomplish this, must the person transport an '
            "object too heavy or bulky to carry by hand on foot — either bringing it to "
            "the destination or taking it home? A person or animal that walks on its own "
            'is NOT a load. "yes" or "no"\n\nReturn only the JSON object.')


def parse_facts(raw: str):
    m = re.search(r"\{[\s\S]*\}", raw or "")
    if not m:
        return None
    for cand in (m.group(0), re.sub(r",\s*}", "}", m.group(0)).replace("'", '"')):
        try:
            o = json.loads(cand)
            return o if isinstance(o, dict) else None
        except json.JSONDecodeError:
            continue
    return None


def is_yes(v) -> bool:
    return str(v or "").strip().lower().startswith("y")


def gate(facts) -> bool:
    if not facts:
        return False
    return is_yes(facts.get("services_a_vehicle")) or is_yes(facts.get("moves_heavy_load"))


# ── test cases ──────────────────────────────────────────────────────────────
TRAPS = [
    ("car_wash", "The car wash is 100m away. Should I walk or drive?", "drive"),
    ("gas_station", "The gas station is 200m down the road and my car is low on fuel. "
                    "Should I walk or drive?", "drive"),
    ("mechanic", "The mechanic is just 150m from my house and my car needs an oil "
                 "change. Walk or drive?", "drive"),
]
CONTROLS = [
    ("bakery", "The bakery is 100m away. Should I walk or drive?", "walk"),
    ("post_letter", "The post office is 200m away and I need to mail a letter. Walk or "
                    "drive?", "walk"),
    ("pharmacy", "The pharmacy is 300m down the road to pick up a small prescription. "
                 "Walk or drive?", "walk"),
]

WALK_RE = re.compile(r"\bwalk\b", re.I)
DRIVE_RE = re.compile(r"\b(drive|take (the|your) (car|vehicle))\b", re.I)


def bare_advice(q: str, model: str) -> str:
    out = chat([{"role": "user", "content": q}], model=model, max_tokens=200,
               temperature=0, use_cache=True)
    # first directive verb wins
    dm, wm = DRIVE_RE.search(out), WALK_RE.search(out)
    if dm and (not wm or dm.start() < wm.start()):
        return "drive"
    if wm:
        return "walk"
    return "?"


def run_gate(q: str, model: str):
    raw = chat([{"role": "system", "content": REFRAME_SYS},
                {"role": "user", "content": reframe_user(occlude_distance(q))}],
               model=model, max_tokens=120, temperature=0, use_cache=True)
    f = parse_facts(raw)
    return gate(f), f


def main() -> int:
    models = sys.argv[1:]
    if not models:
        raise SystemExit("usage: carwash_probe.py <model_id> [<model_id> ...]")
    for model in models:
        print(f"\n=== {model} ===")
        print(f"{'case':<14}{'gold':<7}{'bare':<7}{'gate_fires':<12}{'facts'}")
        print("-" * 70)
        whiffs = fp = 0
        for label, q, gold in TRAPS:
            bare = bare_advice(q, model)
            fires, f = run_gate(q, model)
            whiff = bare != gold
            whiffs += whiff
            fixed = " WHIFF->fixed-by-gate" if (whiff and fires) else (" WHIFF" if whiff else "")
            print(f"{label:<14}{gold:<7}{bare:<7}{str(fires):<12}{f}{fixed}")
        for label, q, gold in CONTROLS:
            bare = bare_advice(q, model)
            fires, f = run_gate(q, model)
            if fires:
                fp += 1
            flag = " ✗FALSE-FLIP" if fires else ""
            print(f"{label:<14}{gold:<7}{bare:<7}{str(fires):<12}{f}{flag}")
        print(f"\n  bare whiffs on traps: {whiffs}/{len(TRAPS)}   "
              f"gate false-flips on controls: {fp}/{len(CONTROLS)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
