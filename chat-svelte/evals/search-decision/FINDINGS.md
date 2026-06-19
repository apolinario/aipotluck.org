# Search-decision eval

Measures whether the chat decides to run an open-web search when a query needs current
or external information, and skips it otherwise. The decision quality determines both
answer accuracy (missing a search → stale answer) and cost (searching needlessly → wasted
latency and noisy sources).

## Method

- **Model:** Apertus-1.5-8B-Instruct-sft-dpo-tools, served via CSCS.
- **Sets:** `cases.jsonl` (40 labeled queries, used to develop the heuristic) and
  `cases_holdout.jsonl` (40 independent queries written without reference to the heuristic
  internals — the trustworthy generalization measure).
- **Buckets:** `recency_worded` (needs search, contains a recency word), `recency_unworded`
  (needs search, no recency word), `timeless` (no search), `timeless_spicy` (no search, but
  contains a trap word such as "current"/"status"/"latest" in a coding context).
- **Metrics:** recall = fraction of needs-search queries that searched; specificity =
  fraction of no-search queries correctly skipped.

Run: `npx vite-node run.ts` (in-sample) or
`npx vite-node run.ts --cases cases_holdout.jsonl --conditions heuristic,heur_denoise,heur_denoise_plus,bare_tool`.

## Conditions

- `heuristic` — the production recency regex (`isRecencyQuery`), no model call.
- `heur_denoise` — the regex, suppressed on coding/technical how-tos.
- `heur_denoise_plus` — `heur_denoise` plus volatile-entity patterns (CEO/PM/population…).
- `bare_tool` — the model decides via a `web_search` tool call on a bare prompt (the
  `decideSearchViaTool` path).
- `persona_tool` — the same tool call, but under the full chat persona system prompt.
- `denoise∪bare`, `denoise+∪bare` — the de-noised heuristic OR the bare model (the
  `model` strategy: regex fast-path, model when it abstains).

## Results (held-out is authoritative)

| condition          | in-sample acc | held-out acc | notes |
|--------------------|---------------|--------------|-------|
| heuristic          | 55%           | 50%          | leaky + noisy |
| bare_tool (model)  | 83%           | **85%**      | generalizes |
| persona_tool       | 50%           | —            | 0% recall (see below) |
| heur_denoise       | 75%           | 60%          | tuned to in-sample |
| heur_denoise_plus  | 88%           | 63%          | entity patterns do not generalize |
| denoise∪bare       | 90%           | 85%          | model-carried |
| denoise+∪bare      | 93%           | 88%          | model-carried |

## Findings

1. **The persona suppresses the model's tool-calling.** `persona_tool` scored 0% recall —
   the model never emitted a `web_search` call under the full system prompt, even for
   queries like "current price of Bitcoin". On a bare prompt the same model scores 85%.
   Ablation (stripping persona paragraphs, see git history) recovered only partially: even
   reduced to a single intro sentence, recall capped at 35%. The persona is load-bearing
   for answer honesty and cannot be stripped to recover the decision. Implication: a
   search/tool decision must be made on a clean prompt, not in-context under the persona.

2. **The model decision generalizes; hand-tuned regex rules do not.** `bare_tool` held at
   85% on the held-out set. The de-noised heuristic dropped from 88% to 63%: its keyword
   list leaks on tools it does not enumerate, and the volatile-entity patterns miss
   entities they were not written for. Specificity for the persona/heuristic variants
   stays high — the regex only ever *reduces* searching, never adds false positives beyond
   the trap-word cases.

3. **The de-noise filter is a net improvement as a fast-path, not a replacement.** On both
   sets, removing the recency signal for coding/technical how-tos lifts specificity (it
   stops searching on "current date in Python", "git status"). Its keyword coverage will
   always leak on unfamiliar tools, and it occasionally over-suppresses genuine
   tech-recency ("latest Node.js release"); in the `model` strategy the classifier catches
   those, so the cost is bounded.

## Recommendation

Use the model decision (`decideSearchViaTool` / `classifySearchNeed`, ~85%, robust) with
the de-noised recency heuristic as a free fast-path, and cross-encoder reranking
downstream. Do not hard-code volatile-entity patterns (they do not generalize). The
de-noise filter is implemented in `src/lib/search/recency.ts` (`isRecencyQueryDenoised`).
Re-run this eval after any model or system-prompt change.
