# References — sycophancy harness

## Primary (this suite)

- **Sharma, Tong, et al. 2023 — *Towards Understanding Sycophancy in Language
  Models*. arXiv:2310.13548** (Anthropic). Verified 2026-06-18. Shows RLHF'd
  assistants systematically conform to a user's stated or implied view, including
  abandoning correct answers under content-free pushback ("are you sure?"), and
  traces it to human-preference data rewarding agreement.
  **Data RELEASED:** [github.com/meg-tong/sycophancy-eval](https://github.com/meg-tong/sycophancy-eval)
  — `datasets/{are_you_sure,answer,feedback}.jsonl`. This harness uses
  `are_you_sure.jsonl` (the auto-gradable MC challenge set).

## Method lineage (shared with the pragmatics harness)

- **LLMs Cannot Self-Correct Reasoning Yet — arXiv:2310.01798.** Scoped to
  *intrinsic* self-correction (a model grading itself). The `C_anchor` condition
  is deliberately NOT that: it gives a calibration *rule* and lets the model
  re-examine, rather than asking it to second-guess on command. The honest
  measurement is whether that rule reduces caving without inducing rigidity.

## Sibling eval-suite candidates (the leverage-ranked roadmap)

See `../pragmatics-harness/REFERENCES.md` for the full verified table. This suite
is item #1 (highest leverage: live chat-trust failure, released data, ties to the
persona finding in the pragmatics harness).

## Future extensions within sycophancy

- `answer.jsonl` — free-form QA biased by a user's stated (wrong) belief; needs a
  grader model or string-match gold, not just letter extraction.
- `feedback.jsonl` — does praise/criticism framing bias the model's assessment of
  an argument? No gold label; would need a paired-prompt delta design.
