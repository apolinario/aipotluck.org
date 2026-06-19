# Findings — citation-reason classification on the production Apertus 8B

Model: `swiss-ai/Apertus-1.5-8B-Instruct-sft-dpo-tools` (what Gap Chat serves).
Set: 240 statements (30 per category) from the real Redi et al. 2019 Citation
Reason corpus (figshare 7756226, CC-BY-SA; arXiv:1902.11116). Single-turn 8-way
classification; gold = majority of 3 human annotators. Reference lines: human
average inter-annotator agreement **~63%**, random (8-way) **12.5%**.

| cond | acc | acc_unanimous | macro_f1 | factual_vs_op | ungraded |
|------|-----|---------------|----------|---------------|----------|
| F_names | 49% | 62% (n=61) | 0.444 | **82%** (n=210) | 2 |
| F_defs | 52% | 72% (n=61) | 0.490 | **81%** (n=210) | 2 |

## Headlines

1. **The product-relevant routing decision works: ~82%.** Collapsing the 8 reasons
   to the distinction a provenance system actually acts on — *checkable fact*
   (retrieve & cite) vs *opinion/controversial* (attribute & hedge) — the model is
   right **82%** of the time, well above the 8-way accuracy and unchanged by
   definitions. This is the most on-mission number and the usable one: for
   deciding *how to ground a claim*, the model is good enough to drive routing.

2. **On unambiguous items it tracks the human consensus.** On the 61 items where
   all three annotators agreed, the model matches the consensus 62% (names) / 72%
   (defs). **Careful framing:** the ~63% "human agreement" is the *overall*
   inter-annotator rate across all items, NOT a clean head-to-head — on unanimous
   items humans agree 100% by definition. So this is "agrees with the clear-case
   consensus most of the time," NOT "beats humans." Still solid for a noisy 8-way
   task at 8B scale.

3. **Definitions help — but it's a TREND, not a proven effect.** Handing the model
   the codebook moves acc 49→52, unanimous 62→72, macro-F1 0.444→0.490, and
   defs-beats-names on more discordant items in both slices (21 vs 15 overall;
   8 vs 2 unanimous). But paired McNemar is **p=0.405 (all) / p=0.109 (unanimous)**
   — not significant. Direction is consistent and worth a larger run before
   claiming "give the model a provenance rubric"; do not ship it as established.
   (Same discipline that caught the sycophancy "anchor helps" mirage.)

4. **Strong where it counts, one systematic blind spot.** Per-category recall
   (F_names): `statistics 29/30` (near-perfect numeric-claim detection),
   `scientific 21/30`, `historical 21/30`, `controversial 15/30`, `opinion 16/30`
   — but **`private_life 0/30`**: the model never picks it, folding biographical
   facts (birth dates, relationships) into `historical` (17/30) or `scientific`/
   `opinion`. This is *partly defensible* — a birth date arguably IS a historical
   fact "not common knowledge," so the categories genuinely overlap — but it means
   the model has no separate notion of biographical-privacy provenance. The gap
   between macro-F1 (0.44) and accuracy (49%) is exactly this unevenness.

## Honesty caveats

- **Balanced set, not natural distribution.** We sampled 30/category so per-
  category recall is readable and random = 12.5%. Real Wikipedia is ~41%
  historical; on the natural distribution overall accuracy would look higher
  (historical/statistics are the model's strong suits) but that would hide the
  weak categories. The balanced view is the honest one.
- **8-way reason is inherently ambiguous** (a sentence can be historical *and*
  statistical). The ~63% human ceiling is the headline caveat — this is why the
  factual-vs-opinion collapse (#1) and the unanimous subset (#2) carry more
  weight than the raw 8-way accuracy.
- **n=61 unanimous** is modest; the clean-subset numbers are directional.
- **Single condition pair, single model.** No claim about other checkpoints.

## What this means for the product

- **Usable now for grounding-routing.** The factual-vs-attribution call (~82%) is
  reliable enough to drive the sycophancy "ground-on-challenge" mitigation and
  provenance display: classify a challenged/asserted claim, then retrieve-and-cite
  factual ones and attribute/hedge opinion ones. This is the concrete bridge
  between this suite and the sycophancy findings.
- **Don't rely on fine-grained 8-way** or on a separate private-life category;
  the model conflates biographical with historical.
- **Provide the rubric in-context if cheap** — the trend favours it, but measure
  on a larger set before treating it as a real lift.
- **Next measurement:** a larger run (~600) would settle the definitions effect;
  the binary Citation-Need task (needs negatives, not readily downloadable) would
  be the cleaner direct test of "does this need a source at all" if the data can
  be reconstructed.
