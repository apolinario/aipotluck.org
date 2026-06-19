#!/usr/bin/env python3
"""Build a curated, committed citation-reason classification set from the REAL
Redi et al. 2019 Citation Reason corpus (figshare 7756226; CC-BY-SA, derived
from Wikipedia). arXiv:1902.11116.

We do NOT commit the 1.9 MB raw CSV. This script samples a stratified,
DETERMINISTIC slice (fixed stride per category, no RNG) into our own schema and
writes scenarios_prov.jsonl, which IS committed (attributed). Re-running
reproduces the identical sample.

Each raw row has a statement + three annotator votes (codes 1-8). We keep only
items with a clear majority (>=2 of 3 agree) and record the agreement level so
the scorer can separate unanimous (clean gold) from split (ambiguous) items.

Run:  python build_set.py            # uses .cache/citation_reason.csv
      python build_set.py --download  # fetch the raw CSV from figshare first
"""
from __future__ import annotations

import argparse
import csv
import collections
import sys
import urllib.request
from pathlib import Path

from taxonomy import NAME_BY_CODE

HERE = Path(__file__).parent
RAW = HERE / ".cache" / "citation_reason.csv"
OUT = HERE / "scenarios_prov.jsonl"
# figshare download (same file fetch_samples.py in slimemold used).
URL = "https://ndownloader.figshare.com/files/14441312"

PER_CATEGORY = 30   # stratified target per reason category (8 cats -> ~240)


def download() -> None:
    RAW.parent.mkdir(exist_ok=True)
    print(f"downloading Citation Reason corpus -> {RAW} ...", file=sys.stderr)
    urllib.request.urlretrieve(URL, RAW)


def majority(votes: list[int]) -> tuple[int | None, int]:
    """Return (winning_code, agreement) where agreement is the top vote count
    (3 = unanimous, 2 = majority). None if no code reaches 2."""
    c = collections.Counter(votes)
    code, n = c.most_common(1)[0]
    return (code, n) if n >= 2 else (None, n)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true")
    args = ap.parse_args()
    if args.download or not RAW.exists():
        download()

    by_cat: dict[str, list[dict]] = {}
    with RAW.open() as f:
        for row in csv.DictReader(f, delimiter="\t"):
            try:
                votes = [int(row["vote1"]), int(row["vote2"]), int(row["vote3"])]
            except (ValueError, KeyError):
                continue
            code, agree = majority(votes)
            if code is None or code not in NAME_BY_CODE:
                continue
            stmt = (row.get("statement") or "").strip()
            if not (40 <= len(stmt) <= 600):
                continue
            name = NAME_BY_CODE[code]
            by_cat.setdefault(name, []).append({
                "statement": stmt,
                "gold": name,
                "agreement": agree,          # 3 = unanimous, 2 = majority
                "title": row.get("entity_title", ""),
            })

    out: list[dict] = []
    for name, pool in sorted(by_cat.items()):
        # prefer unanimous items, then fill with majority; deterministic stride
        pool.sort(key=lambda r: (-r["agreement"], r["statement"]))
        stride = max(1, len(pool) // PER_CATEGORY)
        picked = pool[::stride][:PER_CATEGORY]
        for i, r in enumerate(picked):
            r["id"] = f"{name}_{i:02d}"
            out.append(r)

    OUT.write_text("\n".join(__import__("json").dumps(o, ensure_ascii=False) for o in out) + "\n")
    print(f"wrote {len(out)} items -> {OUT}")
    for name in sorted(by_cat):
        n = sum(1 for o in out if o["gold"] == name)
        u = sum(1 for o in out if o["gold"] == name and o["agreement"] == 3)
        print(f"  {name:<13} {n:>3}  (unanimous {u})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
