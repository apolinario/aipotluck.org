"""Conversational-implicature conditions for Apertus (the production 8B).

Task: given a context question and an INDIRECT response, does it implicate Yes or
No? (e.g. "Is Marci grumpy?" / "he's as gentle as a lamb" -> No.) This is the
over-literal-chat failure: a model that takes the response literally misses the
implicature. Ruis et al. 2022 (arXiv:2210.14986) found base LLMs near chance
zero-shot, with few-shot examples closing much of the gap -> so the central
on-mission axis is zero-shot vs few-shot.

All inference is the model's; Python only reads off 'yes'/'no'. Few-shot
exemplars come from the DEV split (no test leakage).
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

# Reuse the pragmatics harness's CSCS client.
_SIB = next((Path(__file__).parent.parent / n
             for n in ("pragmatics-harness", "pragmatics")
             if (Path(__file__).parent.parent / n / "cscs_client.py").exists()), None)
if _SIB is None:
    raise RuntimeError("cannot find sibling pragmatics harness with cscs_client.py")
sys.path.insert(0, str(_SIB))
from cscs_client import chat, DEFAULT_MODEL  # noqa: E402

_CACHE = Path(__file__).parent / ".cache"

_INSTR = ("Decide what the response IMPLIES — yes or no — given the question. "
          "People often answer indirectly; infer the intended meaning, do not take "
          "the words literally.")


def _fmt(ctx: str, resp: str) -> str:
    return f"Question: {ctx}\nResponse: {resp}\nImplied answer (yes or no):"


def _polarity(impl: str) -> str | None:
    w = impl.strip().lower().lstrip(".").strip()
    return "yes" if w.startswith("yes") else ("no" if w.startswith("no") else None)


def _load_exemplars(k_each: int = 3) -> list[tuple[str, str, str]]:
    """k_each yes + k_each no from the dev split, deterministic (first found)."""
    yes, no = [], []
    with (_CACHE / "dev.csv").open() as f:
        for r in csv.DictReader(f):
            ctx = (r.get("Context utterance") or "").strip()
            resp = (r.get("Response utterance") or "").strip()
            g = _polarity(r.get("Implicature", ""))
            if not (ctx and resp and g):
                continue
            (yes if g == "yes" else no).append((ctx, resp, g))
    out = []
    for i in range(k_each):
        if i < len(yes):
            out.append(yes[i])
        if i < len(no):
            out.append(no[i])
    return out


def extract_yesno(text: str) -> str | None:
    t = (text or "").strip().lower()
    # first explicit yes/no token
    for tok in t.replace("'", " ").replace('"', " ").split():
        tok = tok.strip(".,:;!?-")
        if tok in ("yes", "no"):
            return tok
    if t.startswith("yes"):
        return "yes"
    if t.startswith("no"):
        return "no"
    return None


def _ask(ctx: str, resp: str, *, fewshot: bool, **kw) -> dict:
    parts = [_INSTR, ""]
    if fewshot:
        for ec, er, eg in _load_exemplars():
            parts.append(_fmt(ec, er) + f" {eg}")
            parts.append("")
    parts.append(_fmt(ctx, resp))
    out = chat([{"role": "user", "content": "\n".join(parts)}],
               temperature=0.0, max_tokens=8, **kw)
    return {"pred": extract_yesno(out), "raw": out}


def cond_zeroshot(ctx: str, resp: str, **kw) -> dict:
    return _ask(ctx, resp, fewshot=False, **kw)


def cond_fewshot(ctx: str, resp: str, **kw) -> dict:
    return _ask(ctx, resp, fewshot=True, **kw)


CONDITIONS = {
    "A_zeroshot": cond_zeroshot,
    "B_fewshot": cond_fewshot,
}
