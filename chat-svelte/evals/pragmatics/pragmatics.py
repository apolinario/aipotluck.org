"""Three conditions for the walk-or-drive pragmatic-trap eval.

A  baseline   : raw single-shot, zero-shot.
B  cot        : "think step by step" — the generic baseline to beat.
C  hybrid     : decompose the implicit inference into explicit factual
                sub-questions (each below the model's competence threshold),
                synthesize a constraint deterministically, then let the model
                give a final answer that is GATED by that constraint.

The design bet of C: "should I walk or drive?" fails because purpose-inference
is above an 8B's threshold. But "what does a car wash do, and to what object?"
is a factual lookup it can do. We never ask the model to make the leap; we ask
it the easy pieces and assemble the leap in Python.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from cscs_client import chat, DEFAULT_MODEL

# ---------------------------------------------------------------------------
# Answer extraction: every condition must reduce to walk | drive.
# ---------------------------------------------------------------------------

def classify_answer(text: str) -> str:
    """Map free-text to 'walk' | 'drive' | 'unclear' using first decisive token."""
    t = text.lower()
    # Look for the first standalone occurrence of either verb.
    walk = re.search(r"\bwalk(?:ing|s)?\b", t)
    drive = re.search(r"\bdriv(?:e|ing|es)?\b", t)
    # Also honor explicit "take the car" / "bring the car".
    car = re.search(r"\b(take|bring|use)\b[^.]{0,20}\bcar\b", t)
    if car and (not walk or car.start() < walk.start()):
        return "drive"
    if walk and drive:
        return "walk" if walk.start() < drive.start() else "drive"
    if walk:
        return "walk"
    if drive:
        return "drive"
    return "unclear"


# ---------------------------------------------------------------------------
# A — baseline
# ---------------------------------------------------------------------------

def cond_baseline(scenario: str, **kw) -> dict:
    out = chat(
        [{"role": "user", "content": scenario}],
        max_tokens=256,
        **kw,
    )
    return {"answer": classify_answer(out), "calls": 1, "raw": {"reply": out}}


# ---------------------------------------------------------------------------
# B — chain of thought
# ---------------------------------------------------------------------------

COT_SUFFIX = (
    "\n\nThink step by step about the PURPOSE of the trip and what must travel "
    "with you, then end with a single final line: 'ANSWER: walk' or 'ANSWER: drive'."
)

def cond_cot(scenario: str, **kw) -> dict:
    out = chat(
        [{"role": "user", "content": scenario + COT_SUFFIX}],
        max_tokens=512,
        **kw,
    )
    m = re.search(r"answer:\s*(walk|drive)", out, re.I)
    ans = m.group(1).lower() if m else classify_answer(out)
    return {"answer": ans, "calls": 1, "raw": {"reply": out}}


# ---------------------------------------------------------------------------
# C — simulate-then-gate  (the decompose trick, WITHOUT hardcoding the answer)
#
# Lineage from the 2024-2026 lit review (see README):
#   FaR / Foresee-and-Reflect (arXiv:2310.03051) — force the model to state an
#     action's consequences BEFORE choosing; lifted GPT-4 action-selection 50->71%.
#   WebDreamer (arXiv:2411.06559) — LLM as world model simulates each candidate
#     option's outcome, then pick the best; no tree search; works at 7B.
#   LLM-Modulo (arXiv:2402.01817) + Small-Models-Need-Strong-Verifiers
#     (arXiv:2404.17140) — model PROPOSES, an external/deterministic check
#     DISPOSES. A deterministic rule is the strongest possible verifier and
#     sidesteps "LLMs Cannot Self-Correct Reasoning Yet" (2310.01798), which is
#     scoped ONLY to intrinsic (no-external-feedback) self-correction.
#
# The key difference from the rejected v1: there are NO hand-coded domain facts
# (no "car wash -> vehicle -> drive" rules). The world knowledge lives entirely
# in the model's simulation. Python contributes exactly ONE domain-agnostic
# rule: prefer the cheaper option (walk) unless the simulation says it fails the
# goal. That rule works for any "do X or Y to accomplish Z" question.
# ---------------------------------------------------------------------------

GOAL_SYS = (
    "Restate the person's underlying goal in one short sentence: what they are "
    "trying to accomplish, NOT how they travel. No advice, no walk/drive opinion."
)

# Note: the simulation is deliberately blind to any proposed answer (CoVe's
# independence insight, 2309.11495) so it cannot rationalize a guess.
SIM_USER = """A person is deciding how to make a short trip. The two options are WALK or DRIVE.
Their goal: {goal}
Scenario: {scenario}

