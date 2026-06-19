# Implicature harness — conversational implicature (yes/no)

Does the served model (the production Gap Chat open 8B) understand **indirect
answers**?
*"Is Marci grumpy?" → "he's as gentle as a lamb"* implicates **No**. A model that
takes the response literally misses it — a live chat failure (over-literal
answers feel tone-deaf and miss what the user actually said).

Another eval suite in the harness pattern: verify released data → curate an
auto-gradable balanced set → zero-shot vs few-shot → honest scoreboard with the
human ceiling.

## Source (released data)

Ruis, Khan, Biderman, Hooker, Rocktäschel & Grefenstette 2022, *Large Language
Models are Not Zero-Shot Communicators* (arXiv:2210.14986). Data:
[github.com/LauraRuis/do-pigs-fly](https://github.com/LauraRuis/do-pigs-fly) —
`data/type_labels.csv` (annotated test subset, with a generalised/particularised
type taxonomy) and `dev_conversational_implicatures.csv` (few-shot pool).

**LICENSE: the repo ships no explicit license.** Conservatively we do **not**
commit the corpus — `build_set.py` fetches into `.cache/` (gitignored) and the
only committed artifact is `selected_indices.json` (integer row indices,
reproducible metadata).

## The set

160 items, fully balanced: 80 `particularised` (context-dependent — the hard
cases) / 80 `generalised`, and 80 yes / 80 no. Label = polarity (first word) of
the Implicature column. 48/160 additionally need world knowledge to resolve.

## Conditions

| id | what |
|----|----|
| `A_zeroshot` | the exchange + "what does the response imply, yes or no?" |
| `B_fewshot` | same, with 6 solved examples (3 yes / 3 no) from the **dev** split first |

Zero-shot vs few-shot is the headline axis: Ruis found base LLMs near chance
zero-shot, with few-shot closing much of the gap. The on-mission question is
whether Gap Chat's model needs examples to read indirect answers.

## Scoring (honesty guards)

Binary, so the reference lines carry the meaning:
- **chance 50%**, **majority-class 50%** (the set is balanced, so "always yes"
  scores 50% — no free lunch from a degenerate guess),
- **human ceiling ~86%** (Ruis et al.).
- Reported **per coarse type** (particularised vs generalised) and for the
  world-knowledge-needing subset, because particularised/context-heavy items are
  where pragmatic competence actually shows.

## Run

```
export CSCS_SERVING_API=<your CSCS serving key>
python build_set.py            # fetch + sample into .cache (gitignored)
python run.py                  # both conditions
python run.py --trace gene_yes_00
```

Single-turn, deterministic (temperature 0), cached via the shared
`../pragmatics/cscs_client.py`.

See `FINDINGS.md` for results and `REFERENCES.md` for the annotated citation.
