# Models

Data models deployed to the `currentai` org on the OSO data warehouse.

## User Defined Models (UDMs)

Each `.sql` file is the source of truth for a deployed UDM. Edits here should be synced to OSO via `createDataModelRevision`.

| Model | Table | Schedule | Description |
|-------|-------|----------|-------------|
| [ai_repo_packages](ai_repo_packages.sql) | `currentai.ai_repo_packages.ai_repo_packages` | Weekly | Links AI repos to published packages (NPM, PIP, Go, Maven, NuGet, Rust) |
| [ai_repo_activity](ai_repo_activity.sql) | `currentai.ai_repo_activity.ai_repo_activity` | Daily | Per-repo 90-day stars, forks, FT/PT contributors |
| [ai_monthly_devs](ai_monthly_devs.sql) | `currentai.ai_monthly_devs.ai_monthly_devs` | Daily | Monthly active developer counts by category |

## Static Models (CSV uploads)

These are CSV-based datasets uploaded to OSO. The source CSVs live in `data/` and are refreshed via scripts.

| Model | Table | Source | Description |
|-------|-------|--------|-------------|
| goodailist_repos | `currentai.goodailist_repos.repos` | `data/goodailist/repos.csv` | 15K+ curated AI repos with categories, stars, contributors, country, language |
| ossinsights_ai_collections | `currentai.ossinsights_ai_collections.ossinsights_ai_collections` | External (OSS Insights) | 616 repos across 53 AI collections |

## Querying

All models use three-part table names: `currentai.<dataset>.<table>`

```sql
-- UDM
SELECT * FROM currentai.ai_repo_packages.ai_repo_packages LIMIT 10

-- Static models
SELECT * FROM currentai.goodailist_repos.repos LIMIT 10
SELECT * FROM currentai.ossinsights_ai_collections.ossinsights_ai_collections LIMIT 10
```

## Refreshing

```bash
# Refresh GoodAI List static model:
# 1. Scrape fresh data
uv run scripts/fetch_goodailist.py
# 2. Upload CSV and trigger run via MCP (createStaticModelUploadUrl + createStaticModelRunRequest)

# UDMs refresh on their cron schedule, or trigger manually via MCP (createUserModelRunRequest)
```
