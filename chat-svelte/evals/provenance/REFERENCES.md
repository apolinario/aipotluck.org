# References — provenance harness

## Primary (this suite)

- **Redi, Fetahu, Morgan & Taraborelli 2019 — *Citation Needed: A Taxonomy and
  Algorithmic Assessment of Wikipedia's Verifiability*. WWW '19; arXiv:1902.11116.**
  Verified 2026-06-18 (taxonomy read from the paper PDF, Table 1). Defines two
  tasks — *Citation Need* (binary: does a sentence need a citation) and *Citation
  Reason* (8-way: why) — and crowdsources labeled corpora for both.
  - **Citation Reason corpus** (what we use): figshare 7756226, CC-BY-SA, ~3,820
    Featured-Article statements, 3 annotator votes each over 8 reason categories.
    Average inter-annotator agreement **~0.63** (random 1/8 = 0.125); highest on
    historical / quotation / scientific, lowest on opinion.
  - **Citation Need (binary) data** is NOT readily downloadable — reconstructed
    from Wikipedia dumps; the repo (github.com/mirrys/citation-needed-paper) ships
    only a tiny sample. That is why this suite does reason-classification (full
    real data) rather than binary needs-citation.

## Lifted from slimemold (own project, Apache-2.0)

The pointer to this dataset came via `slimemold/benchmarks/basis_classification/`
(`citation_reason.csv` + `fetch_samples.py`'s figshare URL). We **rejected**
slimemold's derived `samples.json` (49 items, mostly synthetic, self-labeled) as
circular and built directly on the real Redi corpus instead. The `phrasings.go`
failure taxonomy and `deliveryharness/grader.go` remain candidate lifts for
future graded (free-text) suites — to be entered as *scored* conditions, never
assumed wins.

## 2026 follow-up worth tracking

- **"Aligning Large Language Model Behavior with Human Citation Preferences"
  (arXiv:2602.05205)** — a 2026 paper directly on LLMs and citation/verifiability
  preferences. Not yet read in depth; flagged as a possible newer instrument or
  validation target for this suite. Verify-before-relying.

## Honesty note

Reason classification is inherently ambiguous (a sentence can be both historical
*and* statistical). The ~63% human ceiling is the headline caveat: report model
accuracy *against* it, and lean on the unanimous-subset accuracy and macro-F1
rather than the raw number.
