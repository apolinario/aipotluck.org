# Models

Data models deployed to the `currentai` org on the OSO data warehouse.

## User Defined Models (UDMs)

Each `.sql` file is the source of truth for a deployed UDM. Edits here should be synced to OSO via `createDataModelRevision`.

| Model | Table | Schedule | Description |
|-------|-------|----------|-------------|
| [ai_repo_packages](ai_repo_packages.sql) | `currentai.ai_repo_packages.ai_repo_packages` | Weekly | Links AI repos to published packages (NPM, PIP, Go, Maven, NuGet, Rust) |
| [ai_repo_activity](ai_repo_activity.sql) | `currentai.ai_repo_activity.ai_repo_activity` | Daily | Per-repo 90-day stars, forks, FT/PT contributors |
| [ai_monthly_devs](ai_monthly_devs.sql) | `currentai.ai_monthly_devs.ai_monthly_devs` | Daily | Monthly active developer counts by category |
| [ai_dependency_graph](ai_dependency_graph.sql) | `currentai.ai_dependency_graph.ai_dependency_graph` | Weekly (Mon 6am) | Transitive AI→AI dependency graph (direct + depth-2, ~25K edges) |
| [ai_fragility_scores](ai_fragility_scores.sql) | `currentai.ai_fragility_scores.ai_fragility_scores` | Weekly (Mon 7am) | Dependency reach × maintainer capacity — fragility hotspots |
| [ai_investment_ranking](ai_investment_ranking.sql) | `currentai.ai_investment_ranking.ai_investment_ranking` | Weekly (Mon 7am) | Composite investment ranking: gap urgency × centrality × benchmarks × fragility |

## Static Models (CSV uploads)

These are CSV-based datasets uploaded to OSO. The source CSVs live in `data/` and are refreshed via scripts.

| Model | Table | Source | Description |
|-------|-------|--------|-------------|
| goodailist_repos | `currentai.goodailist_repos.repos` | `data/goodailist/repos.csv` | 15K+ curated AI repos with categories, stars, contributors, country, language |
| ossinsights_ai_collections | `currentai.ossinsights_ai_collections.ossinsights_ai_collections` | External (OSS Insights) | 616 repos across 53 AI collections |
| model_benchmarks | `currentai.model_benchmarks.model_benchmarks` | `data/huggingface/model_benchmarks.csv` | 4.5K+ Open LLM Leaderboard v2 scores (IFEval, BBH, MATH, GPQA, MUSR, MMLU-PRO) |
| model_repos | `currentai.model_repos.model_repos` | `data/huggingface/model_repos.csv` | 6.3K HF model → GitHub repo links with base_model and metadata |
| foundation_model_repos | `currentai.foundation_model_repos.foundation_model_repos` | `data/huggingface/foundation_model_repos.csv` | 72 curated foundation model families → canonical GitHub repos |
| osai_gap_map | `currentai.osai_gap_map.osai_gap_map` | `data/osai-gap-map/scores.csv` | 41 AI stack subcategories scored on 10 qualitative dimensions |
| osai_subcategory_mapping | `currentai.osai_subcategory_mapping.osai_subcategory_mapping` | `data/osai_subcategory_repos.csv` | OSAI subcategory → GoodAI subcategory bridge |
| taxonomy_crosswalk | `currentai.taxonomy_crosswalk.taxonomy_crosswalk` | `data/taxonomy_crosswalk.csv` | OSAI layer → GoodAI category bridge |

## Querying

All models use three-part table names: `currentai.<dataset>.<table>`

```sql
-- UDM
SELECT * FROM currentai.ai_repo_packages.ai_repo_packages LIMIT 10
SELECT * FROM currentai.ai_dependency_graph.ai_dependency_graph LIMIT 10

-- Static models
SELECT * FROM currentai.goodailist_repos.repos LIMIT 10
SELECT * FROM currentai.model_benchmarks.model_benchmarks LIMIT 10
SELECT * FROM currentai.model_repos.model_repos LIMIT 10

-- Join: top benchmarked models linked to AI repos
SELECT b.model_id, b.average, b.architecture, b.params_b, r.github_repo
FROM currentai.model_benchmarks.model_benchmarks b
LEFT JOIN currentai.model_repos.model_repos r ON b.model_id = r.model_id
WHERE r.github_repo IS NOT NULL AND r.github_repo != ''
ORDER BY CAST(b.average AS DOUBLE) DESC
LIMIT 20

-- Join: foundation repos + their benchmarked models
SELECT d.dependency_repo, d.dependency_category,
  COUNT(DISTINCT d.dependent_repo) AS dependents,
  b.model_id, b.average
FROM currentai.ai_dependency_graph.ai_dependency_graph d
LEFT JOIN currentai.model_repos.model_repos r
  ON d.dependency_repo = r.github_repo
LEFT JOIN currentai.model_benchmarks.model_benchmarks b
  ON r.model_id = b.model_id
GROUP BY d.dependency_repo, d.dependency_category, b.model_id, b.average
ORDER BY dependents DESC
LIMIT 20
```

## Refreshing

```bash
# Refresh GoodAI List static model:
# 1. Scrape fresh data
uv run scripts/fetch_goodailist.py
# 2. Upload CSV and trigger run via MCP (createStaticModelUploadUrl + createStaticModelRunRequest)

# Refresh model benchmarks + repo links (requires HF_TOKEN in .env):
uv run scripts/fetch_model_benchmarks.py              # both benchmarks + repos
uv run scripts/fetch_model_benchmarks.py --benchmarks-only   # just leaderboard
uv run scripts/fetch_model_benchmarks.py --repos-only        # just repo links
# Then upload CSVs via MCP (same flow as GoodAI List)

# UDMs refresh on their cron schedule, or trigger manually via MCP (createUserModelRunRequest)
```
