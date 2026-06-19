# Findings — GSM-Symbolic robustness on the production Apertus 8B

Model: `swiss-ai/Apertus-1.5-8B-Instruct-sft-dpo-tools` (what Gap Chat serves).
Data: Apple GSM-Symbolic (arXiv:2410.05229), `main`/`p1`/`p2`, CC-BY-NC-ND.
Sample: 20 templates shared across all three levels; 8 `main` instances each
(variance) + instance 0 at each level (difficulty). Single-turn CoT, numeric grade.

## Variance probe — mostly robust, with a real minority of unstable templates

Same template, different names/numbers, identical structure → a reasoner should
be stable.

- **Overall accuracy: 145/160 (91%).**
- **Unstable templates: 6/20** — neither all-right nor all-wrong across their 8
  instances. The other **14/20 are perfectly stable** (8/8).
- The clearest pattern-match failure is template **99: 2/8** — the model gets the
  *structure* wrong on most number-instantiations, so it is keying on surface
  values, not the underlying procedure. Others: `1021 5/8`, `11 6/8`, `458 6/8`.

**Read:** the 8B's grade-school arithmetic is *fairly* robust to surface changes
— not the catastrophic instability the GSM-Symbolic paper found in weaker/older
models. But the 6/20 minority is a genuine signal, not noise (template 99 flips
on 6 of 8 number changes).

## Difficulty probe — a steep, consistent fragility curve

Same templates, clauses added (`main` → `p1` +1 clause → `p2` +2 clauses):

| level | accuracy |
|-------|----------|
| main | 18/20 (90%) |
| p1 | 14/20 (70%) |
| p2 | 11/20 (55%) |

Paired (same templates), drops vs recoveries at each step:

| transition | right→wrong | recovered | McNemar p |
|---|---|---|---|
| main → p1 | 4 | 0 | 0.125 |
| main → p2 | 9 | 2 | 0.065 |
| p1 → p2 | 6 | 3 | 0.508 |

**Read:** the direction is unambiguous — every transition loses far more than it
recovers (4-0, then 9-2), and *zero* templates recover going main→p1. But at
**n=20 per level the formal significance is borderline** (main→p2 p=0.065). So:
a clear, consistent fragility trend, with significance that a larger run would
need to nail down. Honest confound: **p1/p2 are legitimately harder** (real extra
steps), so part of this drop is warranted — the unreleased GSM-NoOp control would
be needed to isolate pure fragility, and it is paper-only.

## The cleanest signal: depth, not numbers

Five templates that broke `main → p2` (**125, 232, 266, 473, 921**) were **8/8
stable in the variance probe.** So for these, the failure is *not* about the
specific numbers (the model handles all 8 number-variants at base difficulty) —
it is about **reasoning depth**: adding clauses breaks problems the model
otherwise solves perfectly. That is the GSM-Symbolic mechanism, and the same
"added complexity disproportionately breaks reasoning" theme as the walk-or-drive
/ HOB and prompt-complexity (#11) work.

## Honesty caveats

- **n=20 per difficulty level** is the dominant limitation — the curve is a
  convincing trend, not a p<0.05 result. A ~60-template run would settle it (cheap;
  the released set has 50 shared templates × 50 instances).
- **Difficulty ≠ pure fragility.** p1/p2 add real reasoning; the drop mixes
  "genuinely harder" with "fragile." Lean on the depth-vs-numbers observation
  above for the fragility claim, not the raw curve.
- **GSM-NoOp (irrelevant distractors) is not released** — the strongest version of
  this probe (a clause that *shouldn't* change the answer) can't be run on public
  data.

## What this means for the product

- **Single-step quantitative answers are reasonably trustworthy** (~91%, robust to
  surface changes). Gap Chat can surface simple arithmetic with modest confidence.
- **Do not lean on multi-step quantitative reasoning** — accuracy falls to ~55% by
  p2, and problems the model "knows" at base difficulty break when steps are
  added. For multi-step math, route to a tool/calculator or hedge, don't trust the
  model's chain.
- Reinforces the cross-suite theme: this 8B degrades sharply with added
  complexity — relevant to persona/prompt heaviness (sycophancy, #11) as well.
