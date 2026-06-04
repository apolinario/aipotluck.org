# v3 Scoring Rubric — three axes

Every product carries three independent scores: **openness**, **adoption**, **capability**. They answer different questions (is it open? is it used? is it good?) and the map's insight is where they disagree. Every non-null score cites at least one verifiable source. Never infer a value — cite it or leave it null.

## Axis 1 — Openness (0–5 score + class)

Type-specific rubric; rolls up to a per-product score and a headline **class**, with the component breakdown retained for drill-down.

### Models — anchored on the Model Openness Framework (MOF, [arXiv:2403.13784](https://arxiv.org/abs/2403.13784))
Assess which MOF components are released under suitable open licenses (code → OSI-approved; data/parameters → CDLA/CC; docs → CC-BY). Headline class:

| Class | Test |
|---|---|
| `open_source` | OSI/open license **+ training code + training data** released (full pipeline reproducible) — ≈ MOF Class I/II |
| `open_weights` | Weights downloadable under a usable/open license, but training data and/or code closed |
| `restricted` | Weights available but under a non-OSI / use-restricted license (e.g. MAU caps, field-of-use limits) |
| `closed` | No downloadable weights |

Score 0–5 = count of released MOF components, weighted toward the high-signal four (weights, training code, training data, license). Components: model architecture · parameters (final/intermediate) · metadata · training code · inference code · evaluation code · data-preprocessing code · supporting libraries · datasets · evaluation data · technical report · research paper · model card · data card · evaluation results · sample outputs. Each released component needs a citable source. Undeterminable → `unknown` (never guessed).

### Software / tools — classic open source
| Class | Test |
|---|---|
| `open_source` | OSI-approved license + full source public |
| `source_available` | Source public but non-OSI / restrictive (BSL, SSPL, custom) |
| `open_core` | OSS core + proprietary/SaaS tier |
| `closed` | Proprietary / SaaS-only |

### Datasets — data openness
| Class | Test |
|---|---|
| `open` | Open data license (CDLA/CC/ODC) + downloadable + datasheet |
| `gated` | Access-request / partial |
| `documented_only` | Described but not redistributable |
| `closed` | Not available |

## Axis 2 — Adoption (1–5)
Real-usage scale. `signal_type ∈ {active_users, usage_volume, reported_traction, stars_fallback, unknown}`. GitHub stars are a last resort only — never push a product above level 3 on stars alone. Null + `unknown` where no honest signal exists.

| Level | Users | Label |
|---|---|---|
| 1 | <10K | Hobbyist |
| 2 | 10K–100K | Early adopters |
| 3 | 100K–1M | Medium |
| 4 | 1M–10M | Heavily trending |
| 5 | >10M | Mass market |

## Axis 3 — Capability (1–5, method-labeled)
`basis ∈ {benchmark:<name>, feature_matrix, n/a}`. Null allowed; never fabricated.
- **Benchmark-backed:** models → LMArena / MMLU-Pro / GPQA / SWE-bench; inference & training code → MLPerf; vector DBs → ANN-Benchmarks; coding agents → SWE-bench / GAIA; safety → HarmBench / ToxiGen.
- **Feature-matrix** where no benchmark exists (UI, telemetry, deployment, protocols): score against a defined, countable feature set, citing a source per claimed feature.
- **`n/a`** where capability isn't a meaningful axis (e.g. a wire protocol).

For the Product/UX shelves, capability is usually feature-matrix or `n/a` — openness and adoption carry the signal there, and the map's weighting control lets a viewer lean on the axes that are real for a given category.
