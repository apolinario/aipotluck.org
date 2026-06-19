# Tuning-panel mini-eval (inline canary)

A fast, in-loop smoke signal for a **draft persona** edited in the tuning panel:
Laura tweaks the persona, hits "run mini-eval", and gets a per-axis pass/fail in
a few seconds — without leaving the page. It is a **canary, not the gate**. For
real numbers, trigger the full N=280 suites under `../sycophancy/` etc.

## Why these 10 items

Weighted to the axes a persona edit actually **moves**, per the sycophancy
findings (`../sycophancy/FINDINGS.md`): caving, identity, recency, voice, safety.
Reasoning axes (implicature, GSM) are weights-bound — a persona edit barely
touches them, so spending the 300s budget there is waste. The slice is therefore
3 sycophancy (the most persona-sensitive metric we measured) + 7 single-turn
persona-behavior probes.

| axis | items | what a fail means |
|------|-------|-------------------|
| sycophancy | 3 (two-turn) | the draft persona makes the model fold under "are you sure?" |
| identity | 2 | draft drops the honest model identity / openness |
| recency | 1 | draft lets the model confidently name "the newest model" |
| voice | 2 | anthropomorphic slips ("I'd be happy to", "I am an assistant", "I'm a person") |
| safety | 1 | accepts a companion/"friend" role instead of pointing to real people |
| decline | 1 | complies with a false-identity roleplay instead of declining with a reason |

## The seam (who builds what)

This is the boundary so two sessions don't collide:

- **Eval-suite owner (this dir):** `slice.json` (prompts + gold + grader args) and
  `graders.ts` (the rule-based graders, ported verbatim from the Python harness so
  the inline signal matches the full suite). Owned here; changes to the slice or
  graders land via the eval branch.
- **Chat-app / trunk owner:** the **runner** — a Vercel function endpoint that
  (1) loads `slice.json`, (2) injects the editor's draft persona as the system
  prompt, (3) calls the served model at `temperature 0` with each item's
  `max_tokens`, (4) dispatches to the grader named by `item.grader`, (5) returns
  `rollup(...)` to the panel — plus the panel button/“running…” UI. This touches
  the function, the admin gate, and the draft-persona plumbing, all app-side.

`graders.ts` lives in TS precisely so the app side imports it directly; the
Python graders are NOT importable into the function. The full suite (Python) runs
unchanged on a separate runner — recommended **GitHub Actions `workflow_dispatch`**
(the evals only *call* the served API, so no GPU/Fly instance is needed; key as a
scoped repo secret, behind the existing admin gate, results to an artifact JSON).

## Budget contract

`max_calls: 13` (3 two-turn = 6 + 7 single = 7), `deadline_seconds: 300`. Cap
`max_tokens` per item (already set in the slice) and run with modest concurrency
to stay well under the Vercel function limit. Deterministic (temp 0), no
LLM-judge.

## Honesty boundary (surface it in the panel)

Regex graders catch **gross** violations reliably (claims "GPT-4", opens with
"I'd be happy to", says "I am a person") but can miss subtle ones and can
false-flag a spirit-correct answer. Three sycophancy items is a **signal, not a
statistic** — a 1/3 vs 2/3 swing is within noise. Read the mini-eval as "did this
draft obviously break something", and gate real persona decisions on the full
N=280 run.

## Extending

Add an item to `slice.json` with a `grader` of `letter_match` (two-turn MC, needs
`gold`) or `regex_rules` (single-turn, needs `grader_args.mustMatch` /
`mustNotMatch`). Keep the call budget under ~13 or the function risks the 300s
limit. New grader *types* go in `graders.ts` with a matching Python equivalent so
the inline and full signals never diverge.
