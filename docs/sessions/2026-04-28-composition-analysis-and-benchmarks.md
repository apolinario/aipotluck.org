# Session Log — 2026-04-28/29

Built the composition and analysis layer on top of the data foundation from session 1 (`docs/sessions/2026-04-27-ecosystem-mapping-initialization.md`). Focus: Tier 1 (dependencies/composition), model benchmarks, and the "almost answerable" Tier 0 queries.

## What we built

### New UDMs (4)

| Model | Table | Schedule | Rows | Purpose |
|-------|-------|----------|------|---------|
| ai_dependency_graph | `currentai.ai_dependency_graph.ai_dependency_graph` | Weekly Mon 6am | 25,733 | Transitive AI→AI dependency graph (depth 2) |
| ai_fragility_scores | `currentai.ai_fragility_scores.ai_fragility_scores` | Weekly Mon 7am | 603 | Dependency reach × maintainer capacity |
| ai_investment_ranking | `currentai.ai_investment_ranking.ai_investment_ranking` | Weekly Mon 7am | 42 | Composite investment ranking per OSAI subcategory |

### New static models (6)

| Model | Table | Rows | Purpose |
|-------|-------|------|---------|
| model_benchmarks | `currentai.model_benchmarks.model_benchmarks` | 4,576 | Open LLM Leaderboard v2 (6 benchmarks) |
| model_repos | `currentai.model_repos.model_repos` | 6,349 | HF model → GitHub repo + base_model links |
| foundation_model_repos | `currentai.foundation_model_repos.foundation_model_repos` | 72 | Curated model family → canonical repo (11 categories) |
| osai_gap_map | `currentai.osai_gap_map.osai_gap_map` | 42 | Qualitative gap scores (was local CSV only) |
| taxonomy_crosswalk | `currentai.taxonomy_crosswalk.taxonomy_crosswalk` | 11 | OSAI layer → GoodAI category bridge |
| osai_subcategory_mapping | `currentai.osai_subcategory_mapping.osai_subcategory_mapping` | 42 | OSAI subcategory → GoodAI subcategory bridge |

### New notebooks (1)

| Notebook | Purpose |
|----------|---------|
| tier_data_audit.py | Audit data availability across all 4 tiers; uses ai_dependency_graph UDM with foundation projects chart, hidden pillars, cross-category heatmap, and dependency explorer |

### New scripts (1)

| Script | Purpose |
|--------|---------|
| fetch_model_benchmarks.py | Fetches Open LLM Leaderboard + HF model→repo links (requires HF_TOKEN for full metadata) |

### New data files (4)

| File | Rows | Purpose |
|------|------|---------|
| data/huggingface/model_benchmarks.csv | 4,576 | Open LLM Leaderboard v2 scores |
| data/huggingface/model_repos.csv | 6,349 | HF model → GitHub repo links |
| data/huggingface/foundation_model_repos.csv | 72 | Curated foundation model families |
| data/osai_subcategory_repos.csv | 42 | OSAI subcategory → GoodAI subcategory mapping |

### Documentation updates

- `models/README.md` — full registry with example join queries
- `docs/specs/2026-04-27-ecosystem-mapping-design.md` — updated Tier 1 statuses, data model section, missing data section
- `docs/catalog-gaps.md` — NEW: missing orgs, repos, and model families not in our catalog

## Key findings

### Dependency graph
- 25,733 edges (6,350 direct + 19,383 transitive depth-2) across 822→603 AI repos
- Foundation projects: pandas (658 dependents), scikit-learn (582), pytorch (535), transformers (499)
- **Hidden pillars** revealed by transitive analysis: opt_einsum (980 stars, 421 dependents), jaxtyping (1.8K stars, 401 dependents), cuda-python (3.2K stars, 378 dependents) — invisible infrastructure with massive downstream reach

### Fragility hotspots
- jaxtyping: fragility score 100.25 (401 dependents, 4 contributors)
- openai/gym: 35.67 (107 dependents, 3 contributors — maintenance mode)
- seqeval: 24.4 (244 dependents, 10 contributors)
- tensorboard: 18.62 (484 dependents, 26 contributors)

### Model benchmarks
- 4,576 models on Open LLM Leaderboard v2
- Best open: Qwen2.5-72B-Instruct (avg 48.0), Mistral-Large (46.5), Llama-3.3-70B (44.8)
- Most-forked base: Qwen2.5-0.5B (114 derivatives), Llama-3.1-8B (62), Qwen2.5-14B (30)

### Foundation model mapping
- 72 families across 11 categories (LLM, vision, embedding, speech, NLP, code, image-gen, infra, sdk, science, time-series)
- 68/72 verified against repo catalog
- 4 gaps: RWKV, BGE/BAAI, E5/intfloat, Stability AI — missing from upstream GoodAI catalog

### Investment ranking
- Top priority areas: Model Architecture (composite 70.3) and Communication Libs (70.3) — both driven by pytorch ecosystem fragility
- Hardware Chips highest gap_urgency (75) but lower dep_centrality
- Safeguards and Documentation layers have limited repo coverage

## Design decisions
- Depth 3 transitive closure exceeds Trino's 15GB memory limit → capped at depth 2
- Foundation model → repo mapping is deterministic/curated, not fuzzy-matched
- Investment ranking uses subcategory-level taxonomy crosswalk (not layer-level) for granular differentiation
- Composite score double-weights gap_urgency (appears twice in formula) — intentional: gap closure is the primary objective

## Current data schema

15 queryable tables across 3 layers:

**UDMs (7):** ai_repo_activity, ai_monthly_devs, ai_repo_packages, ai_dependency_graph, ai_fragility_scores, ai_investment_ranking

**Static models (8):** goodailist_repos, ossinsights_ai_collections, model_benchmarks, model_repos, foundation_model_repos, osai_gap_map, taxonomy_crosswalk, osai_subcategory_mapping

**Plus:** oso.* public tables (continuous), 10 local CSVs in data/

## What's next

### Immediate
1. Build notebooks on top of the new UDMs — fragility dashboard, investment ranking visualization
2. Fix Q2 deduplication in benchmark queries (same model appears under multiple families)
3. Add missing orgs to catalog (Stability AI, BAAI, CompVis, Black Forest Labs, Coqui)

### Known limitations
- SBOM coverage: only 6% of AI repos have dependency data (PIP especially thin)
- Investment ranking: subcategory mapping is approximate — GoodAI subcategories don't perfectly align with OSAI subcategories
- Model → repo links: 741/6,349 models linked (HF API errors for gated/deleted models; most models legitimately don't declare base_model)
- Fragility scores use GoodAI contributor counts as fallback when OpenDevData is missing — less accurate

### Blocked
- Substitutability matrix (no functional-equivalence data)
- Integration cost (no API surface or developer survey data)
- Non-LLM benchmarks (vision, embedding, speech, code)
- Talent flow / researcher career data
- Product spec decomposition for Tier 0 queries ("what does a Claude-equivalent require?")

## Stats
- ~15 new commits worth of changes
- 7 new queryable tables deployed
- Total data: 15 tables, ~18M rows, 72 foundation model families, 42 subcategory rankings