Imagine EACH option concretely and honestly, then judge it. Do not pick a
winner — just simulate both. Return only JSON, no prose:
{{"walk":  {{"arrive_with": "what they physically have on arrival", "achieves_goal": "yes|no", "why": "one short clause"}},
  "drive": {{"arrive_with": "what they physically have on arrival", "achieves_goal": "yes|no", "why": "one short clause"}}}}"""


def _parse_json(text: str) -> dict:
    # Grab the first {...} block; models sometimes wrap it in prose/fences.
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        # tolerate trailing commas / single quotes minimally
        cleaned = re.sub(r",\s*}", "}", m.group(0)).replace("'", '"')
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {}


def _achieves(sim: dict, option: str) -> bool:
    node = sim.get(option, {}) if isinstance(sim, dict) else {}
    return str(node.get("achieves_goal", "")).strip().lower().startswith("y")


def cond_hybrid(scenario: str, *, return_trace: bool = False, **kw) -> dict:
    # Step 1 — extract the underlying goal (a sub-question below threshold).
    goal = chat(
        [{"role": "system", "content": GOAL_SYS}, {"role": "user", "content": scenario}],
        max_tokens=80,
        **kw,
    ).strip()

    # Step 2 — forward-simulate BOTH options, independent of any answer (FaR + CoVe).
    raw_sim = chat(
        [{"role": "user", "content": SIM_USER.format(goal=goal, scenario=scenario)}],
        max_tokens=400,
        **kw,
    )
    sim = _parse_json(raw_sim)
    walk_ok = _achieves(sim, "walk")
    drive_ok = _achieves(sim, "drive")

    # Step 3 — domain-agnostic gate: cheapest option that achieves the goal.
    # The ONLY rule. No domain facts. Prefer walk unless its simulation fails.
    if walk_ok:
        answer = "walk"
    elif drive_ok:
        answer = "drive"
    else:
        # Simulation says neither achieves the goal -> default to the
        # capability-bearing option but flag low confidence for review.
        answer = "drive"

    result = {
        "answer": answer,
        "goal": goal,
        "walk_ok": walk_ok,
        "drive_ok": drive_ok,
        "low_confidence": not (walk_ok or drive_ok),
        "calls": 2,
        "sim": sim,
    }
    if return_trace:
        result["raw"] = {"goal": goal, "sim": raw_sim}
    return result


# ---------------------------------------------------------------------------
# D — distance-occluded simulate-then-gate
#
# Diagnostic from the live run: the distance cue ("100m away") hijacks BOTH the
# goal extraction and the simulation (HOB's causal-occlusion finding: distance
# pulls 8.7-38x harder than the goal). So before simulating, strip the distance.
# This is HOB's own occlusion method applied as a mitigation.
#
# Expectation (the bifurcation hypothesis): occlusion RECOVERS the physical-
# capacity traps (heavy_box, fridge, bulky drop-offs) because the 8B *has* that
# capability once the heuristic hook is gone — but it does NOT recover the
# object-co-presence traps (car wash, gas, inspection), because the 8B lacks
# that world-model primitive even when asked the crux question distance-free.
# ---------------------------------------------------------------------------

# matches "100m", "200 m", "150 meters", "0.2 km", optional "only/just" + trailing
# "away / down the road / from my house"
_DIST_RE = re.compile(
    r"\b(only |just )?\d+(\.\d+)?\s?(m|km|meters?|metres?|kilom\w*)\b"
    r"( away| down the road| from (my|the) (house|home))?",
    re.I,
)


def occlude_distance(scenario: str) -> str:
    return _DIST_RE.sub("nearby", scenario)


def cond_hybrid_occluded(scenario: str, **kw) -> dict:
    res = cond_hybrid(occlude_distance(scenario), **kw)
    res["occluded_scenario"] = occlude_distance(scenario)
    return res


# ---------------------------------------------------------------------------
# E — neutral pre-prompt reframe  (the "DSPy-esque" structure, done by hand)
#
# Fixes the LEADING reframe that turned the 8B into a yes-machine: the decompose
# questions are NEUTRAL (no "e.g. the car is being serviced" hints). The model
# supplies the world-facts; Python does ONE domain-agnostic composition (an AND
# over model-supplied booleans). This is LLM-Modulo, not the rejected v1 rule
# engine — there are no hand-coded domain facts (no "car wash -> vehicle").
#
# Covers two trap structures: object-co-presence (car wash, gas, inspection) and
# bring-an-unportable-load (heavy box). It does NOT cover return-payload (buy a
# fridge, carry it home) — that needs a separate question; left out on purpose
# so the limit is visible rather than papered over.
# ---------------------------------------------------------------------------

REFRAME_SYS = (
    "You extract neutral facts about a situation as JSON. You do NOT give travel "
    "advice and you do NOT decide walk vs drive. Answer only the JSON object."
)

REFRAME_USER = """Situation: {scenario}

