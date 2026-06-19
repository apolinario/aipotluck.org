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

**Pressure test — 65-item NATURAL set (`scenarios_natural.jsonl`, 2026-06-18).**
Hand-written, off-template, human-labeled gold + rationale, 30 drive / 35 walk,
with adversarial items (portable purchase, baby-carry, heavy-grocery distractor,
gas/air substance-delivery, propane, water-cooler). This is the trustworthy
generalization measure — the templated N=68 shares its author with the gate keys.

| condition | overall | trap recall | walk preserved |
|-----------|---------|-------------|----------------|
| A_baseline | 36/65 (55%) | 4/30 | 32/35 |
| E_reframe, 6-key | 57/65 (88%) | 27/30 | 30/35 |
| E2_tiered (70B oracle) | 55/65 (85%) | 25/30 | 30/35 |
| E_reframe, 7-key | 59/65 (91%) | 27/30 | 32/35 |
| **F_reframe2, 2-key (FINAL)** | **61/65 (94%)** | 26/30 | **35/35** |

Final recommended config: **single-8B `F_reframe2` — TWO well-posed questions
(`services_a_vehicle OR moves_heavy_load`), 61/65 (94%), ZERO walk false-flips.**

`F_reframe2` ("reframe the reframe") replaced the 6–7 `central_thing` keys with
the two actual invariants — does the trip service a road vehicle, or move a heavy
load. It beat the 7-key path on every axis that matters:
- accuracy 94% vs 91%;
- **walk_preserved 35/35 (zero false-flips)** vs 32/35 — it never spuriously
  says drive, so it can't annoy a user who just wants the bakery;
- structurally fixed self-service (8/10→10/10) and the baby-carry edge, with no
  per-class key;
- **triage false-positives 0/15 vs 2/15** — with no `leaves_with_unportable` key
  to hallucinate, it stays safe on non-errand chat (a bonus on the required
  triage gate).

Cost: −1 trap recall (26 vs 27/30). The 4 residual trap misses are hard/edge:
`np_gas` (the model won't connect "fill the tank" to servicing a vehicle —
substance-delivery, still unsolved), `np_propane`, `np_watercooler` (heaviness
judgement), `np_jumpstart` (dead-car trick). These are the next target, likely
via self-consistency voting (they may be unstable extractions).

Lesson: when a decomposition is brittle, ask a *better-shaped question*, don't
add keys. The principled single question beat the accreted multi-key schema.

**Self-consistency voting (G_reframe2_vote) — NO gain, and that's the useful
result.** Sampling the 2-key reframe 5× at temp 0.3 with distinct seeds and
majority-voting the gate left the score unchanged (61/65) and missed the same 4
traps — all 5 samples agreed on the wrong answer each time. So the residuals are
**deterministic capability/schema misses, not unstable extractions**: the model
robustly says `services_a_vehicle=no` for "fill the tank" (a real knowledge gap)
and `moves_heavy_load=no` for propane / a 19L water bottle (arguably *defensible*
— those may be label disputes, not model errors). Self-consistency is the wrong
tool for a deterministic gap. **The 94% plateau is real; the last ~4 points need
weights (distillation) or are debatable labels — not more inference-time
scaffolding.** Voting at 5× cost for 0 gain is not the recommended config.

Two results the templated set got WRONG:
1. **On natural data, single-8B reframe ≥ tiered (88% vs 85%).** The templated
   "tiered 36/36 traps" was an artifact of structures aligned to the oracle's
   extraction; on natural phrasing the 70B advantage vanishes and it adds errors
   (windshield, jump-start, water-cooler, both daycare items). **Recommend the
   single-8B path; drop the oracle.** (Every time the eval set changed, the
   single-vs-tiered winner flipped — which is the argument for the natural set.)
2. **The real generalization number is ~88%, not the templated ~90%+.**

Three characterized residual failure classes (all gate/schema, addressable):
- **(a) substance-delivery co-presence** — `np_gas`, `np_tireair` miss on BOTH
  tiers. When the service delivers a substance (gas, air) into the car, the
  reframe resolves `central_thing` to the substance (which genuinely IS at the
  destination) → gate says walk. The systematic co-presence weak spot (~2/14).
- **(b) co-participant-can-walk false-flips** — `np_dogvet`, `np_doggroom` flip a
  walkable dog/kid to drive. **FIXED by the kept 7-key gate** (co_participant
  7/9→9/9); this is what the natural set proved real and worth the key.
- **(c) self-service "carry yourself"** — `np_dentist`, `np_gym` mild flips (the
  central_thing is you; "can you be hand-carried" → no → drive). Milder, remains.
- Edge: `np_baby_carry` (a baby can't walk but is hand-carryable) still flips —
  one item, the animacy key doesn't catch "can't-walk-but-portable".

After the 7-key fix the residuals are (a) gas/air substance-delivery and (c)
self-service — both `central_thing`-resolution issues in the reframe schema.

The set already earned its keep: it reversed the architecture call (single ≥
tiered), reversed the companion_can_walk verdict (keep, not revert), confirmed
gas/air as robust, and proved the dog-flip real. N=65 is a credible small eval,
not yet a benchmark — HOB (arXiv:2603.29025) and ~150+ items remain for a SOTA
claim.

**HOB-aligned extension — the gate is heuristic-robust (2026-06-18).** Grew the
set to 107 in-frame items tagged with HOB's real families (4 heuristic ×
constraint, pulled from the paper). Note: HOB's own 500 instances are **NOT
publicly released** (paper-only — verified: no GitHub/HF/data link), so "run HOB"
means mirroring its *taxonomy*, not downloading it — which matches HOB's own
construction (3 authors, hand-built, not LLM-generated). On the 107-item set
F_reframe2 scores **99/107 (93%), zero walk false-flips**, and crucially holds
across heuristic families — H-prox 79/85, H-eff 8/10, H-cost 8/8, H-sem 4/4. The
2-key gate ignores the surface bait (closer/faster/cheaper/name-matches) and
checks the invariant, so it isn't proximity-specific. Plus 8 out-of-frame probes
(C-val/C-scope/C-proc — precondition/scope/timing violations) that the
walk-or-drive gate structurally **cannot** represent (gold "neither"): these mark
the boundary — the next constraint families need a different gate, not a tweak.

