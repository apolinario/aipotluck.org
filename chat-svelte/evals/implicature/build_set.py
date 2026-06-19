#!/usr/bin/env python3
"""Build the conversational-implicature probe set from Ruis et al. 2022.

Source: Ruis, Khan, Biderman, Hooker, Rocktäschel & Grefenstette 2022, "Large
Language Models are Not Zero-Shot Communicators" (arXiv:2210.14986). Data:
github.com/LauraRuis/do-pigs-fly (`data/type_labels.csv` = the annotated test
subset; `dev_conversational_implicatures.csv` = held-out few-shot pool).

LICENSE NOTE: the repo ships no explicit license. Conservatively, we do NOT
commit the corpus. This script fetches the CSVs into .cache (gitignored), samples
a stratified deterministic slice, writes scenarios to .cache (gitignored), and
commits only selected_indices.json — integer row indices, reproducible metadata.

Task: given a context question + an indirect response, does it implicate Yes or
No? Label = polarity (first word) of the Implicature column.

Run:  python build_set.py            # uses cached CSVs
      python build_set.py --download  # fetch them first
"""
from __future__ import annotations

import argparse
import csv
import collections
import json
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
CACHE = HERE / ".cache"
OUT = CACHE / "scenarios_impl.jsonl"          # gitignored
MANIFEST = HERE / "selected_indices.json"      # committed (integers only)
BASE = "https://raw.githubusercontent.com/LauraRuis/do-pigs-fly/main/data"
FILES = {"type_labels.csv": "type_labels.csv",
         "dev.csv": "dev_conversational_implicatures.csv"}

PER_TYPE = 80   # per coarse type -> 40 per (type,label) cell -> 160 balanced total


def download() -> None:
    CACHE.mkdir(exist_ok=True)
    for local, remote in FILES.items():
        print(f"downloading {remote}", file=sys.stderr)
        urllib.request.urlretrieve(f"{BASE}/{remote}", CACHE / local)


def polarity(impl: str) -> str | None:
    w = impl.strip().lower().lstrip(".").strip()
    if w.startswith("yes"):
        return "yes"
    if w.startswith("no"):
        return "no"
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true")
    args = ap.parse_args()
    if args.download or not (CACHE / "type_labels.csv").exists():
        download()

    rows = []
    with (CACHE / "type_labels.csv").open() as f:
        for i, r in enumerate(csv.DictReader(f)):
            gold = polarity(r["Implicature"])
            ctx = (r["Utterance"] or "").strip()
            resp = (r["Response"] or "").strip()
            if not gold or not ctx or not resp:
                continue
            typ = (r["Type"] or "").strip()
            coarse = "particularised" if typ == "Particularised" else "generalised"
            rows.append({"row": i, "context": ctx, "response": resp, "gold": gold,
                         "type": typ, "coarse": coarse,
                         "needs_world": (r.get("Factual knowledge", "").strip().lower() == "yes")})

    # stratify by coarse type, balance yes/no within, deterministic
    out: list[dict] = []
    for coarse in ("particularised", "generalised"):
        pool = [r for r in rows if r["coarse"] == coarse]
        for lab in ("yes", "no"):
            sub = sorted([r for r in pool if r["gold"] == lab], key=lambda r: r["row"])
            stride = max(1, len(sub) // (PER_TYPE // 2))
            out.extend(sub[::stride][:PER_TYPE // 2])

    out.sort(key=lambda r: r["row"])
    for j, r in enumerate(out):
        r["id"] = f"{r['coarse'][:4]}_{r['gold']}_{j:02d}"
    OUT.write_text("\n".join(json.dumps(o, ensure_ascii=False) for o in out) + "\n")
    MANIFEST.write_text(json.dumps([r["row"] for r in out]))

    print(f"wrote {len(out)} items -> {OUT}")
    print("  by coarse type:", dict(collections.Counter(r["coarse"] for r in out)))
    print("  by gold       :", dict(collections.Counter(r["gold"] for r in out)))
    print("  needs world   :", sum(1 for r in out if r["needs_world"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
