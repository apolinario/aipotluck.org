# Ecosystem Mapping — Architecture & Design

## Purpose

Drive Current AI's technical roadmap. The roadmap is the headline output. Everything else is the data foundation that makes the roadmap defensible and lets others build on it.

**Design principle:** Every query in the framework below is a function over the data model. If we can't answer it from the underlying data, the data model is incomplete.

## Query Framework

### Tier 0 — Roadmap queries (the headline)

Directly produce or justify Current AI's technical roadmap.

| ID | Query | Status |
|----|-------|--------|
| 0.1 | **What would it take to ship?** Given a target product spec, return: minimum viable composition of open components, integration gaps, missing components, maintenance risks. The potluck thesis as a query. | Not started — requires Tier 1 composition data |
| 0.2 | **Where should Current AI invest next?** Rank candidates by: distance-to-closing-a-gap, leverage (downstream products), fragility reduction, dollar efficiency. Output: ranked, dated roadmap with traceable rationale. | Partially started — OSAI gap map scores + focus area mapping provide qualitative input |
| 0.3 | **Smallest credible end-to-end open stack for use case Y?** For a given use case (consumer assistant, sovereign deployment, scientific workflow): shoppable list of components, costs, integration work, named maintainers to fund. | Not started — requires Tier 1 |

### Tier 1 — Composition & substitutability (the hard part)

The market-map-of-logos problem. Repos are not products.

| ID | Query | Status |
|----|-------|--------|
| 1.1 | **Dependency graph, whitebox.** Actual code-level dependencies, transitively. | Done — `ai_dependency_graph` UDM: 25.7K edges (6.3K direct + 19.4K transitive depth-2) across 822→603 AI repos. Foundation projects identified. |
| 1.2 | **Dependency graph, blackbox / spec-level.** For a closed product: inferred functional dependencies. The "Kakashi" approach. | Not started |
| 1.3 | **Substitutability.** For any node X: viable alternatives, and for which use cases each wins. | Partial — `layer_mapping` notebook maps OSAI subcategories → repos. `model_repos` links HF models to GitHub repos with `base_model` lineage (6.3K models). |
| 1.4 | **Interoperability / integration cost.** For any two nodes: do they compose? Glue code required? Quantified where possible. The seam visibility existing maps miss. | Not started |
| 1.5 | **Off-the-shelf ceiling.** Best-of-breed open components assembled: how close to GPT-5/Claude/Gemini per capability? | Partial — `model_benchmarks` has Open LLM Leaderboard v2 scores (4.5K models, 6 benchmarks) with architecture and base_model metadata. Still qualitative for non-LLM capabilities. |

### Tier 2 — Gap & state-of-play (the diagnostic)

| ID | Query | Status |
|----|-------|--------|
| 2.1 | **Per-layer competitiveness.** Where is open source ahead, at parity, or behind — by stack layer and capability. | Done — gaps notebook health scatter, red spots, focus area coverage |
| 2.2 | **Openness depth.** Per node: weights/code/training data/methodology/evals — which are actually open, under what license, with what governance? Surfaces "open-washing." | Partial — OSAI gap map has 10 dimensions. GoodAI has license field. Not structured for per-repo openness audit. |
| 2.3 | **License & governance posture.** Apache vs AGPL vs source-available vs open-weights-closed-data. Critical for commercial and sovereign use. | Data exists (license field in GoodAI, HF tags) but not analyzed |

### Tier 3 — Fragility & people (what the map alone can't see)

| ID | Query | Status |
|----|-------|--------|
| 3.1 | **Maintainer health / bus factor.** Per node: active maintainers, funding sources, commit cadence, truck factor. The Log4Shell question. | Partial — `ai_repo_activity` has FT/PT contributors. Missing: funding sources, truck factor computation. |
| 3.2 | **Adversarial / fragility analysis.** Which 3–10 repos, if acquired-and-shuttered, would most damage the open AI stack? Names what to harden, fork, or duplicate. | Not started — requires Tier 1 dependency graph + maintainer data |
| 3.3 | **People graph.** Core researchers and devs by area: where they've been, where they are now, what they're shipping. Talent flow as leading indicator. | Started — 7,910 GitHub orgs/users with location and metadata. Missing: researcher-level, career flow. |

### Tier 4 — Onboarding (the on-ramp)

| ID | Query | Status |
|----|-------|--------|
| 4.1 | **Builder pathways.** For a dev: where to learn, build reputation, earn money. Hackathons, repos, labs, programs. | Not started |

---

## Data Model

### What we have

#### OSO Warehouse (queryable via SQL)