Answer as JSON with exactly these keys (short factual answers):
- "purpose": in one phrase, what is the person trying to accomplish?
- "central_thing": the single object or being the purpose is mainly performed on or about
- "needs_to_be_present": for the purpose to succeed, must central_thing be physically at the destination? "yes" or "no"
- "location_before_trip": where central_thing is before the trip — "at_destination" or "with_person"
- "hand_portable": can one ordinary person carry central_thing by hand on foot the whole way? "yes" or "no"
- "leaves_with_unportable": will the person leave the destination carrying something too big or heavy to carry by hand all the way home? "yes" or "no"
- "companion_can_walk": is central_thing a person or animal that can walk the distance on its own legs (NOT an object, and NOT a vehicle the person drives)? "yes" or "no"

Return only the JSON object."""

# companion_can_walk (animacy): stops the gate treating a walkable dog/kid as an
# uncarryable payload. KEPT. On the TEMPLATED set it looked like a regression for
# the single 8B (-2, perturbed extraction) — but that harm was itself a template
# artifact: on the trustworthy NATURAL set it is a net +2 (57->59/65), fixing the
# dog-vet/groomer false-flips (co_participant 7/9->9/9) with no trap-recall cost.
# A clean case of the natural set overturning a templated-set conclusion.


def reframe_gate(f: dict) -> bool:
    """Domain-agnostic gate over model-supplied facts (only ORs/ANDs, no domain
    knowledge). Returns requires_vehicle.
      (a) you must BRING an unportable thing that must be present, OR
      (b) you LEAVE with an unportable load (return-payload).
    """
    def yes(k):
        return str(f.get(k, "")).strip().lower().startswith("y")
    with_person = "with_person" in str(f.get("location_before_trip", "")).lower()
    companion_can_walk = yes("companion_can_walk")
    bring_unportable = (
        yes("needs_to_be_present") and with_person and not yes("hand_portable")
        and not companion_can_walk
    )
    leaves_unportable = yes("leaves_with_unportable") and not companion_can_walk
    return bring_unportable or leaves_unportable


def _do_reframe(scenario: str, *, model: str | None = None, use_cache: bool = True) -> tuple[dict, str]:
    mkw = {"model": model} if model else {}
    raw = chat(
        [
            {"role": "system", "content": REFRAME_SYS},
            {"role": "user", "content": REFRAME_USER.format(scenario=occlude_distance(scenario))},
        ],
        max_tokens=200,
        use_cache=use_cache,
        **mkw,
    )
    return _parse_json(raw), raw


def cond_reframe(scenario: str, *, return_trace: bool = False, **kw) -> dict:
    f, raw = _do_reframe(scenario, **kw)
    requires_vehicle = reframe_gate(f)
    result = {"answer": "drive" if requires_vehicle else "walk", "facts": f,
              "requires_vehicle": requires_vehicle, "calls": 1}
    if return_trace:
        result["raw"] = {"reframe": raw}
    return result


# ---------------------------------------------------------------------------
# E2 — TIERED: a 70B oracle does the reframe; the cheap 8B does the answer.
#
# Product question: can an 8B-served chat model inherit 70B-quality co-presence
# handling for one extra oracle call? Reports BOTH:
#   - tier_a (answer): the 8B's natural-language decision given the oracle facts
#                      (does the 8B USE supplied world-facts it can't generate?)
#   - tier_b (gate_answer): the deterministic gate over those same facts
#                      (the 8B only phrases the decision)
# Their agreement tells you whether you can trust the 8B to read the facts, or
# whether you must let the gate override it.
# ---------------------------------------------------------------------------

# The oracle tier is a deliberately-larger model (its own constant). The cheap
# "chat" tier is whatever is actually being served — so it follows APERTUS_MODEL
# (DEFAULT_MODEL) rather than a second hardcoded id / parallel env var.
ORACLE_70B = "swiss-ai/Apertus-70B-Instruct-2509"
CHAT_8B = DEFAULT_MODEL

TIERED_ANSWER_USER = """{scenario}

