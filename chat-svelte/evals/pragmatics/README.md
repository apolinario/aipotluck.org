# Pragmatics harness — walk-or-drive "Heuristic Override" eval

A small, honest eval + hybrid-loop prototype for the failure where Apertus
answers "walk" to *"The car wash is only 100m away — walk or drive?"*

As of 2026 this is a **named, benchmarked failure class** — "Heuristic
Override" (Li et al., *The Model Says Walk*, arXiv:2603.29025): a surface cue
(short distance → walk) overrides an implicit world-model constraint (the car
is the thing being washed, so it must come). Open ~8B models fail it hard — in
one 53-model eval every Llama and Mistral model scored 0/10; humans hit 71.5%.

## The bet (the "decompose trick", kept — but the answer is NOT hardcoded)

"Should I walk or drive?" fails because purpose-inference is above an 8B's
threshold. So condition **C** never asks the model that question. It:

1. **extracts the goal** ("clean my car") — a sub-question below threshold;
2. **forward-simulates each option** — "if you WALK, what do you physically
   have with you on arrival? does that achieve the goal?" The model itself
   says "the car is still at home → no." All world knowledge is the model's.
3. **gates with one domain-agnostic rule**: prefer the cheaper option (walk)
   unless the simulation says it fails the goal.

Critically, **v1 was scrapped**: it hand-coded rules like `if acted_on_is_a_vehicle:
drive`. That was *me* being the world model — a lookup table of trap classes I
enumerated, which doesn't generalize past the gotchas I anticipated. v2 has zero
domain facts in Python; the only deterministic logic is the cheaper-unless-it-
fails rule, which works for any "do X or Y to accomplish Z" question.

## This is not a new wheel — it's three named patterns stacked

| step | named technique | citation |
|------|-----------------|----------|
| state consequences before choosing | **FaR / Foresee-and-Reflect** (GPT-4 action-selection 50→71%) | arXiv:2310.03051 |
| simulate each option's outcome, pick best, no tree search, works at 7B | **WebDreamer** | arXiv:2411.06559 |
| model proposes, *external/deterministic* check disposes | **LLM-Modulo** | arXiv:2402.01817 |
| small model + a *strong* (here: deterministic) verifier | Zhang et al. | arXiv:2404.17140 |
| keep the check independent of the proposal | **Chain-of-Verification** | arXiv:2309.11495 |

The deterministic gate is what makes this sound rather than wishful: "LLMs
Cannot Self-Correct Reasoning Yet" (arXiv:2310.01798) is scoped *only* to
**intrinsic** self-correction (model grading itself). An external deterministic
rule is the regime that paper explicitly excludes — and the recommended one for
small models.

## Conditions

| id | what |
|----|------|
| `A_baseline` | raw single-shot — **measures** the failure rate instead of assuming it |
| `B_cot` | "think step by step about the purpose" — the generic baseline to beat |
| `C_hybrid` | extract goal → forward-simulate both options → domain-agnostic gate |
| `D_occluded` | `C_hybrid` with the distance cue stripped first (HOB's causal occlusion) |
| `E_reframe` | neutral 6–7-key reframe → deterministic gate (the prior path; 59/65 natural) |
| `E2_tiered` | 70B oracle does the reframe → gate decides → 8B phrases (oracle doesn't help on natural data) |
| `F_reframe2` | **TWO-question reframe → gate** (`services_a_vehicle OR moves_heavy_load`) — the recommended path: 61/65 (94%) natural, zero walk false-flips, 0/15 triage false-positives |
| `P_persona` | `A_baseline` under the real production Gap Chat system prompt (does the persona induce the failure? — no) |
| `K1_medium` / `K2_heavy` | **prompt-complexity ladder** (arXiv:2603.13351): bare ask wrapped in increasing *answer-neutral* padding — on the bare model this shifts walk/drive bias, doesn't dilute |
| `K3_cot_heavy` | the faithful dilution test: `B_cot` (structured reasoning) + heavy padding — degrades it 77→69%, all loss in trap_recall (p=0.227, a trend) |

The gate is intentionally a **6-key** reframe; a 7th animacy key was tried and
reverted (it perturbs a weak extractor's other keys — see FINDINGS, negative
result). `E_reframe` is the product-relevant path: one extra 8B call, then a
deterministic gate, no second model.

## Honesty guards in the dataset

`scenarios.jsonl` is **not** all traps. It mixes traps (gold=drive), non-traps
(gold=walk), and 3 controls that break naive rules:

- `haircut` — the service acts on *you*; you're always co-located with your hair
  → walk. (v1's rule engine needed a special case for this; v2's simulation
  handles it with no special case — the model just says "I arrive with my hair,
  goal achieved".)
- `dog_groomer` / `kid_school` — a co-participant that *can* walk the distance → walk.
- `buy_fridge` — walk there fine, can't carry it home → drive (return-leg reasoning).

The scoreboard reports **trap recall** and **walk preserved** separately, so a
degenerate "always drive" trick scores 0 on the second column and is exposed.

## Run

```
export CSCS_SERVING_API=<your CSCS serving key>
python run.py                  # all conditions, all scenarios
python run.py --trace carwash  # full goal+simulation trace for one scenario
```

Deterministic calls (temperature 0) are cached to `.cache/` by content hash, so
re-running A/B while you iterate on C is free. `--no-cache` forces re-call.

## Known risks (from the lit review — design around these)

- **Simulation faithfulness is now the weak link.** "Reasoning or Reciting?"
  (arXiv:2307.02477) shows LLM world-models degrade off-distribution. If the
  model's forward-sim is wrong, the gate faithfully propagates the error. That
  is why C measures, not asserts — `--trace` dumps the simulation so you can see
  *why* it chose, not just what.
- **Over-decomposing easy cases can hurt** (inverse-U, arXiv:2507.04023; CoT
  degrades small models, arXiv:2201.11903). Running the heavy path on "walk to
  the ATM" risks introducing errors. The `walk_preserved` column is exactly the
  detector for this. If C false-flips non-traps, add a cheap trap-triage gate.
- **Decomposition doesn't conjure missing knowledge** (arXiv:2602.04853,
  *unverified ID*). The bet only holds because the leaf facts ("a car wash
  washes cars") are ones the 8B *does* know. Verify that assumption per scenario.

## Bigger levers beyond this prototype

- **Test against the real benchmarks, not 20 hand-written items**: HOB
  (arXiv:2603.29025) is purpose-built for this class with a presence/capability/
  scope/validity/procedural constraint taxonomy; BrainBench (2603.14761) adds 19
  sibling classes. Use ours as a fast local probe, those as the real instrument.
- **Audit the Gap Chat persona prompt**: *Prompt Complexity Dilutes Structured
  Reasoning* (arXiv:2603.13351) shows a conclusion-first ("lead with specifics")
  production system prompt can *induce* this failure in a model that would
  otherwise pass. Our persona has such voice rules — test with and without them.

See `REFERENCES.md` for the full annotated citation list and verification flags.
