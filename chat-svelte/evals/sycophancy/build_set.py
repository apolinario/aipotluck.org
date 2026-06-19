#!/usr/bin/env python3
"""Build a curated, committed sycophancy probe set from the released data.

Source: Sharma et al. 2023, "Towards Understanding Sycophancy in Language
Models" (arXiv:2310.13548). Data released at github.com/meg-tong/sycophancy-eval
under datasets/are_you_sure.jsonl — a multiple-choice QA set where, after the
model answers, the user pushes back ("are you sure?") and we measure whether the
model *abandons a correct answer*.

We do NOT commit the raw 5.8 MB upstream file. This script samples a small,
stratified, DETERMINISTIC slice (no RNG — fixed stride per sub-dataset) into
our own schema and writes scenarios_syco.jsonl, which IS committed with
attribution. Re-running reproduces the identical sample.

Run:  python build_set.py            # reads .cache/are_you_sure.jsonl, writes set
      python build_set.py --download  # fetch the raw file first if missing
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / ".cache" / "are_you_sure.jsonl"
OUT = HERE / "scenarios_syco.jsonl"
URL = "https://raw.githubusercontent.com/meg-tong/sycophancy-eval/main/datasets/are_you_sure.jsonl"

# Per-sub-dataset quota. truthful_qa_mc weighted highest: abandoning a TRUE
# answer for a popular misconception under pushback is the chat-trust failure
# we most care about. math/aqua probe reasoning; mmlu probes knowledge.
QUOTA = {
    "truthful_qa_mc": 24,
    "mmlu_mc_cot": 20,
    "math_mc_cot": 18,
    "aqua_mc": 18,
}


def download() -> None:
    RAW.parent.mkdir(exist_ok=True)
    print(f"downloading {URL} -> {RAW} ...", file=sys.stderr)
    urllib.request.urlretrieve(URL, RAW)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true")
    args = ap.parse_args()
    if args.download or not RAW.exists():
        download()

    rows = [json.loads(l) for l in RAW.read_text().splitlines() if l.strip()]
    # group by sub-dataset, keep only clean A-E MC items with a correct_letter
    by_ds: dict[str, list[dict]] = {}
    for r in rows:
        ds = r["base"]["dataset"]
        cl = r["base"].get("correct_letter")
        if ds in QUOTA and cl and cl in "ABCDE":
            by_ds.setdefault(ds, []).append(r)

    out: list[dict] = []
    for ds, n in QUOTA.items():
        pool = by_ds.get(ds, [])
        if not pool:
            print(f"WARN: no items for {ds}", file=sys.stderr)
            continue
        # deterministic stride sample, evenly spread across the pool
        stride = max(1, len(pool) // n)
        picked = pool[::stride][:n]
        for i, r in enumerate(picked):
            b = r["base"]
            # the first human turn is the full MC question prompt
            q = next(m["content"] for m in r["prompt"] if m["type"] == "human")
            out.append({
                "id": f"{ds}_{i:02d}",
                "dataset": ds,
                "question": q,
                "correct_letter": b["correct_letter"],
            })

    OUT.write_text("\n".join(json.dumps(o, ensure_ascii=False) for o in out) + "\n")
    print(f"wrote {len(out)} items -> {OUT}")
    for ds in QUOTA:
        c = sum(1 for o in out if o["dataset"] == ds)
        print(f"  {ds:<18} {c}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
