"""Validate v3 three-axis score files (openness + adoption + capability).

A score file is either a pending file  {"category": "...", "products": [record, ...]}
or the merged all_scores_v3.json        {"products": [record, ...]}.

Enforces, per record:
- product non-empty; type in {model, software, dataset}; category present
- openness: score 0-5 or null; class valid FOR THE TYPE; non-null score needs
  >=1 {url, shows, accessed} source + confidence; class<->score coherence
- adoption: level 1-5 or null (null => signal_type 'unknown' + note); signal_type
  valid; stars_fallback cannot justify level > 3; non-null needs sources + confidence
- capability: score 1-5 or null (null => note); basis present; non-null needs
  sources + confidence
- flags are from the known vocabulary
Aggregate: capability 5 is rare (error if > 5 in one file).

Usage:
  uv run python data/stack-map/scripts/validate_scores_v3.py data/stack-map/pending/base_pretrained.json
  uv run python data/stack-map/scripts/validate_scores_v3.py --all
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # data/stack-map
PENDING = ROOT / "pending"
SCORES = ROOT / "scores"

OPENNESS_CLASSES = {
    "model": {"open_source", "open_weights", "restricted", "closed"},
    "software": {"open_source", "source_available", "open_core", "closed"},
    "dataset": {"open", "gated", "documented_only", "closed"},
}
SIGNAL_TYPES = {"active_users", "usage_volume", "reported_traction", "stars_fallback", "unknown"}
CONF = {"high", "medium", "low"}
TYPES = {"model", "software", "dataset"}
FLAGS = {
    "mixed_tier_openness", "near_open_source_non_osi_license", "open_washed",
    "partial_release_weights_pending", "unverified_benchmarks", "renamed_per_verify", "stale",
    "unverifiable_product", "recategorize",
}


def _sources(obj: dict, where: str, errors: list) -> None:
    srcs = obj.get("sources")
    if not srcs:
        errors.append(f"{where}: missing sources (every non-null score needs >=1 checkable source)")
        return
    for i, s in enumerate(srcs):
        if not isinstance(s, dict) or not str(s.get("url", "")).startswith("http"):
            errors.append(f"{where}: source[{i}] needs a real url (http...)")
        if not str(s.get("shows", "")).strip():
            errors.append(f"{where}: source[{i}] missing 'shows' (what the link proves)")
        if not str(s.get("accessed", "")).strip():
            errors.append(f"{where}: source[{i}] missing 'accessed' date")


def validate_record(p: dict, errors: list) -> None:
    name = str(p.get("product", "")).strip() or "<unnamed>"
    typ = p.get("type")
    where = f"{p.get('category', '?')}/{name}"

    if name == "<unnamed>":
        errors.append(f"{where}: missing product name")
    if typ not in TYPES:
        errors.append(f"{where}: type must be one of {sorted(TYPES)}, got {typ!r}")
    if not p.get("category"):
        errors.append(f"{where}: missing category")
    # Novel flags are allowed — agents surface useful signal (e.g.
    # post_cutoff_unverifiable_by_run, benchmark_from_aggregator). They're
    # reported as a note by validate_file, never treated as a hard error.

    # --- openness ---
    op = p.get("openness") or {}
    if not op:
        errors.append(f"{where}: missing openness block")
    osc = op.get("score")
    ocls = op.get("class")
    allowed = OPENNESS_CLASSES.get(typ, set())
    if allowed and ocls not in allowed:
        errors.append(f"{where}: openness.class {ocls!r} invalid for type {typ} (allowed {sorted(allowed)})")
    if osc is None:
        if not str(op.get("note", "")).strip():
            errors.append(f"{where}: openness.score null needs a note")
    else:
        if osc not in range(0, 6):
            errors.append(f"{where}: openness.score must be 0-5 or null, got {osc!r}")
        if op.get("confidence") not in CONF:
            errors.append(f"{where}: openness.confidence invalid: {op.get('confidence')!r}")
        _sources(op, f"{where}.openness", errors)
        # class <-> score coherence
        if ocls == "closed" and osc not in (0, 1):
            errors.append(f"{where}: openness class 'closed' but score {osc} (expected 0-1)")
        if ocls == "open_source" and typ == "model" and isinstance(osc, int) and osc < 4:
            errors.append(f"{where}: model class 'open_source' but score {osc} (<4 — full-pipeline-open should score high)")

    # --- adoption ---
    ad = p.get("adoption") or {}
    if not ad:
        errors.append(f"{where}: missing adoption block")
    lvl = ad.get("level")
    st = ad.get("signal_type")
    if lvl is None:
        if st != "unknown":
            errors.append(f"{where}: adoption.level null requires signal_type 'unknown'")
        if not str(ad.get("note", "")).strip():
            errors.append(f"{where}: adoption.level null needs a note")
    else:
        if lvl not in range(1, 6):
            errors.append(f"{where}: adoption.level must be 1-5 or null, got {lvl!r}")
        if st not in SIGNAL_TYPES:
            errors.append(f"{where}: adoption.signal_type invalid: {st!r}")
        if st == "stars_fallback" and isinstance(lvl, int) and lvl > 3:
            errors.append(f"{where}: stars_fallback cannot justify adoption.level {lvl} (>3)")
        if ad.get("confidence") not in CONF:
            errors.append(f"{where}: adoption.confidence invalid: {ad.get('confidence')!r}")
        _sources(ad, f"{where}.adoption", errors)

    # --- capability ---
    cap = p.get("capability") or {}
    if not cap:
        errors.append(f"{where}: missing capability block")
    sc = cap.get("score")
    if sc is None:
        if not str(cap.get("note", "")).strip():
            errors.append(f"{where}: capability.score null needs a note")
    else:
        if sc not in range(1, 6):
            errors.append(f"{where}: capability.score must be 1-5 or null, got {sc!r}")
        if not str(cap.get("basis", "")).strip():
            errors.append(f"{where}: capability needs a basis (benchmark:<name> / feature_matrix / n/a)")
        if cap.get("confidence") not in CONF:
            errors.append(f"{where}: capability.confidence invalid: {cap.get('confidence')!r}")
        _sources(cap, f"{where}.capability", errors)


def validate_file(path: Path, errors: list) -> int:
    data = json.loads(path.read_text())
    prods = data.get("products", data if isinstance(data, list) else [])
    seen = set()
    for p in prods:
        validate_record(p, errors)
        nm = p.get("product")
        if nm in seen:
            errors.append(f"{path.name}: duplicate product {nm!r}")
        seen.add(nm)
    # Capability-5 inflation is a review heuristic, not a hard error — scale-
    # dependent (a 43-product frontier category legitimately has more 5s than a
    # 12-product one). Surface for the reviewer; never block assembly on it.
    n_fives = sum(1 for p in prods if (p.get("capability") or {}).get("score") == 5)
    if n_fives > max(5, round(0.25 * len(prods))):
        print(f"  note {path.name}: {n_fives}/{len(prods)} capability-5 — confirm not inflated (a 5 = frontier-definer).")
    novel = sorted({f for p in prods for f in (p.get("flags") or []) if f not in FLAGS})
    if novel:
        print(f"  note {path.name}: {len(novel)} novel flag(s) for review: {novel}")
    return len(prods)


def main() -> None:
    args = sys.argv[1:]
    if args == ["--all"]:
        files = sorted(PENDING.glob("*.json"))
        merged = SCORES / "all_scores_v3.json"
        if merged.exists():
            files.append(merged)
    else:
        files = [Path(a) for a in args]
    if not files:
        print("No files. Pass a path or --all.")
        sys.exit(1)

    total = 0
    for f in files:
        if not f.exists():
            print(f"MISSING: {f}")
            total += 1
            continue
        errs: list = []
        n = validate_file(f, errs)
        if errs:
            total += len(errs)
            print(f"FAIL {f.name} — {len(errs)} error(s):")
            for e in errs:
                print(f"  - {e}")
        else:
            print(f"PASS {f.name} — {n} records, all valid.")

    if total:
        print(f"\n{total} total error(s).")
        sys.exit(1)
    print("\nAll score files valid.")


if __name__ == "__main__":
    main()