| Source | Table | Records | Refresh | Serves |
|--------|-------|---------|---------|--------|
| GoodAI List | `currentai.goodailist_repos.repos` | 15,396 repos | Manual upload | Base repo catalog |
| OSS Insights | `currentai.ossinsights_ai_collections.ossinsights_ai_collections` | 616 repos, 53 collections | Manual upload | Collection taxonomy |
| AI Repo Activity (UDM) | `currentai.ai_repo_activity.ai_repo_activity` | 15,375 repos | Daily | Stars, forks, contributors — single source of truth for notebooks |
| AI Monthly Devs (UDM) | `currentai.ai_monthly_devs.ai_monthly_devs` | ~24 rows | Daily | Monthly developer counts by category |
| AI Repo Packages (UDM) | `currentai.ai_repo_packages.ai_repo_packages` | 718K packages | Weekly | Package-level dependencies (Tier 1.1) |
| AI Dependency Graph (UDM) | `currentai.ai_dependency_graph.ai_dependency_graph` | 25.7K edges | Weekly | Transitive AI→AI deps, depth 1+2 (Tier 1.1) |
| Model Benchmarks | `currentai.model_benchmarks.model_benchmarks` | 4,576 models | Manual upload | Open LLM Leaderboard v2 (Tier 1.5) |
| Model Repos | `currentai.model_repos.model_repos` | 6,349 models | Manual upload | HF model → GitHub repo links (Tier 1.3) |
| OSO Public | `oso.*` | Projects, artifacts, dev metrics, events | Continuous | GitHub events, OpenDevData, funding |

#### Local CSVs (`data/`)

| Source | Path | Records | Serves |
|--------|------|---------|--------|
| OSAI Gap Map | `data/osai-gap-map/scores.csv` | 41 subcats × 10 dimensions | Tier 2 qualitative scores |
| Hugging Face | `data/huggingface/top_models.csv` | 1K models | Model catalog |
| Hugging Face | `data/huggingface/top_datasets.csv` | 1K datasets | Dataset catalog |
| Hugging Face | `data/huggingface/tracked_models.csv` | 973 models | Models linked to tracked repos |
| Hugging Face | `data/huggingface/tracked_datasets.csv` | 98 datasets | Datasets linked to tracked repos |
| Hugging Face | `data/huggingface/model_benchmarks.csv` | 4,576 models | Open LLM Leaderboard v2 scores |
| Hugging Face | `data/huggingface/model_repos.csv` | 6,349 models | HF model → GitHub repo + base_model links |
| AI Incidents | `data/ai-incidents/incidents.csv` | 1,460 incidents | Safety/safeguards (Tier 2) |
| GitHub Orgs | `data/github-orgs/orgs.csv` | 7,910 orgs/users | Geography, org metadata (Tier 3.3) |
| GoodAI Enrichment | `data/goodailist/repos_tags.csv` | 46K tag assignments | Functional tagging |
| GoodAI Enrichment | `data/goodailist/repos_descriptions.csv` | 14K descriptions | Project understanding |
| GoodAI Enrichment | `data/goodailist/subcategory_breakdown.csv` | 105 subcats | Taxonomy structure |

### What's missing (by tier)

**Tier 0 — Roadmap:**
- Product spec decomposition framework (what components does a "Claude-equivalent" require?)
- Cost/effort estimation model for integration work
- Dollar efficiency model for grant allocation

**Tier 1 — Composition:**
- ~~Transitive dependency graphs~~ → Done: `ai_dependency_graph` UDM (depth-2, 25.7K edges)
- ~~Model benchmarks~~ → Done: `model_benchmarks` (4.5K models, Open LLM Leaderboard v2)
- ~~Model → repo links~~ → Done: `model_repos` (6.3K models with base_model + GitHub links)
- SBOM coverage gap: only 6% of AI repos have SBOM data (PIP especially thin)
- Functional decomposition of closed products (the "Kakashi" spec-level graph)
- Substitutability matrix (which repos can replace which, under what constraints)
- Integration cost data (hours/lines/forks between components)
- Non-LLM benchmarks (vision, speech, code, embedding — not in Open LLM Leaderboard)

**Tier 2 — Gaps:**
- Per-repo openness audit (weights open? training data open? methodology open?)
- Structured license analysis (beyond the raw license string)
- Governance structure data (foundation-backed? corporate-controlled? community?)

**Tier 3 — Fragility:**
- Funding source data per project (who funds the maintainers?)
- Truck factor computation (how many people leaving would kill the project?)
- Researcher/developer career flow data (where did they come from, where are they going?)
- Acquisition history (hyperscaler acquisitions of AI teams/companies)

**Tier 4 — Onboarding:**
- Hackathon/program database
- Learning pathway curation
- Reputation/contribution pathway mapping

---

## Two Taxonomies

The ecosystem has two classification systems that remain separate lenses:

**GoodAI taxonomy** (quantitative lens)
- 8 top-level categories: Infrastructure, AI Engineering, Model Development, Applications, Models, Tutorials, Lists, Misc
- 284 subcategories with repo-level data
- Powers: repo counts, star velocity, contributor depth, geographic filtering

**OSAI gap map taxonomy** (qualitative lens, editorial backbone)
- 7 layers: Infrastructure, Model Components (Datasets/Code/Weights), Product/UX, Documentation, Licensing, Safeguards
- 41 subcategories scored on 10 dimensions (1-5)
- Powers: the website's stack view, health scores, parity verdicts, roadmap prioritization

