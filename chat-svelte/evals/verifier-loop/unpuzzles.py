"""UNPUZZLES loader + deterministic grader for the verifier loop.

An UNPUZZLE is a classic puzzle with one premise quietly changed so the famous
answer no longer applies (e.g. Monty Hall where the host opens a door at random,
or a "label machine" that may or may not mislabel). The failure mode we probe:
the model pattern-matches the famous puzzle and RECITES its memorised answer
instead of reasoning over the altered premise — the same Einstellung/heuristic-
override class as the car-wash trap, but open-form (no deterministic gate
possible), so the JUDGE must be a model. That makes this the discriminating set
for the strong-vs-cheap verifier question.

We restrict to the cleanly-gradeable, discriminating slice: items whose
`unpuzzle_answer` AND `original_answer` are both yes/no OR both pure integers,
and DIFFER (so reciting the famous answer is detectably wrong). ~50 items.

Grading is deterministic and model-free: each problem is posed with a forced
"FINAL: <answer>" line; we parse that line and compare to the gold. We also
record whether the final answer equals the TRAP (the original puzzle's answer)
— the recite-rate, which directly measures the heuristic-override effect.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data" / "unpuzzles.json"

# Appended to every problem so the model emits a parseable verdict. Kept neutral
# ("answer the question as asked") — it must NOT hint that the premise changed,
# or we'd be doing the model's reasoning for it.
FINAL_DIRECTIVE = (
    "\n\nAnswer the question exactly as asked. Reason briefly, then end with a "
    "single line in the form:\nFINAL: <your answer>"
)


def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


def _is_yn(s: str | None) -> bool:
    return _norm(s) in ("yes", "no")


def _is_int(s: str | None) -> bool:
    return _norm(s).lstrip("-").isdigit()


def load_items() -> list[dict]:
    """Load the cleanly-gradeable, discriminating UNPUZZLE slice.

    Each returned item: {id, problem, gold, trap, kind} where problem already
    carries the FINAL directive, kind in {"yn","int"}, gold = correct unpuzzle
    answer, trap = the original puzzle's (now-wrong) answer.
    """
    if not DATA.exists():
        raise SystemExit(
            f"missing {DATA} — run ./fetch_unpuzzles.sh first (see ATTRIBUTION.md)"
        )
    raw = json.loads(DATA.read_text())
    items: list[dict] = []
    for i, e in enumerate(raw):
        gold, trap = e.get("unpuzzle_answer"), e.get("original_answer")
        if _norm(gold) == _norm(trap) or not _norm(gold):
            continue  # not discriminating
        if _is_yn(gold) and _is_yn(trap):
            kind = "yn"
        elif _is_int(gold) and _is_int(trap):
            kind = "int"
        else:
            continue  # not cleanly gradeable
        items.append({
            "id": f"{i:02d}_" + re.sub(r"\W+", "_", e["puzzle_name"]).strip("_").lower(),
            "problem": e["unpuzzle"].strip() + FINAL_DIRECTIVE,
            "canonical": (e.get("original_puzzle") or "").strip(),  # the famous version
            "gold": _norm(gold),
            "trap": _norm(trap),
            "kind": kind,
            "puzzle_name": e["puzzle_name"],
        })
    return items


# ── deterministic grader ─────────────────────────────────────────────────────

def _final_line(answer: str) -> str:
    """The text after the last 'FINAL:' marker, else the last non-empty line."""
    hits = re.findall(r"final\s*:\s*(.+)", answer or "", re.I)
    if hits:
        return hits[-1].strip()
    lines = [l.strip() for l in (answer or "").splitlines() if l.strip()]
    return lines[-1] if lines else ""


def _yn_token(text: str) -> str | None:
    m = re.search(r"\b(yes|no)\b", text, re.I)
    return m.group(1).lower() if m else None


def _first_int(text: str) -> str | None:
    m = re.search(r"-?\d+", text)
    return m.group(0) if m else None


def classify(answer: str, item: dict) -> str:
    """Return 'gold' (correct), 'trap' (recited the famous answer), or 'other'."""
    fin = _final_line(answer)
    if item["kind"] == "yn":
        tok = _yn_token(fin)
        if tok is None:
            return "other"
        if tok == item["gold"]:
            return "gold"
        if tok == item["trap"]:
            return "trap"
        return "other"
    # int
    num = _first_int(fin)
    if num is None:
        return "other"
    if num == item["gold"].lstrip("+"):
        return "gold"
    if num == item["trap"].lstrip("+"):
        return "trap"
    return "other"


def grade(answer: str, item: dict) -> bool:
    """PASS iff the model's FINAL answer equals the gold unpuzzle answer."""
    return classify(answer, item) == "gold"