**Triage pre-filter is REQUIRED (not optional).** Ran the reframe→gate on 15
NON-errand prompts ("explain recursion", "summarize the French Revolution",
"should I take the job offer", etc.). 13/15 correctly resolved to no-vehicle, but
**2/15 spuriously fired "drive"** — both via a hallucinated
`leaves_with_unportable=yes` on an abstract `central_thing` ("a problem", "the
French monarchy"); the `bring_unportable` branch never misfired. So the world-
model pre-pass must only run on travel-decision questions — running it on all
chat injects a spurious drive on ~13% of normal turns. A crude "is there a
physical trip/destination?" triage kills both failures. This is the load-bearing
product gate, ahead of any further trap-recall tuning.

**Persona audit (P_persona).** The full production Gap Chat system prompt does
NOT induce or worsen the failure — it mildly *helps* (traps 2→9/36). The failure
is a property of the model, not the prompt framing. This is a clean contrast
with the sibling search-decision eval, where the same persona *suppressed* the
tool-calling decision to 0%: heavy system context dampens a *chosen action*
(whether to call a tool) but not a *factual judgment* (walk vs drive). The fix
runs as its own pre-pass regardless, so it is persona-independent.

**Gate walk-side — companion_can_walk (7th key), KEPT after the natural set
overturned the templated verdict.** An animacy key ("is the central thing a
person/animal that can walk itself?", to stop the gate treating a walkable
dog/kid as an uncarryable payload). On the TEMPLATED set it looked like a
regression for the single 8B (−2: 61→59 — adding a question perturbed the
extraction of the *other* keys, flipping a car wash's `location_before_trip` to
"at_destination"). That perturbation was itself a template artifact: on the
trustworthy NATURAL set the key is a net **+2 (57→59/65)**, fixing the
dog-vet/groomer false-flips (co_participant 7/9→9/9) with no trap-recall cost,
and co_presence even ticked up. Lesson: the templated set's negative verdict was
wrong; the natural set is the one to trust. (See the pressure-test section.)

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

---

## Prompt-complexity dimension (#11 — arXiv:2603.13351, the "Car Wash" follow-up)

*Folded into this harness as conditions `K1_medium`, `K2_heavy`, `K3_cot_heavy`;
run on the 65-item natural set. The claim under test: "prompt complexity dilutes
structured reasoning." Padding is answer-NEUTRAL (generic response guidelines —
nothing about travel, purpose, or co-location), so any effect is load, not leakage.*

### Padding the BARE baseline → bias shift, not dilution

| cond | overall | trap_recall | walk_preserved |
|------|---------|-------------|----------------|
| A_baseline (lean) | 36/65 (55%) | 4/30 | 32/35 |
| K1_medium | 40/65 (62%) | 15/30 | 25/35 |
| K2_heavy | 39/65 (60%) | 5/30 | 34/35 |

Overall accuracy is **flat** (within noise across 36/40/39). What moves is the
walk↔drive **response bias**: medium padding pushes toward "drive" (trap_recall
up 4→15 but 10 walk false-flips), heavy padding pushes back toward "walk"
(34/35 preserved, 5/30 traps). The bare baseline barely reasons (4/30 traps — it
defaults to "walk"), so there is **no structured reasoning to dilute** — only a
default to perturb. This is NOT the paper's effect; it is prompt-induced
answer-bias drift.

### Padding the STRUCTURED prompt (CoT) → the faithful test

| cond | overall | trap_recall | walk_preserved |
|------|---------|-------------|----------------|
| B_cot | 50/65 (77%) | 19/30 | 31/35 |
| K3_cot_heavy | 45/65 (69%) | 14/30 | 31/35 |

This is the on-point replication: take a prompt that *does* elicit structured
reasoning (step-by-step about purpose) and dilute it with the same heavy padding.
It degrades **8 percentage points (77→69%), and every lost point is in
trap_recall** (19→14) — `walk_preserved` is untouched (31/31). Paired McNemar:
8 dropped vs 3 recovered, **p=0.227** — directional, not significant at n=65.

### Read

- **The paper's effect appears where it should and nowhere else.** Complexity
  erodes the *effortful* reasoning (CoT on the hard trap cases), not the easy
  defaults (walks are preserved exactly). On the bare model there is nothing
  structured to erode, so complexity only shifts bias. Mechanistically clean.
- **But it is a TREND, not a proven effect** at n=65 (p=0.227). The honest claim:
  weak corroboration of "complexity dilutes structured reasoning" on this 8B —
  the dilution is real-looking and falls on exactly the reasoning-dependent items,
  but the natural set is too small to confirm it. A larger set (or the HOB 500)
  would settle it.
- **Cross-suite theme.** Same shape as GSM-Symbolic (added *depth* breaks problems
  the model otherwise solves) and the sycophancy persona (a heavier prompt is
  worse): on this 8B, added complexity costs the *effortful* reasoning first. For
  Gap Chat, that argues for **lean prompts on reasoning-dependent turns** — the
  persona/guideline weight is not free.
