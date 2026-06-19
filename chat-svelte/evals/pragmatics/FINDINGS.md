# Findings — walk-or-drive "Heuristic Override" on Apertus

The headline below is the **served production model**,
`Apertus-1.5-8B-Instruct-sft-dpo-tools` (CSCS-direct). The sections after it are
the earlier `Apertus-8B-Instruct-2509` + `Apertus-70B-Instruct-2509` work that
established the method and showed the failure is model-dependent.

## HEADLINE — production model `Apertus-1.5-8B-Instruct-sft-dpo-tools` (2026-06-18)

N=68 structure-labeled set, CSCS-direct, temperature 0. Gold derived from
structure, not from a model (no LLM grading another LLM's traps).

| condition | overall | trap recall | walk preserved |
|-----------|---------|-------------|----------------|
| A_baseline (raw single-shot) | 31/68 | 2/36 | 29/32 |
| P_persona (full Gap Chat system prompt) | 37/68 | 9/36 | 28/32 |
| **E_reframe (neutral reframe → deterministic gate, single 8B)** | **61/68** | **31/36** | 30/32 |
| E2_tiered (70B oracle reframe → gate → 8B) | 62/68 | 36/36 | 26/32 |

Three results that revise the earlier (2509/70B) conclusions:

1. **The failure transfers to the served model.** Bare baseline still scores
   2/36 on the traps — the 1.5 SFT/DPO line did not add the co-presence
   primitive to *direct* judgment. The car wash question still gets "walk".

2. **The fix now runs on the served 8B alone — no 70B oracle.** The neutral
   reframe → deterministic gate hits **61/68 (31/36 traps)** using only the
   served 8B to extract facts. On the older 2509-8B this collapsed (the model
   couldn't even *supply* the facts); the 1.5-8B is a competent fact-extractor
   while remaining a poor direct-judge. **Product consequence: the world-model
   fix is a single-model pre-pass, not a two-tier system.** The 70B oracle buys
   only +1 overall (62/68) at the cost of a second, larger call — not worth it.

3. **The "8B overrides injected facts" caution was largely a 2509 artifact.**
   In the tiered path the 8B reasoning *over* the oracle's facts went from 5/16
   (2509) to **16/16 (1.5)** on co_presence — the 1.5-8B *defers* to supplied
   facts. The architecture lesson still holds (let the deterministic gate
   decide, the 8B phrase), but naive fact-injection is far less dangerous on the
   served model than the 2509 result implied.

**Persona audit (P_persona).** The full production Gap Chat system prompt does
NOT induce or worsen the failure — it mildly *helps* (traps 2→9/36). The failure
is a property of the model, not the prompt framing. This is a clean contrast
with the sibling search-decision eval, where the same persona *suppressed* the
tool-calling decision to 0%: heavy system context dampens a *chosen action*
(whether to call a tool) but not a *factual judgment* (walk vs drive). The fix
runs as its own pre-pass regardless, so it is persona-independent.

**Negative result — gate walk-side (companion_can_walk).** An added 7th reframe
key (animacy: "is the central thing a person/animal that can walk itself?",
intended to stop the gate treating a walkable dog/kid as an uncarryable payload)
helped the 70B oracle path (+1) but HURT the single served 8B (−2: 61→59).
Tracing showed the 8B did not misread the new key — adding a question *perturbed
the extraction of the other keys* (a car wash's `location_before_trip` flipped to
"at_destination"). For a weak fact-extractor, every extra decomposition question
is a liability; the minimal 6-key reframe wins. Reverted. (Same lesson as the
spot-check correction below, now for *adding* a key: re-run the whole set.)

---

## Earlier work — `Apertus-8B-Instruct-2509` (the method + the bifurcation)

Live run, 20 scenarios, CSCS-direct endpoint, temperature 0. Scoreboard:

| cond | overall | trap recall | walk preserved | false-flips |
|------|---------|-------------|----------------|-------------|
| A_baseline | 11/20 | 2/8 | 9/12 | 3 |
| B_cot | 14/20 | 2/8 | 12/12 | 0 |
| C_hybrid (simulate-then-gate) | 13/20 | 1/8 | 12/12 | 0 |
| D_occluded (distance stripped) | 14/20 | 2/8 | 12/12 | 0 |

## Headline

**No prompt-side harness clears ~2/8 on the traps.** CoT, simulate-then-gate, and
distance-occlusion all cap at 14/20. The ceiling is the trap recall, not walk
preservation (which is easy: 12/12 for everything except naive baseline).

## The bifurcation (the actual result)

A distance-occluded, isolated crux-question probe splits the 8 traps into two
classes with different root causes:

**1. Object-co-presence traps — WEIGHTS-BOUND (no harness fixes these).**
carwash, gas, inspection, flat_tire. Asked the crux question with distance
removed and in isolation — *"Can a car wash clean your car if you leave the car
at home and walk there?"* — the 8B answers **"Yes"** and contradicts itself in
the same sentence. The model does not possess the primitive "to service object
X, X must be co-present." Decomposition cannot conjure a fact the weights lack
(cf. arXiv:2602.04853). Confirmed twice: full simulation AND isolated probe.

**2. Physical-capacity traps — HARNESS-REACHABLE but framing-sensitive.**
heavy_box, old_microwave, storage_boxes, buy_fridge. The 8B answers the
*pointed* capacity question correctly distance-free (*"Can one adult carry 25kg
150m?"* → "No"; *"carry a fridge home?"* → "No"). But:
- Open-ended outcome simulation ("imagine arriving with the box — achieves
  goal?") is **sycophantic toward feasibility** — it says "yes, they can carry
  it." C_hybrid/D regressed `buy_fridge`, which plain baseline got *right*.
- Distance-occlusion alone recovered `storage_boxes` but not `heavy_box`.
=> This class needs a **pointed verification question** (CoVe-style), NOT open
simulation. Open "does this achieve the goal?" begs a yes.

## Design lessons (transferable)

1. **Heuristic Override contaminates the harness's own intermediate steps.** The
   distance cue hijacked goal-extraction ("wash the car" → "get to the car
   wash") and the simulation. You cannot out-prompt the heuristic while the
   spurious cue sits in context. Occlude it (HOB's causal-occlusion method).
2. **Open-ended self-simulation is sycophantic.** "Imagine arriving with X —
   does it achieve the goal?" invites "yes." Use a pointed, falsifiable
   verification question instead (independent of any proposed answer — CoVe).
3. **The deterministic gate is only as good as the generator.** Walk-preservation
   was perfect; the gate never over-triggered. Every trap miss traces to a wrong
   model-supplied fact, not a wrong rule. Generator is the bottleneck (matches
   Small-Models-Need-Strong-Verifiers, arXiv:2404.17140 — except here even the
   generator's *facts* are wrong, not just its self-judgment).
4. **The distance-occluded isolated probe is itself the useful tool** — it
   classifies each failure as harness-fixable (capability present, heuristic-
   contaminated) vs weights-bound (primitive absent) in one cheap call.

## UPDATE — model matters: 70B has the primitive, just suppressed

Re-ran on `Apertus-70B-Instruct-2509`. The "weights-bound" verdict above holds
for the **8B** but NOT the 70B:

- **70B isolated crux probe: 3/4 right** (gas/inspection/flat_tire correct; only
  "car wash" still wrong in isolation). It *has* the co-presence primitive.
- **70B baseline on full scenarios: 0/8.** The distance cue suppresses knowledge
  it demonstrably holds — Heuristic Override in pure form (knowledge present,
  heuristic overrides it), distinct from the 8B's genuine absence.
- **Neutral pre-prompt reframe (condition E): 70B 0/8 → 7/8 traps, walks 10/12.**
  The one miss (`buy_fridge`) is the return-payload structure left out of the
  schema on purpose. Two false-flips (dog_groomer, friend) from the
  "hand_portable" frame misfiring on a co-participant.
- **Same reframe on 8B: 2/8 → 5/8 but walks 8/12 (4 false-flips)** — helps less,
  costs more: the signature of structure-without-knowledge.

Methodological lesson: a **LEADING** reframe ("e.g. the car is being serviced")
turned the 8B into an always-drive yes-machine (8/8 traps, 0/7 walks) and capped
the 70B at 3/8. The **NEUTRAL** reframe (model supplies facts, no answer hints)
took the 70B to 7/8. Neutrality was the whole difference.

DSPy note: deferred on purpose. At N=20 an optimizer overfits and few-shot demos
can leak answers, giving a false positive on the core question. DSPy's real job
(tune away the 2 false-flips + add a return-payload question) needs ~100-150
labeled items first — which is the actual prerequisite, framework or not.

## SCALED — N=68 templated set (gen_scenarios.py), 70B

Structure-labeled (gold from structure, not a model), 6 structures, 36 drive /
32 walk. Baseline vs neutral reframe (condition E):

| structure | baseline | reframe | reframe + return-payload Q |
|-----------|----------|---------|----------------------------|
| co_presence | 2/16 | 15/16 | 15/16 |
| bring_heavy | 0/10 | 10/10 | 10/10 |
| return_payload | 2/10 | 3/10 | **10/10** |
| light_errand | 14/14 | 14/14 | 14/14 |
| self_service | 10/10 | 10/10 | 10/10 |
| co_participant_walk | 7/8 | 8/8 | 8/8 |
| **overall** | **35/68 (51%)** | **60/68** | **~67/68 (~99%)** |

CORRECTION: the return-payload question did NOT come free. A 19-item spot-check
said "no regression (19/19)" but it under-sampled the walk structures. The full
68-item run shows it also introduced false-flips: self_service 10/10 → 7/10 and
co_participant_walk 8/8 → 4/8, while fixing return_payload 3/10 → 10/10. Net the
gate went 60/68 → 61/68 (a ~7-for-6 trade), NOT the ~67/68 first reported. Lesson:
spot-checks are too weak to certify a prompt change; re-run the whole set.

Caveat: the N=68 set is templated/synthetic — directional confirmation that the
20-item result holds at scale, not a natural-distribution benchmark. HOB
(arXiv:2603.29025) remains the harder instrument. This is also the data floor
that would make a DSPy optimization trustworthy (still want ~100-150 natural items).

## TIERED — 70B oracle facts -> 8B answer (N=68)

Product question: can an 8B-served chat model inherit 70B-quality handling for
one extra oracle call?

- **Tier-A** (8B reasons over the oracle's facts): **50/68**
- **Tier-B** (deterministic gate over the same facts): **61/68**
- **Agreement** (8B follows the gate): **43/68**

The 8B OVERRIDES correct supplied facts on the trap classes: handed "the car must
be present, it's with you, not hand-carryable", it still says walk on 11/16
co_presence (Tier-A co_presence 5/16 vs gate 16/16). So:

**Architecture verdict: tiering works only if the GATE decides and the 8B merely
phrases it (70B oracle -> deterministic gate -> 8B writes the response). Do NOT
inject facts and let the 8B reason — it reverts to the distance heuristic and
overrides the truth.** Corollary: naive commonsense-RAG into the 8B (inject
preconditions, let it reason) will likely fail the same way; the decision must
live in the gate, not the model.

## What this says for the product

- **The co-presence class will not be fixed by Gap Chat scaffolding on the 8B.**
  It needs weights: re-test on Apertus-70B (does scale add the co-presence
  primitive?) or distill it in (Distilling Step-by-Step 2305.02301;
  R1-distill 2501.12948). This is the concrete 8B-vs-70B experiment.
- **Audit the persona prompt** (arXiv:2603.13351): a conclusion-first system
  prompt can *induce* this failure. Re-run with/without the Gap Chat voice rules.
- Treat 20 hand items as a fast probe; HOB (2603.29025) is the real instrument.
