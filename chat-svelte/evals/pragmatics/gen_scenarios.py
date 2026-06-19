#!/usr/bin/env python3
"""Generate a larger labeled walk-or-drive set across the trap taxonomy.

Gold labels are derived from STRUCTURE, not from asking a model — so the eval
isn't circular (no LLM grading another LLM's traps). Templated with surface
variation; synthetic and formulaic by construction (a known limitation — real
HOB-style items vary more, so treat scaled numbers as directional, and keep the
hand-written scenarios.jsonl as the harder, more natural probe).

Six structures:
  co_presence            drive  — the serviced object (the vehicle) must be brought
  bring_heavy            drive  — you must bring an unportable load
  return_payload         drive  — you leave with an unportable load
  light_errand           walk   — trivial, hand-carryable
  self_service           walk   — service acts on you; you co-locate with yourself
  co_participant_walk    walk   — bring someone/something that can walk the distance
"""
from __future__ import annotations

import itertools
import json
from pathlib import Path

DISTANCES = ["100m", "200m", "0.5km", "300 metres", "a few minutes' walk", "just down the street"]

CO_PRESENCE = [  # (place, purpose-phrase)
    ("car wash", "to wash the car"),
    ("gas station", "to fill up the tank"),
    ("oil-change shop", "for an oil change"),
    ("tire shop", "to get new tires fitted"),
    ("inspection center", "for the annual car inspection"),
    ("auto detailer", "to get the car detailed"),
    ("EV charging station", "to charge the car"),
    ("mechanic", "to have the car looked at"),
]
BRING_HEAVY = [
    ("post office", "to mail a 30kg box"),
    ("recycling center", "to drop off a broken microwave"),
    ("donation center", "to donate a heavy bookshelf"),
    ("hardware store", "to return eight bags of cement"),
    ("shipping depot", "to send a packed 28kg suitcase"),
]
RETURN_PAYLOAD = [
    ("appliance store", "to buy a refrigerator"),
    ("garden center", "to pick up twenty paving stones"),
    ("electronics store", "to collect a 55-inch TV"),
    ("lumber yard", "to pick up a load of planks"),
    ("furniture store", "to bring home a wardrobe"),
]
LIGHT_ERRAND = [
    ("bakery", "to buy a loaf of bread"),
    ("ATM", "to get some cash"),
    ("coffee shop", "to grab a coffee"),
    ("post office", "to mail a single letter"),
    ("pharmacy", "to pick up one small prescription"),
    ("library", "to return one book"),
    ("corner shop", "to buy a few apples"),
]
SELF_SERVICE = [
    ("barber", "for a haircut"),
    ("dentist", "for a checkup"),
    ("gym", "for a workout"),
    ("clinic", "to get a flu shot"),
    ("optician", "for an eye exam"),
]
CO_PARTICIPANT = [
    ("dog groomer", "to take my dog for grooming"),
    ("school", "to drop my kid off"),
    ("friend's place", "to visit a friend"),
    ("park", "to take the dog for a walk"),
]

STRUCTURES = [
    ("co_presence", "drive", CO_PRESENCE),
    ("bring_heavy", "drive", BRING_HEAVY),
    ("return_payload", "drive", RETURN_PAYLOAD),
    ("light_errand", "walk", LIGHT_ERRAND),
    ("self_service", "walk", SELF_SERVICE),
    ("co_participant_walk", "walk", CO_PARTICIPANT),
]

PHRASINGS = [
    "The {place} is {dist} away. Should I walk or drive {purpose}?",
    "I want {purpose}. The {place} is {dist} from my house — walk or drive?",
    "There's a {place} {dist} from me. To {purpose2}, should I walk or drive?",
]


def build() -> list[dict]:
    rows = []
    for struct, gold, items in STRUCTURES:
        # cycle distances/phrasings deterministically across items
        for i, (place, purpose) in enumerate(items):
            for j in range(2):  # two surface variants per item
                dist = DISTANCES[(i + j) % len(DISTANCES)]
                tmpl = PHRASINGS[(i + j) % len(PHRASINGS)]
                purpose2 = purpose.replace("to ", "", 1) if purpose.startswith("to ") else purpose
                text = tmpl.format(place=place, dist=dist, purpose=purpose, purpose2=purpose2)
                rows.append({
                    "id": f"{struct}_{i}_{j}",
                    "text": text,
                    "gold": gold,
                    "category": struct,
                    "note": f"{struct} structure",
                })
    return rows


if __name__ == "__main__":
    rows = build()
    out = Path(__file__).parent / "scenarios_large.jsonl"
    with out.open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    from collections import Counter
    c = Counter(r["category"] for r in rows)
    g = Counter(r["gold"] for r in rows)
    print(f"wrote {len(rows)} scenarios -> {out.name}")
    print("by structure:", dict(c))
    print("by gold:", dict(g))
