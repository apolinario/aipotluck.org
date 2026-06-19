# GSM-Symbolic harness — math-reasoning robustness

Is Apertus's (the production Gap Chat 8B) arithmetic reasoning **robust**, or does
it depend on the surface numbers? Two probes on Apple's released GSM-Symbolic:

1. **Variance** — give the model many instances of the *same* template (only
   names and numbers change, the structure is identical). A real reasoner is
   stable; a pattern-matcher swings. This is the cleanest robustness signal —
   **no difficulty confound**.
2. **Difficulty fragility** — the same templates at `main → p1 → p2` (each level
   adds a clause / reasoning step). Reports the accuracy curve as complexity
   grows — the same mechanism as the walk-or-drive / HOB and prompt-complexity
   work in `../pragmatics-harness`.

Fourth eval suite in the harness pattern.

## Source (released data)

Mirzadeh, Alizadeh, Shah, Tuzel, Bengio & Farajtabar 2024, *GSM-Symbolic:
Understanding the Limitations of Mathematical Reasoning in Large Language Models*
(Apple; arXiv:2410.05229). Data: [HF apple/GSM-Symbolic](https://huggingface.co/datasets/apple/GSM-Symbolic)
— `main` (100 templates × 50 instances), `p1` (+1 clause), `p2` (+2 clauses).

**LICENSE: CC-BY-NC-ND-4.0** (non-commercial, **no-derivatives**). So unlike the
other suites, **we do not commit the questions/answers.** `build_set.py` fetches
the raw jsonl into `.cache/` (gitignored) and writes the sampled scenarios there.
The only committed artifact is `selected_templates.json` — a list of integer
template ids — which is reproducible metadata, not the corpus.

> **GSM-NoOp is NOT released.** The paper's headline distractor variant — adding
> an *irrelevant* clause that shouldn't change the answer — is paper-only (same
> situation as HOB). So this suite measures variance + difficulty fragility on the
> released data, not the pure irrelevant-distractor effect.

## Conditions / probes

One solving condition (`A_solve`, chain-of-thought, ends with `#### <number>`);
the structure is in the scoring. Sample: 20 shared templates ×
8 `main` instances (variance) + instance 0 at `main/p1/p2` (difficulty).

## Scoring (honesty guards)

- **`unstable` templates** — neither all-right nor all-wrong across their
  instances. These are the smoking gun: same structure, different numbers,
  different correctness → the model is keying on surface values, not reasoning.
- **Difficulty curve** is reported as-is, with the explicit caveat that p1/p2 are
  *legitimately* harder, so some drop is warranted — we do **not** claim the drop
  is unjustified (that needs the unreleased GSM-NoOp control).

## Run

```
export CSCS_SERVING_API=<your CSCS serving key>
python build_set.py            # fetch + sample into .cache (gitignored)
python run.py                  # both probes
python run.py --trace var_473_0
```

Single-turn, deterministic (temperature 0), cached via the shared
`../pragmatics-harness/cscs_client.py`.

See `FINDINGS.md` for results and `REFERENCES.md` for the annotated citation.
