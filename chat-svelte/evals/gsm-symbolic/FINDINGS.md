# Findings — GSM-Symbolic robustness (summary)

> The served model is evaluated here at a **high level only**. The full
> per-template numbers, and the exact served checkpoint, live in the private
> `FINDINGS.local.md` (gitignored) — the model under test is a pre-release
> build, so the public tree does not name it or publish absolute scores.

**Method.** Apple GSM-Symbolic (arXiv:2410.05229), `main`/`p1`/`p2`. A
variance probe (same template, different names/numbers — a reasoner should be
stable) and a difficulty probe (added clauses). Single-turn chain-of-thought,
deterministic numeric grade. See `README.md` for the protocol and
`REFERENCES.md` for the dataset.

**Directional read.**
- The served model's grade-school arithmetic is **fairly robust** to surface
  (name/number) changes — *not* the catastrophic instability the GSM-Symbolic
  paper reported for weaker/older models.
- A **real minority** of templates are unstable across re-instantiations,
  indicating some keying on surface values rather than the underlying
  procedure — a genuine signal, not noise.
- Accuracy degrades with added distractor clauses, as expected.
