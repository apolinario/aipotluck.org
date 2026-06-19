"""Citation-reason classification conditions for the served open 8B model.

Task: given a Wikipedia statement that needs a citation, pick WHY (one of the 8
Redi-taxonomy reason categories). On-mission for a provenance product: knowing a
claim is opinion vs scientific vs statistic is what decides whether to attribute,
retrieve-and-cite, or hedge.

Two conditions test whether the model holds the provenance taxonomy latently or
needs the codebook handed to it:
  F_names : category NAMES only
  F_defs  : names + definitions (the rubric spelled out)

The taxonomy is the label space (legitimate to provide); no per-item world
knowledge is injected. The model maps statement -> category itself.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Reuse the pragmatics harness's CSCS client (one client, one cache, one key).
# Resolve the sibling harness dir under either of its known names.
_SIB = next((Path(__file__).parent.parent / n
             for n in ("pragmatics-harness", "pragmatics")
             if (Path(__file__).parent.parent / n / "cscs_client.py").exists()), None)
if _SIB is None:
    raise RuntimeError("cannot find sibling pragmatics harness with cscs_client.py")
sys.path.insert(0, str(_SIB))
from cscs_client import chat, DEFAULT_MODEL  # noqa: E402

from taxonomy import names_block, NAMES  # noqa: E402

_PROMPT = (
    "Below is a statement from a Wikipedia article that requires an inline "
    "citation. Classify the single MAIN reason it needs a citation, choosing "
    "exactly one category from this list:\n\n{cats}\n\n"
    "Statement:\n\"{stmt}\"\n\n"
    "Answer with exactly one category name from the list above and nothing else."
)


def _classify(stmt: str, *, with_defs: bool, **kw) -> dict:
    msg = [{"role": "user",
            "content": _PROMPT.format(cats=names_block(with_defs), stmt=stmt)}]
    raw = chat(msg, temperature=0.0, max_tokens=24, **kw)
    return {"pred": extract_category(raw), "raw": raw}


def extract_category(text: str) -> str | None:
    """Map free text to one of the 8 category names. Tolerant of spaces vs
    underscores and of the model echoing extra words; takes the last name hit
    (its final committed pick)."""
    if not text:
        return None
    t = text.strip().lower().replace(" ", "_")
    hits = [n for n in NAMES if n in t]
    if not hits:
        # also try space form for private life
        t2 = text.strip().lower()
        hits = [n for n in NAMES if n.replace("_", " ") in t2]
    return hits[-1] if hits else None


def cond_names(stmt: str, **kw) -> dict:
    return _classify(stmt, with_defs=False, **kw)


def cond_defs(stmt: str, **kw) -> dict:
    return _classify(stmt, with_defs=True, **kw)


CONDITIONS = {
    "F_names": cond_names,
    "F_defs": cond_defs,
}
