# Findings — search-decision (summary)

**Update 2026-06-20 — margin-gate chosen for Apertus-70B-Instruct-2509 (released model).**
With the alpha on the released 70B (weak at native tool-calling), we evaluated a margin-based
logprob gate: a yes/no classifier whose decision is read from the first-token `top_logprobs`
margin P(yes)−P(no) (no tool-calling — just logprobs, confirmed on CSCS-direct + HF router).
Headline: the **margin gate generalizes; the regex configs overfit.** On the held-out set the
margin gate (threshold −0.75) reached the highest recall that still holds 100% specificity, and
held-out ≥ in-sample (the opposite of the regex configs, whose recall dropped sharply on unseen
queries). The plain recency regex was weakest on both sets, and OR-ing it with the margin gate
collapsed specificity — so the production `margin` strategy uses the margin verdict as the
PRIMARY decider, NOT OR'd with the regex; the recency heuristic is only an on-error fallback.
Tunable via `SEARCH_MARGIN_THRESHOLD` (lower = more recall). Reproduce:
`npx vite-node evals/search-decision/run.ts` (+ `--cases cases_holdout.jsonl`).

> The served model is evaluated here at a **high level only**. The full
> per-condition numbers, and the exact served checkpoint, live in the private
> `FINDINGS.local.md` (gitignored) — the model under test is a pre-release
> build, so the public tree does not name it or publish absolute scores.

**Method.** A labeled in-sample query set develops the heuristic, and an
independent holdout set (written without reference to the heuristic internals)
measures generalization. Queries are bucketed by whether they need a search and
whether they carry a recency word or a coding-context trap word. We report
recall (needs-search queries that searched) vs specificity (no-search queries
correctly skipped) across heuristic conditions and a model tool-call decision.
See `README.md` for the protocol and conditions.

**Directional read.**
- The de-noised recency heuristic achieves strong recall and specificity on the
  holdout set — it is a solid free fast-path that reduces searching, rarely
  adding false positives.
- Trap words like "current"/"status"/"latest" in a coding context (e.g.
  "current date in Python", "git status") are the main failure bucket;
  suppressing the recency signal for technical how-tos is the key specificity
  win.
- Hand-tuned keyword and volatile-entity patterns do **not** generalize — they
  leak on tools and entities they were not written for. The served model's
  clean-prompt tool-call decision generalizes from in-sample to holdout where
  the regex rules degrade.
- The chat persona suppresses the served model's tool-calling: under the full
  system prompt the model rarely emits a search call, even for clearly
  time-sensitive queries. The search/tool decision must be made on a clean
  prompt, not in-context under the persona.