The `layer_mapping` notebook contains the manual mapping between them. The website uses OSAI layers as the editorial structure, with GoodAI data powering discovery and drill-downs behind each subcategory.

---

## Project Structure

```
ecosystem-mapping/
├── app/                           # Website (Vite + vanilla JS, pnpm)
│   ├── index.html
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── app.js
│       ├── data.js                # Hand-curated → eventually data.generated.js
│       └── style.css
├── data/                          # Raw external CSVs, per-source subdirectories
│   ├── huggingface/
│   ├── osai-gap-map/
│   ├── ai-incidents/
│   ├── github-orgs/
│   └── goodailist/
├── models/                        # UDM SQL source (deployed to currentai org)
│   ├── ai_repo_activity.sql
│   ├── ai_monthly_devs.sql
│   └── ai_repo_packages.sql
├── notebooks/                     # Marimo notebooks
│   ├── oss_ai_trends.py           # Developer activity & momentum
│   ├── oss_ai_gaps.py             # Gap analysis & focus areas
│   ├── france_ecosystem.py        # Geographic filter (France)
│   ├── layer_mapping.py           # OSAI → GoodAI taxonomy mapping
│   ├── taxonomy_mapping.py        # Taxonomy overlap exploration
│   └── data_inventory.py          # Source coverage & overlap
├── scripts/                       # Python CLI tools
│   ├── query.py                   # Ad-hoc SQL queries
│   ├── export_notebooks.py        # Notebook → HTML export
│   ├── fetch_goodailist.py        # Scrape GoodAI List API
│   ├── fetch_github_ai_repos.py   # GitHub Search for AI repos
│   ├── fetch_github_orgs.py       # GitHub org/user metadata
│   ├── fetch_huggingface.py       # HF models & datasets
│   └── fetch_incidents.py         # AI Incident Database
├── docs/
│   ├── specs/                     # Design specs (YYYY-MM-DD-topic.md)
│   ├── plans/                     # Implementation plans
│   ├── sessions/                  # Session logs (YYYY-MM-DD-topic.md)
│   ├── guides/                    # Query + notebook guides
│   └── analysis-router.md         # Analysis routing and persona guidance
├── pyproject.toml
├── CLAUDE.md
└── README.md
```

---

## Data Flow

```
External sources              OSO Warehouse (currentai.*, oso.*)
(APIs, CSVs, scraping)        (static models, UDMs, public tables)
        │                              │
        ▼                              ▼
    data/ CSVs                   notebooks/
    scripts/fetch_*         (query UDMs, load CSVs, analyze)
        │                              │
        ▼                         ┌────┼────┐
    models/ SQL ──────────▶  UDMs back  │  app/src/
    (deployed via MCP)       to OSO     │  data.generated.js
                                        │
                                   docs/ methodology
```

Notebooks are the authoritative source for all computed data. UDMs pre-compute expensive joins so notebooks load fast. The website reads either hand-curated or generated data.

---

## Notebook Style

All notebooks follow `docs/guides/currentai-notebooks.md`:
- F/C/LAYOUT constants (Fraunces, Inter, JetBrains Mono; paper/ink/signal/healthy/warm palette)
- Numbered section headers with styled eyebrows
- Health color encoding (≥70 healthy, 45-69 fragile, <45 gap)
- `displayModeBar: False` on all charts
- Explorer card pattern for interactive sections (dropdowns + results as connected card)
- Methodology footer with source links
- Must pass both `check_notebook.py` and `marimo check`

---

## What's Next

### Immediate
1. ~~Exploratory analysis per tier~~ → Done: `tier_data_audit.py` notebook
2. Build notebooks on the new UDMs — fragility dashboard, investment ranking visualization
3. Update hosted notebooks (deploy restyled trends + gaps to oso.xyz)
4. Build `publish_data.py` to bridge notebooks → website
5. Add missing orgs to catalog (Stability AI, BAAI, CompVis, Black Forest Labs, Coqui) — see `docs/catalog-gaps.md`

### Medium-term
6. ~~Tier 1 dependency graph~~ → Done: `ai_dependency_graph` UDM (25.7K edges)
7. ~~Tier 1 model benchmarks~~ → Done: `model_benchmarks` + `foundation_model_repos` (72 families)
8. ~~Tier 3 fragility~~ → Done: `ai_fragility_scores` UDM
9. ~~Tier 0 investment ranking~~ → Done (v1): `ai_investment_ranking` UDM
10. Refine subcategory mapping (OSAI→GoodAI) — current mapping is approximate
11. Non-LLM benchmarks (vision, embedding, speech, code) — Open LLM Leaderboard only covers text
12. Tier 2 structured openness audit — per-repo license/governance analysis
13. Geographic filtering on the website (any country, not just France)
14. Acquisition history dataset

### Long-term
15. Tier 0 product spec decomposition ("what does a Claude-equivalent require?")
16. Substitutability matrix (functional-equivalence, not just category membership)
17. Integration cost data (API surface analysis or developer surveys)
18. Crowdsource section connected to real backend
19. Builder pathway curation (Tier 4)
20. Continuously-updated live map replacing the static prototype
