# Session Log — 2026-04-27/28

Initialized the `ecosystem-mapping` repo from scratch and built out the data foundation for Current AI's open-source AI market map.

## What we built

### Repository structure
- Scaffolded from empty repo → full monorepo with `app/` (Vite website), `notebooks/`, `models/`, `scripts/`, `data/`, `docs/` (`specs/`, `plans/`, `sessions/`, …)
- Website prototype implemented from Claude Design handoff (7-layer stack view, workflow view, matrix view, detail drawer, crowdsource section)
- Dual package managers: `pnpm` for website, `uv` for Python

### Data sources (9 total)
| Source | Records | How |
|--------|---------|-----|
| GoodAI List | 15,396 repos | Scraped via API, uploaded as static model |
| OSS Insights AI | 616 repos | Existing static model |
| OSAI Gap Map | 41 subcategories | CSV from Raffi's qualitative assessment |
| Hugging Face | 1K top models + 1K top datasets + 973 tracked | API fetch, filtered by tracked authors |
| AI Incident Database | 1,460 incidents | Scraped from AIID page data |
| GitHub Orgs | 7,910 orgs/users | GitHub API via `gh` CLI |
| GoodAI Enrichment | 46K tags, 14K descriptions | Consolidated from insights-private#62 |
| OSO Public Tables | Projects, artifacts, dev metrics | Continuous (existing) |
| AI Repo Packages | 718K packages | UDM joining repos → NPM/PIP/Go/Maven/NuGet/Rust |

### UDMs deployed (3)
| Model | Table | Schedule |
|-------|-------|----------|
| `ai_repo_activity` | `currentai.ai_repo_activity.ai_repo_activity` | Daily |
| `ai_monthly_devs` | `currentai.ai_monthly_devs.ai_monthly_devs` | Daily |
| `ai_repo_packages` | `currentai.ai_repo_packages.ai_repo_packages` | Weekly |

### Notebooks (6)
| Notebook | Purpose | Hosted? |
|----------|---------|---------|
| `oss_ai_trends` | Developer activity, star velocity, contributor depth | To deploy |
| `oss_ai_gaps` | Health scatter, red spots, Current AI focus areas | To deploy |
| `france_ecosystem` | France-filtered view for Pionniers de l'IA | Yes (deployed) |
| `layer_mapping` | OSAI → GoodAI taxonomy mapping explorer | Local |
| `taxonomy_mapping` | Taxonomy overlap analysis | Local |
| `data_inventory` | Source coverage and overlap | Local |

### Scripts (7)
- `query.py` — CLI for ad-hoc SQL (templates: top repos, trending, categories, gaps, search)
- `fetch_goodailist.py` — Scrape full GoodAI List API
- `fetch_github_ai_repos.py` — GitHub Search for forked AI repos
- `fetch_github_orgs.py` — GitHub org/user metadata (incremental, handles rate limits)
- `fetch_huggingface.py` — HF models/datasets (tracked authors + top 1K, `--top-only`/`--tracked-only`)
- `fetch_incidents.py` — AI Incident Database
- `export_notebooks.py` — Notebook → HTML export

### Documentation
- `docs/specs/2026-04-27-ecosystem-mapping-design.md` — Architecture spec with 4-tier query framework
- `docs/guides/currentai-notebooks.md` — Notebook + style guide (Fraunces/Inter/JetBrains Mono, paper/ink palette)
- `docs/analysis-router.md` — Compatibility router to persona skill + guides
- `docs/plans/2026-04-27-restructure-and-data-inventory.md` — Implementation plan (completed)
- `models/README.md` — UDM and static model registry

### Design decisions
- OSAI gap map as editorial backbone, GoodAI List as discovery engine
- Two taxonomies stay separate lenses (not merged)
- UDMs pre-compute expensive joins (cut notebook load from minutes to seconds)
- Current AI style guide: warm editorial palette matching the website design system
- Explorer card pattern for interactive notebook sections
- All notebooks pass both `check_notebook.py` and `marimo check`

## What's next (from the updated spec)

### Immediate
- Exploratory analysis per query framework tier
- Deploy restyled trends + gaps notebooks to oso.xyz
- Build `publish_data.py` to bridge notebooks → website

### Key gap
- **Tier 1 (Composition)** is the weakest area — dependency graphs, functional decomposition, substitutability, integration cost. Everything upstream (Tier 0 roadmap queries) depends on it.

## Stats
- 47 commits
- ~380K lines added (mostly data CSVs)
- 1 session, 2 days (April 27–28, 2026)
