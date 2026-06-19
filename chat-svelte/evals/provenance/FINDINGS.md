# Findings — citation-reason classification (summary)

> The served model is evaluated here at a **high level only**. The full
> per-condition numbers, and the exact served checkpoint, live in the private
> `FINDINGS.local.md` (gitignored) — the model under test is a pre-release
> build, so the public tree does not name it or publish absolute scores.

**Method.** 240 statements (30 per category) from the real Redi et al. 2019
Citation Reason corpus (figshare 7756226, CC-BY-SA; arXiv:1902.11116).
Single-turn 8-way reason classification, gold = majority of 3 human
annotators, plus the collapsed checkable-fact-vs-opinion routing distinction
a provenance system actually acts on (retrieve-and-cite vs attribute-and-hedge).
Reference lines: human inter-annotator agreement and 8-way random baseline.
See `README.md` for the protocol and `REFERENCES.md` for the dataset.

**Directional read.**
- The product-relevant call — **checkable fact vs opinion/controversial** —
  works **well above the 8-way baseline** and is **usable for driving
  grounding-routing**: classify a challenged/asserted claim, then cite factual
  ones and hedge opinion ones. This is the concrete bridge to the sycophancy
  "ground-on-challenge" mitigation.
- On unambiguous items (where all three annotators agreed) the model
  **tracks the human consensus most of the time** — solid for a noisy 8-way
  task at 8B scale, though not a clean "beats humans" head-to-head.
- Handing the model the codebook **trends toward helping** across every slice,
  but the effect is **not statistically significant** — directional only, worth
  a larger run before treating it as established.
- **Raw 8-way reason is harder** and inherently ambiguous (a sentence can be
  historical *and* statistical); the model is strong on numeric/statistical and
  historical claims but has **one systematic blind spot** — it folds
  biographical/private-life facts into historical rather than treating them as
  a separate provenance category.
- Don't rely on the fine-grained 8-way labels or on a separate private-life
  category; the factual-vs-attribution collapse is the usable signal.