Established facts about this situation:
{facts}

Using these facts, should the person walk or drive? One sentence, then end with
a line exactly 'ANSWER: walk' or 'ANSWER: drive'."""


def cond_tiered(scenario, *, oracle_model=ORACLE_70B, answer_model=CHAT_8B,
                return_trace=False, use_cache=True):
    f, raw = _do_reframe(scenario, model=oracle_model, use_cache=use_cache)
    gate_drive = reframe_gate(f)

    ans = chat(
        [{"role": "user", "content": TIERED_ANSWER_USER.format(
            scenario=scenario, facts=json.dumps(f, ensure_ascii=False, indent=2))}],
        model=answer_model, max_tokens=120, use_cache=use_cache,
    )
    m = re.search(r"answer:\s*(walk|drive)", ans, re.I)
    tier_a = m.group(1).lower() if m else classify_answer(ans)
    tier_b = "drive" if gate_drive else "walk"

    result = {"answer": tier_a, "gate_answer": tier_b,
              "agreed": tier_a == tier_b, "facts": f, "calls": 2}
    if return_trace:
        result["raw"] = {"reframe": raw, "answer": ans}
    return result


# ---------------------------------------------------------------------------
# F — reframe-the-reframe: TWO well-posed questions instead of 6-7 keys.
#
# The residual failures of E_reframe trace to the `central_thing` abstraction
# being the wrong hinge: gas/air resolve central_thing to the substance (which IS
# at the destination → walk), and self-service resolves it to "you" (→ a
# carry-yourself misfire). Both vanish if we ask the actual invariant directly.
# The two causes a vehicle is needed at all: the trip SERVICES a road vehicle (so
# the vehicle must be present), OR it moves a heavy/bulky load. Asking those two
# directly should fix the substance class ("fuel the car" → services a vehicle →
# drive) without a central_thing, and self-service / dog / baby fall out as walk
# (no vehicle serviced, no heavy load). Fewer keys = less extractor perturbation.
# ---------------------------------------------------------------------------

REFRAME2_SYS = (
    "You extract two neutral yes/no facts about a situation as JSON. You do NOT "
    "give travel advice and you do NOT decide walk vs drive. Answer only the JSON."
)

REFRAME2_USER = """Situation: {scenario}

Answer as JSON with exactly these two keys:
- "services_a_vehicle": does the purpose involve servicing, fuelling, charging, repairing, inspecting, or otherwise acting ON a road vehicle (car, van, motorbike) — so that the vehicle itself must be physically at the destination? "yes" or "no"
- "moves_heavy_load": to accomplish this, must the person transport an object too heavy or bulky to carry by hand on foot — either bringing it to the destination or taking it home? A person or animal that walks on its own is NOT a load. "yes" or "no"

