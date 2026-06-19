#!/usr/bin/env python3
"""Build the GSM-Symbolic probe set from Apple's released data.

Source: Mirzadeh et al. 2024, "GSM-Symbolic: Understanding the Limitations of
Mathematical Reasoning in LLMs" (arXiv:2410.05229). Data: HF apple/GSM-Symbolic
(main / p1 / p2), license CC-BY-NC-ND-4.0.

LICENSE NOTE: the data is non-commercial / NO-DERIVATIVES, so we do NOT commit
the questions/answers. This script fetches the raw jsonl into .cache (gitignored),
deterministically selects templates, and writes scenarios_gsm.jsonl ALSO into
.cache (gitignored). The only committed artifact is selected_templates.json — a
list of integer template ids — which is reproducible metadata, not the corpus.

Two probes from one sample:
  - variance   : N_INST instances of each template from `main` (only names/numbers
                 differ -> a robust solver should be stable across them)
  - difficulty : instance 0 of each template at main / p1 / p2 (added clauses)

Run:  python build_set.py            # uses cached jsonl
      python build_set.py --download  # fetch main/p1/p2 first
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
CACHE = HERE / ".cache"
OUT = CACHE / "scenarios_gsm.jsonl"          # gitignored (ND license)
MANIFEST = HERE / "selected_templates.json"  # committed (integer ids only)
BASE = "https://huggingface.co/datasets/apple/GSM-Symbolic/resolve/main"

N_TEMPLATES = 20
N_INST = 8   # main instances per template for the variance probe


def download() -> None:
    CACHE.mkdir(exist_ok=True)
    for c in ("main", "p1", "p2"):
        dst = CACHE / f"{c}.jsonl"
        print(f"downloading {c} -> {dst}", file=sys.stderr)
        urllib.request.urlretrieve(f"{BASE}/{c}/test.jsonl", dst)


def load(level: str) -> list[dict]:
    return [json.loads(l) for l in (CACHE / f"{level}.jsonl").read_text().splitlines() if l.strip()]


def gold_of(row: dict) -> str:
    """Final numeric answer after the '#### ' marker."""
    return row["answer"].split("####")[-1].strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true")
    args = ap.parse_args()
    if args.download or not (CACHE / "main.jsonl").exists():
        download()

    levels = {c: load(c) for c in ("main", "p1", "p2")}
    # templates present in all three levels, deterministic stride select
    shared = sorted(set.intersection(*({r["original_id"] for r in levels[c]} for c in levels)))
    stride = max(1, len(shared) // N_TEMPLATES)
    picked = shared[::stride][:N_TEMPLATES]
    MANIFEST.write_text(json.dumps(picked))

    # index: (level, template_id) -> instances sorted by instance number
    idx: dict[tuple[str, int], list[dict]] = {}
    for c, rows in levels.items():
        for r in rows:
            idx.setdefault((c, r["original_id"]), []).append(r)
    for v in idx.values():
        v.sort(key=lambda r: r["instance"])

    out: list[dict] = []
    for t in picked:
        # variance: N_INST main instances
        for r in idx[("main", t)][:N_INST]:
            out.append({"id": f"var_{t}_{r['instance']}", "probe": "variance",
                        "template_id": t, "level": "main", "instance": r["instance"],
                        "question": r["question"], "gold": gold_of(r)})
        # difficulty: instance 0 at each level
        for c in ("main", "p1", "p2"):
            r = idx[(c, t)][0]
            out.append({"id": f"diff_{t}_{c}", "probe": "difficulty",
                        "template_id": t, "level": c, "instance": r["instance"],
                        "question": r["question"], "gold": gold_of(r)})

    OUT.write_text("\n".join(json.dumps(o, ensure_ascii=False) for o in out) + "\n")
    print(f"wrote {len(out)} items -> {OUT}  ({len(picked)} templates)")
    for p in ("variance", "difficulty"):
        print(f"  {p:<11} {sum(1 for o in out if o['probe']==p)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
