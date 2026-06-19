# Findings — conversational implicature (summary)

> The served model is evaluated here at a **high level only**. The full
> per-condition numbers, and the exact served checkpoint, live in the private
> `FINDINGS.local.md` (gitignored) — the model under test is a pre-release
> build, so the public tree does not name it or publish absolute scores.

**Method.** 160 balanced items from Ruis et al. 2022 (arXiv:2210.14986)
`type_labels` (80 particularised / 80 generalised; 80 yes / 80 no), binary
yes/no conversational implicature. Two prompting conditions — zero-shot and
few-shot — graded deterministically against gold polarity. References: chance
and balanced-majority are both 50%, human ~86%. See `README.md` for the
protocol and `REFERENCES.md` for the dataset.

**Directional read.**
- The served open 8B model is a **competent implicature reader**: zero-shot
  accuracy is **well above chance** and far from the near-chance the 2022 paper
  reported for base LLMs. The "LLMs are NOT zero-shot communicators" headline
  does **not** hold for this instruction-tuned model — reading indirect/polite
  answers is not a major failure mode.
- **Near-human on conventionalised (generalised) implicature** — essentially at
  the human ceiling, and already saturated, so few-shot adds nothing there.
- **Particularised implicature is the harder class** — items that need the
  specific situation to resolve are where it drops. The residual gap is
  pragmatic context-tracking, the right place for it to be hard.
- **Few-shot helps modestly**, concentrated entirely in the hard
  (particularised) class — but it reads as a **directional trend, not a
  significant effect** at this sample size; don't treat "few-shot fixes
  implicature" as established.
- **World knowledge is not the bottleneck** — items needing factual knowledge
  to resolve score on par with overall; the gap is context-tracking, not
  missing facts.
