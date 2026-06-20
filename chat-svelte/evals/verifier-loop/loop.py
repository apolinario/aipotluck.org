"""Reusable EXTRACT -> DRAFT -> VERIFY -> REVISE loop (the #2 architecture).

Thesis carried from the pragmatics work: an 8B is a competent EXTRACTOR and a
poor JUDGE, and the win is removing the weak model's judgment from the path. For
CLOSED-form decisions a deterministic gate does that (see worldModel.ts). For
OPEN-form answers (riddles, premise-altered puzzles) you can't write a gate, so
the judge must be a model — and the architecture run showed the model-judge only
earns its cost when it's the STRONGER model. So the loop puts the cheap model on
extract+draft and a (configurable, default stronger) model on VERIFY:

  1. extract  (cheap)  — neutrally list the constraints any correct answer must respect
  2. draft    (cheap)  — answer the problem
  3. verify   (strong) — does the draft violate any extracted constraint? JSON verdict
  4. revise   (cheap)  — if violated, redraft given the specific violations; loop

Everything is model-agnostic (pass extract_model / draft_model / verify_model) so
the same harness measures 8B-verify vs 70B-verify — the core "expensive judge"
test — without code changes. Scoring is a pluggable deterministic grader per item
(no model-grading-model confound).

Reuses the cached CSCS client from the sibling pragmatics harness.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Reuse the sibling pragmatics harness's cached CSCS client (chat + model ids).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pragmatics"))
from cscs_client import chat, DEFAULT_MODEL  # noqa: E402

# The served cheap model is whatever APERTUS_MODEL points at; the strong verifier
# tier is a deliberately-larger open checkpoint (its own constant, same as the
# pragmatics ORACLE).
CHEAP_MODEL = DEFAULT_MODEL
STRONG_MODEL = "swiss-ai/Apertus-70B-Instruct-2509"


def _parse_json(text: str) -> dict:
    """First {...} block, tolerant of fences / trailing commas / single quotes."""
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return {}
    for cand in (m.group(0), re.sub(r",\s*}", "}", m.group(0)).replace("'", '"')):
        try:
            return json.loads(cand)
        except json.JSONDecodeError:
            continue
    return {}


# ── Stage prompts (general, domain-free) ────────────────────────────────────

EXTRACT_SYS = (
    "You analyse a problem to surface what any correct answer must respect. You do "
    "NOT answer the problem. List the concrete facts, constraints, and stated "
    "conditions exactly as given — especially ones that differ from the famous or "
    "expected version of a similar problem. Read literally; do not assume the "
    "standard puzzle. Output a short numbered list, nothing else."
)

DRAFT_SYS = (
    "Answer the user's problem directly and concisely. Read the problem literally; "
    "do not assume it is the standard version of a familiar puzzle."
)

VERIFY_SYS = (
    "You are a strict checker. You are given a PROBLEM, its CONSTRAINTS (facts the "
    "problem states), and a candidate ANSWER. Decide whether the answer is correct "
    "AND consistent with every constraint — paying special attention to constraints "
    "that differ from the famous version of a similar problem. Do not be charitable; "
    "if the answer ignores a stated constraint or solves a different (memorised) "
    "problem, it FAILS. Reply ONLY with JSON: "
    '{"ok": "yes|no", "violations": ["short specific reason", ...]}'
)

REVISE_SYS = (
    "Revise your answer to the problem so it respects every constraint and fixes the "
    "listed problems. Read the problem literally. Answer directly and concisely."
)


def extract(problem: str, *, model: str, use_cache: bool = True) -> str:
    return chat(
        [{"role": "system", "content": EXTRACT_SYS},
         {"role": "user", "content": f"Problem:\n{problem}"}],
        model=model, max_tokens=300, temperature=0, use_cache=use_cache,
    ).strip()


def draft(problem: str, *, model: str, use_cache: bool = True) -> str:
    return chat(
        [{"role": "system", "content": DRAFT_SYS},
         {"role": "user", "content": problem}],
        model=model, max_tokens=400, temperature=0, use_cache=use_cache,
    ).strip()


def verify(problem: str, constraints: str, answer: str, *, model: str,
           use_cache: bool = True) -> dict:
    raw = chat(
        [{"role": "system", "content": VERIFY_SYS},
         {"role": "user", "content":
             f"PROBLEM:\n{problem}\n\nCONSTRAINTS:\n{constraints}\n\nANSWER:\n{answer}"}],
        model=model, max_tokens=250, temperature=0, use_cache=use_cache,
    )
    v = _parse_json(raw)
    ok = str(v.get("ok", "")).strip().lower().startswith("y")
    viol = v.get("violations") or []
    if not isinstance(viol, list):
        viol = [str(viol)]
    return {"ok": ok, "violations": [str(x) for x in viol], "raw": raw}


def revise(problem: str, constraints: str, prev: str, violations: list[str], *,
           model: str, use_cache: bool = True) -> str:
    vlist = "\n".join(f"- {v}" for v in violations) or "- (unspecified)"
    return chat(
        [{"role": "system", "content": REVISE_SYS},
         {"role": "user", "content":
             f"Problem:\n{problem}\n\nConstraints to respect:\n{constraints}\n\n"
             f"Your previous answer:\n{prev}\n\nProblems to fix:\n{vlist}"}],
        model=model, max_tokens=400, temperature=0, use_cache=use_cache,
    ).strip()


def run_loop(problem: str, *, extract_model: str = CHEAP_MODEL,
             draft_model: str = CHEAP_MODEL, verify_model: str = STRONG_MODEL,
             max_rounds: int = 2, use_cache: bool = True) -> dict:
    """Full loop. Returns the final answer plus a trace of each round.

    max_rounds = number of verify/revise iterations after the first draft.
    Stops early as soon as verify says ok.
    """
    constraints = extract(problem, model=extract_model, use_cache=use_cache)
    answer = draft(problem, model=draft_model, use_cache=use_cache)
    trace = [{"stage": "draft", "answer": answer}]
    rounds = 0
    for _ in range(max_rounds):
        v = verify(problem, constraints, answer, model=verify_model, use_cache=use_cache)
        trace.append({"stage": "verify", "ok": v["ok"], "violations": v["violations"]})
        if v["ok"]:
            break
        rounds += 1
        answer = revise(problem, constraints, answer, v["violations"],
                        model=draft_model, use_cache=use_cache)
        trace.append({"stage": "revise", "answer": answer})
    return {"answer": answer, "constraints": constraints, "revise_rounds": rounds,
            "trace": trace}


def run_baseline(problem: str, *, model: str = CHEAP_MODEL,
                 use_cache: bool = True) -> dict:
    """Draft-only (no loop) — the reference the loop must beat."""
    return {"answer": draft(problem, model=model, use_cache=use_cache)}


# ── Delta-extract variant ───────────────────────────────────────────────────
# The mechanism trace showed the generic EXTRACT laundered the altered premise
# back to the famous puzzle, so the loop had no Archimedean point. The delta
# variant attacks THAT stage: instead of asking for generic "constraints", it
# forces the model to (a) name the canonical puzzle this resembles, (b) name
# what is DIFFERENT here, (c) decide whether the difference invalidates the
# canonical answer. That delta is then injected as an authoritative fact the
# drafter must respect — i.e. we manufacture the "elicited fact the generator
# DEFERS to" that the independence law says is required. No judge model; the
# only new signal is the explicit named difference.

DELTA_SYS = (
    "You are given a problem that MAY be a variant of a well-known puzzle with one "
    "or more details deliberately changed so the famous answer no longer applies. "
    "Do NOT solve it. Instead report, as strict JSON:\n"
    '{"canonical": "the famous puzzle this resembles, or null",\n'
    ' "canonical_answer": "the well-known answer to that famous version, or null",\n'
    ' "changes": ["each concrete detail here that DIFFERS from the famous version"],\n'
    ' "invalidates": "yes|no — do those changes make the famous answer wrong here?",\n'
    ' "why": "one sentence: what the changes force you to reconsider"}\n'
    "Read literally. If it matches no famous puzzle, canonical=null, changes=[], "
    "invalidates=\"no\". Output ONLY the JSON."
)


def delta_extract(problem: str, *, model: str, use_cache: bool = True) -> dict:
    raw = chat(
        [{"role": "system", "content": DELTA_SYS},
         {"role": "user", "content": f"Problem:\n{problem}"}],
        model=model, max_tokens=350, temperature=0, use_cache=use_cache,
    )
    d = _parse_json(raw)
    changes = d.get("changes") or []
    if not isinstance(changes, list):
        changes = [str(changes)]
    return {
        "canonical": d.get("canonical"),
        "canonical_answer": d.get("canonical_answer"),
        "changes": [str(c) for c in changes],
        "invalidates": str(d.get("invalidates", "")).strip().lower().startswith("y"),
        "why": str(d.get("why", "")).strip(),
        "raw": raw,
    }


def _delta_note(d: dict) -> str:
    """Render the delta as an authoritative fact block for the drafter."""
    if not d.get("canonical") or d.get("canonical") in ("null", "None"):
        return ""  # not a known puzzle — inject nothing, behave like baseline
    lines = [
        "IMPORTANT — this problem resembles a famous puzzle but has been changed. "
        "Do not give the famous puzzle's answer by reflex; reason from THESE facts:",
        f"- Famous puzzle it resembles: {d['canonical']}",
    ]
    if d.get("canonical_answer") and str(d["canonical_answer"]).lower() not in ("null", "none"):
        lines.append(
            f"- The famous version's answer ({d['canonical_answer']}) likely does "
            f"{'NOT ' if d['invalidates'] else ''}apply here."
        )
    for c in d["changes"]:
        lines.append(f"- Changed here: {c}")
    if d.get("why"):
        lines.append(f"- Therefore reconsider: {d['why']}")
    return "\n".join(lines)


def run_delta(problem: str, *, extract_model: str = CHEAP_MODEL,
              draft_model: str = CHEAP_MODEL, use_cache: bool = True) -> dict:
    """Delta-extract → inject-as-fact → draft once. No verify/revise, no judge.

    Tests whether naming the premise change (and making the drafter defer to it)
    rescues the recite class where generic extract+verify only churned.
    """
    d = delta_extract(problem, model=extract_model, use_cache=use_cache)
    note = _delta_note(d)
    if not note:
        answer = draft(problem, model=draft_model, use_cache=use_cache)
        return {"answer": answer, "delta": d, "injected": False}
    answer = chat(
        [{"role": "system", "content": DRAFT_SYS},
         {"role": "user", "content": f"{note}\n\n---\n\nProblem:\n{problem}"}],
        model=draft_model, max_tokens=400, temperature=0, use_cache=use_cache,
    ).strip()
    return {"answer": answer, "delta": d, "injected": True}


# ── Pluggable deterministic grader ──────────────────────────────────────────
# Each smoke item carries `accept` and/or `reject` regexes. PASS = an accept
# pattern matches AND no reject pattern matches. Deterministic, no model in the
# scoring loop.

def grade(answer: str, item: dict) -> bool:
    a = answer or ""
    acc = item.get("accept")
    rej = item.get("reject")
    if rej and re.search(rej, a, re.I | re.S):
        return False
    if acc and not re.search(acc, a, re.I | re.S):
        return False
    return True
