"""GSM-Symbolic solving + numeric grading for the served open 8B model.

One condition (solve the word problem with chain-of-thought). The interesting
structure is in the SCORING (run.py): the same model is probed for
  - variance  : stability across instances of one template (names/numbers change,
                difficulty does not) -- a robust solver should not swing
  - difficulty: accuracy as clauses are added (main -> p1 -> p2)

All reasoning is the model's; Python only extracts the final number and compares
it to the released gold. No math is done in Python.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Reuse the pragmatics harness's CSCS client (resolve the sibling harness dir
# under either of its known names).
_SIB = next((Path(__file__).parent.parent / n
             for n in ("pragmatics-harness", "pragmatics")
             if (Path(__file__).parent.parent / n / "cscs_client.py").exists()), None)
if _SIB is None:
    raise RuntimeError("cannot find sibling pragmatics harness with cscs_client.py")
sys.path.insert(0, str(_SIB))
from cscs_client import chat, DEFAULT_MODEL  # noqa: E402

_PROMPT = (
    "Solve this math word problem. Show your reasoning step by step, then on the "
    "last line write the final numeric answer in the form '#### <number>'.\n\n{q}"
)

_NUM = re.compile(r"-?\d[\d,]*\.?\d*")


def _to_float(s: str) -> float | None:
    s = s.replace(",", "").replace("$", "").replace("%", "").strip().rstrip(".")
    try:
        return float(s)
    except ValueError:
        return None


def extract_answer(text: str) -> float | None:
    """Final number: prefer the value after the last '####', else the last number."""
    if not text:
        return None
    if "####" in text:
        tail = text.split("####")[-1]
        m = _NUM.search(tail)
        if m:
            return _to_float(m.group())
    nums = _NUM.findall(text)
    return _to_float(nums[-1]) if nums else None


def is_correct(pred: float | None, gold: str) -> bool:
    g = _to_float(gold)
    if pred is None or g is None:
        return False
    return abs(pred - g) < 1e-4 * max(1.0, abs(g))


def cond_solve(question: str, **kw) -> dict:
    raw = chat([{"role": "user", "content": _PROMPT.format(q=question)}],
               temperature=0.0, max_tokens=768, **kw)
    return {"pred": extract_answer(raw), "raw": raw}


CONDITIONS = {"A_solve": cond_solve}
