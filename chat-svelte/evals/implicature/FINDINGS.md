# Findings — conversational implicature on the production Apertus 8B

Model: `swiss-ai/Apertus-1.5-8B-Instruct-sft-dpo-tools` (what Gap Chat serves).
Set: 160 balanced items from Ruis et al. 2022 (arXiv:2210.14986) `type_labels`
(80 particularised / 80 generalised; 80 yes / 80 no). Binary yes/no implicature.
Reference: chance 50%, majority-class (balanced) 50%, human **~86%**.

| cond | overall | particularised | generalised | needs_world |
|------|---------|----------------|-------------|-------------|
| A_zeroshot | 123/160 (**77%**) | 53/80 (66%) | 70/80 (88%) | 41/48 (85%) |
| B_fewshot | 131/160 (**82%**) | 60/80 (75%) | 71/80 (89%) | 42/48 (88%) |

## Headlines

1. **Apertus is a competent implicature reader — and that's the news.** 77%
   zero-shot is *well above chance* and far from the near-chance that Ruis 2022
   reported for base LLMs. The 2022 headline ("LLMs are NOT zero-shot
   communicators") does **not** hold for this 2026 instruction-tuned 8B. Reading
   indirect/polite answers is **not** a major failure mode for Gap Chat's model —
   the positive counterpart to the sycophancy result. (Consistent with the
   EleutherAI follow-up: instruction-tuning, which this sft-dpo checkpoint has,
   drives implicature competence.)

2. **Near-human on conventionalised implicature.** On `generalised` items
   (context-free, conventionalised — "all is good" → yes) the model hits **88-89%,
   essentially the ~86% human ceiling.** Few-shot adds nothing here (88→89) —
   already saturated.

3. **The whole residual gap is context-dependence.** `particularised` items
   (resolving needs the specific situation) are where it drops: **66% zero-shot.**
   This is the honest weak spot and it is the *right* one — particularised
   implicature is exactly what's hard about pragmatics.

4. **Few-shot helps where it should — but it's a TREND, not proven.** Examples lift
   overall 77→82% and particularised 66→75% (all the gain is in the hard class;
   generalised is saturated). But paired McNemar is **p=0.115** (14 few-only-right
   vs 6 zero-only-right) — directional and consistent, not significant at n=160.
   Do not ship "few-shot fixes implicature" as established. (Same discipline as the
   sycophancy-anchor and prompt-complexity calls.)

5. **World knowledge is not the bottleneck.** The 48 items that need factual
   knowledge to resolve score 85-88% — on par with overall. The model's gap is
   pragmatic context-tracking, not missing facts.

## Honesty caveats

- **n=160, balanced** — enough for the strong absolute claims (77% zero-shot, 88%
  generalised ≈ human) but the few-shot delta (p=0.115) needs a larger run to
  confirm. The full Ruis test set (~600) is available if we want significance.
- **No response bias gaming the balance:** predictions are ~balanced (77y/83n
  zero-shot), so the 77% is real competence, not an always-one-answer artifact on
  a balanced set.
- **Label = polarity** of the gold; a few gold strings carry trailing explanations
  but the first word disambiguates. Single model, single dataset.

## What this means for the product

- **Gap Chat can trust the model to read indirect answers** (polite hedges,
  understatement, conventionalised "no"s) — ~77-82%, near-human on the common
  conventionalised cases. Over-literalness is not a headline risk.
- **The weak spot is heavily context-dependent implicature** (66%). Mitigation is
  cheap and already native to chat: the conversation history *is* the context, and
  a couple of in-context examples lift the hard class ~9pp (trend). No weights work
  needed here — unlike sycophancy and the co-presence reasoning gap.
- Across the suite: this is the one clearly *reassuring* model-capability result.
  Implicature is a solved-enough problem for this 8B; spend the weights/distillation
  budget on the failures that aren't (sycophancy, co-presence reasoning).
