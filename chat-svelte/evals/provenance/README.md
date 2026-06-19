# Provenance harness — citation-reason classification

Can Apertus (the production Gap Chat 8B) identify **why** a claim needs a
source? Given a statement, is it a statistic, a scientific claim, an opinion, a
direct quotation, a historical fact…? That judgment is the routing decision a
provenance product depends on: opinion → attribute & hedge; scientific/statistic
→ retrieve & cite; controversial → flag. It also feeds the sycophancy
"ground-on-challenge" mitigation — you ground exactly the claim types this
classifies as factual.

Third eval suite in the same pattern as `../pragmatics-harness` and
`../sycophancy-harness`: verify released data → curate an auto-gradable set →
baseline conditions → an **honest** scoreboard (not bare accuracy).

## Source (released data)

Redi, Fetahu, Morgan & Taraborelli 2019, *Citation Needed: A Taxonomy and
Algorithmic Assessment of Wikipedia's Verifiability* (WWW '19; arXiv:1902.11116).
The **Citation Reason corpus** (figshare 7756226, CC-BY-SA, derived from English
Wikipedia Featured Articles) — ~3,820 statements that contain a citation, each
labeled by 3 annotators with one of 8 reason categories.

We do **not** commit the 1.9 MB raw CSV. `build_set.py` samples a stratified,
deterministic 240-item slice (30 per category) into our own schema
(`scenarios_prov.jsonl`, committed, attributed) and records each item's
annotator agreement (3/3 unanimous vs 2/1 split).

## The taxonomy (label space, not injected world-knowledge)

8 "citation needed" reasons from Redi Table 1: `quotation, statistics,
controversial, opinion, private_life, scientific, historical, other`. Giving the
model the set of categories it chooses among is legitimate — it still has to map
each statement to a category itself. `taxonomy.py` holds the verbatim codebook.

## Conditions

| id | prompt shows |
|----|----|
| `F_names` | category **names only** — does the model hold the provenance taxonomy latently? |
| `F_defs` | names **+ definitions** — does handing it the rubric help? |

The `F_names` → `F_defs` delta answers a real product question: must we give the
model an explicit provenance rubric, or has it internalised the categories?

## Why bare accuracy lies here (the honesty guards)

This is a **noisy human-labeled** task: Redi report ~63% average inter-annotator
agreement (highest on historical/quotation/scientific, lowest on opinion). So the
scoreboard reports:

- `acc` — overall (gold = annotator majority)
- `acc_unanimous` — accuracy on the 3/3-agreement subset (the **clean** signal)
- `macro_f1` — mean per-category F1, which **exposes majority-class collapse**
  (a model that always guesses one category scores high accuracy on an unbalanced
  set but low macro-F1; our set is balanced 30/cat, so random = 12.5%)
- `factual_vs_op` — accuracy of the **product-relevant collapse**
  (checkable-fact vs opinion/controversial), the routing decision that matters

Reference lines printed every run: **human ~63%**, random (8-way) **12.5%**. A
model number means nothing without them.

## Run

```
export CSCS_SERVING_API=<your CSCS serving key>
python build_set.py            # (re)build scenarios_prov.jsonl from cached raw
python run.py                  # both conditions, full set
python run.py --confusion      # add a confusion matrix
python run.py --trace scientific_00
```

Single-turn, deterministic (temperature 0), cached via the shared
`../pragmatics-harness/cscs_client.py` (one client, one key).

See `FINDINGS.md` for results and `REFERENCES.md` for the annotated citation.
