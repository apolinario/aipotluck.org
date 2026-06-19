# References — GSM-Symbolic harness

## Primary (this suite)

- **Mirzadeh, Alizadeh, Shah, Tuzel, Bengio & Farajtabar 2024 — *GSM-Symbolic:
  Understanding the Limitations of Mathematical Reasoning in Large Language
  Models*. arXiv:2410.05229** (Apple). Verified 2026-06-18. Generates symbolic
  templates from GSM8K so the same problem can be re-instantiated with different
  names/numbers; shows (a) accuracy varies across instances of one template —
  evidence of pattern-matching over reasoning — and (b) accuracy drops sharply as
  clauses are added, more than the added difficulty warrants. The strongest claim
  uses **GSM-NoOp** (irrelevant clauses), which is **paper-only / not released**.
  - **Data RELEASED:** [HF apple/GSM-Symbolic](https://huggingface.co/datasets/apple/GSM-Symbolic),
    configs `main` / `p1` / `p2`. License **CC-BY-NC-ND-4.0** (non-commercial,
    no-derivatives) — hence we commit no corpus content, only integer template ids.

## Mechanism lineage (shared with the pragmatics harness)

The "added surface complexity disproportionately breaks reasoning" mechanism is
the same one probed by:
- **HOB** (arXiv:2603.29025) — a surface heuristic overrides a world-model
  constraint (the walk-or-drive harness).
- **Prompt Complexity Dilutes Structured Reasoning** (arXiv:2603.13351) — a
  heavier prompt induces failures a lean prompt avoids (roadmap item #11).

GSM-Symbolic is the math-domain instance of the same family; this suite is the
released-data probe for it.

## Honesty note

- p1/p2 add *real* reasoning steps, so the difficulty curve mixes "genuinely
  harder" with "fragile" — do not read the drop as pure fragility.
- The variance probe is the cleaner robustness signal because difficulty is held
  fixed; lean on `unstable templates` for the robustness claim.