Return only the JSON object."""


def reframe2_gate(f: dict) -> bool:
    def yes(k):
        return str(f.get(k, "")).strip().lower().startswith("y")
    return yes("services_a_vehicle") or yes("moves_heavy_load")


def _do_reframe2(scenario: str, *, model: str | None = None, use_cache: bool = True) -> tuple[dict, str]:
    mkw = {"model": model} if model else {}
    raw = chat(
        [
            {"role": "system", "content": REFRAME2_SYS},
            {"role": "user", "content": REFRAME2_USER.format(scenario=occlude_distance(scenario))},
        ],
        max_tokens=120,
        use_cache=use_cache,
        **mkw,
    )
    return _parse_json(raw), raw


def cond_reframe2(scenario: str, *, return_trace: bool = False, **kw) -> dict:
    f, raw = _do_reframe2(scenario, **kw)
    requires_vehicle = reframe2_gate(f)
    result = {"answer": "drive" if requires_vehicle else "walk", "facts": f,
              "requires_vehicle": requires_vehicle, "calls": 1}
    if return_trace:
        result["raw"] = {"reframe": raw}
    return result


# G — self-consistency over F_reframe2. Sample the 2-key reframe N times at a
# small temperature with distinct seeds; majority-vote the gate decision. Targets
# the residual hard traps (gas/propane/water-cooler/jump-start) on the hypothesis
# that they are UNSTABLE extractions a vote can recover, not deterministic misses.
VOTE_N = 5
VOTE_TEMP = 0.3


def cond_reframe2_vote(scenario: str, *, return_trace: bool = False,
                       use_cache: bool = True, model: str | None = None, **_kw) -> dict:
    mkw = {"model": model} if model else {}
    votes, samples = [], []
    for s in range(VOTE_N):
        raw = chat(
            [
                {"role": "system", "content": REFRAME2_SYS},
                {"role": "user", "content": REFRAME2_USER.format(scenario=occlude_distance(scenario))},
            ],
            max_tokens=120, temperature=VOTE_TEMP, seed=s, use_cache=use_cache, **mkw,
        )
        f = _parse_json(raw)
        votes.append(reframe2_gate(f))
        samples.append(f)
    drive_votes = sum(1 for v in votes if v)
    requires_vehicle = drive_votes > VOTE_N // 2
    result = {"answer": "drive" if requires_vehicle else "walk",
              "drive_votes": f"{drive_votes}/{VOTE_N}",
              "requires_vehicle": requires_vehicle, "calls": VOTE_N}
    if return_trace:
        result["raw"] = {"samples": samples}
    return result


# ---------------------------------------------------------------------------
# P — persona audit: same raw judgment as A_baseline, but under the REAL Gap
# Chat system prompt the prod model actually answers with.
#
# Why: a sibling eval (chat search-decision) found the full persona suppresses an
# in-context capability the bare 8B has (tool-calling 65% -> 0%). This tests the
# same effect on the reasoning-trap class: does the heavy, conclusion-first
# persona ("lead with the direct answer in the first sentence") INDUCE or WORSEN
# the walk-or-drive failure vs the bare prompt? It also tells us whether a fix
# must sit OUTSIDE the persona'd call (it does, if persona makes it worse).
#
# persona_prompt.txt is a verbatim snapshot of buildPersonaPrompt(
# "swiss-ai/Apertus-1.5-8B-Instruct-sft-dpo-tools") from chat-svelte
# src/lib/server/textGeneration/persona.ts (branch chat-ui-migration, 2026-06-18).
# Decoding is held at the harness default (temp 0) to isolate the prompt
# variable; prod additionally applies GROUNDED_DECODING (temp 0.1 + penalties).
# ---------------------------------------------------------------------------

_PERSONA_PATH = Path(__file__).parent / "persona_prompt.txt"


def _load_persona() -> str:
    return _PERSONA_PATH.read_text().strip()


def cond_baseline_persona(scenario: str, **kw) -> dict:
    out = chat(
        [
            {"role": "system", "content": _load_persona()},
            {"role": "user", "content": scenario},
        ],
        max_tokens=256,
        **kw,
    )
    return {"answer": classify_answer(out), "calls": 1, "raw": {"reply": out}}


# ---------------------------------------------------------------------------
# K — prompt-complexity ladder (the "Car Wash" follow-up: arXiv:2603.13351,
# "Prompt Complexity Dilutes Structured Reasoning"). Holding the walk/drive
# question FIXED, wrap it in increasing irrelevant prompt complexity and measure
# whether accuracy degrades. The padding is deliberately ANSWER-NEUTRAL — generic
# response guidelines that say nothing about travel, purpose, or co-location — so
# any degradation is dilution of reasoning by load, not leakage or distraction
# toward a wrong answer. K0 is just A_baseline (the lean reference).
# ---------------------------------------------------------------------------

_PAD_MEDIUM = (
    "You are an AI assistant. Please follow these response guidelines: keep a "
    "friendly, professional tone; be concise but complete; avoid unnecessary "
    "jargon; briefly explain your reasoning where helpful; and make your final "
    "answer clear. Here is the question:\n\n"
)

_PAD_HEAVY = (
    "You are a knowledgeable, careful, and helpful AI assistant operating in a "
    "high-stakes professional setting. Before responding, internalise ALL of the "
    "following guidelines and apply them throughout your answer:\n"
    "1. Maintain a warm yet professional tone at all times.\n"
    "2. Be thorough but also concise; never pad your response.\n"
    "3. Avoid jargon, but do not oversimplify.\n"
    "4. Where useful, explain the reasoning behind your answer step by step.\n"
    "5. Consider multiple perspectives before settling on a position.\n"
    "6. Structure your response for maximum clarity and readability.\n"
    "7. Acknowledge uncertainty where it genuinely exists.\n"
    "8. Be culturally sensitive and inclusive in your phrasing.\n"
    "9. Do not make assumptions beyond what is stated.\n"
    "10. End with a single clear, unambiguous final answer.\n"
    "Adhering to every guideline above, now respond to the following question:\n\n"
)


def _cond_padded(pad: str):
    def _c(scenario: str, **kw) -> dict:
        out = chat([{"role": "user", "content": pad + scenario}], max_tokens=256, **kw)
        return {"answer": classify_answer(out), "calls": 1, "raw": {"reply": out}}
    return _c


cond_complex_medium = _cond_padded(_PAD_MEDIUM)
cond_complex_heavy = _cond_padded(_PAD_HEAVY)


# The FAITHFUL test of 2603.13351: take a prompt that elicits STRUCTURED
# reasoning (B_cot) and dilute it with the same answer-neutral heavy padding.
# If complexity dilutes structured reasoning, K_cot_heavy < B_cot.
def cond_cot_heavy(scenario: str, **kw) -> dict:
    out = chat(
        [{"role": "user", "content": _PAD_HEAVY + scenario + COT_SUFFIX}],
        max_tokens=512,
        **kw,
    )
    m = re.search(r"answer:\s*(walk|drive)", out, re.I)
    ans = m.group(1).lower() if m else classify_answer(out)
    return {"answer": ans, "calls": 1, "raw": {"reply": out}}


CONDITIONS = {
    "A_baseline": cond_baseline,
    "B_cot": cond_cot,
    "C_hybrid": cond_hybrid,
    "D_occluded": cond_hybrid_occluded,
    "E_reframe": cond_reframe,
    "E2_tiered": cond_tiered,
    "F_reframe2": cond_reframe2,
    "G_reframe2_vote": cond_reframe2_vote,
    "P_persona": cond_baseline_persona,
    "K1_medium": cond_complex_medium,
    "K2_heavy": cond_complex_heavy,
    "K3_cot_heavy": cond_cot_heavy,
}
