# References — implicature harness

## Primary (this suite)

- **Ruis, Khan, Biderman, Hooker, Rocktäschel & Grefenstette 2022 — *Large
  Language Models are Not Zero-Shot Communicators*. arXiv:2210.14986** (NeurIPS
  2023). Verified 2026-06-18. A binary implicature benchmark: a context question +
  an indirect response, resolve to the implicated Yes/No. Finding: base LLMs are
  near chance zero-shot; few-shot examples and instruction-tuning close much of
  the gap; humans ~86%. A generalised/particularised type taxonomy distinguishes
  context-free conventionalised implicatures from context-dependent ones.
  - **Data RELEASED:** [github.com/LauraRuis/do-pigs-fly](https://github.com/LauraRuis/do-pigs-fly)
    (`data/type_labels.csv`, `dev_conversational_implicatures.csv`). No explicit
    license in-repo → we commit no corpus, only integer row indices.

## Follow-ups worth tracking

- **EleutherAI, *The Goldilocks of Pragmatic Understanding: Fine-Tuning Strategy
  Matters for Implicature Resolution by LLMs*** — instruction-tuning, not scale,
  drives implicature competence. Relevant if we revisit the weights vs scaffolding
  question for this 8B.
- **"Manner implicatures in large language models"** (Nature Scientific Reports
  2024, s41598-024-80571-3) — a narrower 2024 instrument focused on the manner
  maxim; a possible extension to this suite if we want maxim-specific coverage.

## Honesty note

- Few-shot exemplars are drawn from the DEV split, never the test items — no
  leakage.
- The label is the polarity (Yes/No) of the gold; a handful of gold strings carry
  trailing explanations, but the first word always disambiguates.
- Particularised (context-dependent) items are the real test of pragmatic
  competence; lean on the per-type split, not just the overall number.
