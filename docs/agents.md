# OSO agent guide — Open Source AI Ecosystem

You are a data analyst with access to the OSO data warehouse. This document is the single entry point for **open-source AI ecosystem analysis** — repo catalogs, developer activity, ecosystem health scores, gap analysis, and Current AI program area mapping.

- **Website:** [ecosystem-mapping](https://github.com/opensource-observer/ecosystem-mapping)
- **OSO docs:** [docs.oso.xyz](https://docs.oso.xyz)

---

## Connection

### pyoso (local or notebook)

```bash
uv add pyoso  # or: pip install pyoso
export OSO_API_KEY=<your_key>
```

```python
from pyoso import Client
client = Client()  # reads OSO_API_KEY from environment
df = client.to_pandas("SELECT * FROM currentai.goodailist_repos.repos LIMIT 10")
```

### In marimo notebooks

The `setup_pyoso` cell handles this automatically:

```python
import pyoso
import marimo as mo
pyoso_db_conn = pyoso.Client().dbapi_connection()
```

Then query with:

```python
df = mo.sql(f"SELECT ...", output=False, engine=pyoso_db_conn)
```

### Getting an API key

Sign up at [oso.xyz/start](https://www.oso.xyz/start). You need a key scoped to the **currentai** organization for `currentai.*` tables. The `oso.*` namespace is publicly accessible with any key.

---

## SQL dialect

Use **Trino SQL**:

- `CAST(x AS VARCHAR)` not `SAFE_CAST`
- `DATE_TRUNC('month', dt)` not `DATE_TRUNC(dt, MONTH)`
- `COALESCE` not `IFNULL`
- `CURRENT_DATE - INTERVAL '30' DAY` for date math
- `ARRAY_AGG` / `ARRAY_JOIN` not `STRING_AGG`

---

## Key tables

### Current AI org (`currentai.*`)

Three-part names: `currentai.<dataset>.<table>`

| Table | Description | Rows |
|-------|-------------|------|
| `currentai.goodailist_repos.repos` | GoodAI List — curated AI repo catalog with categories, stars, forks, trends, language | ~14.7K repos |
| `currentai.ossinsights_ai_collections.ossinsights_ai_collections` | OSS Insights — AI repo collection memberships | ~616 unique repos, 53 collections |

#### `currentai.goodailist_repos.repos` columns

| Column | Type | Description |
|--------|------|-------------|
| `repo` | varchar | GitHub `owner/name` (mixed case — always LOWER for joins) |
| `description` | varchar | Repo description |
| `stars` | bigint | Current star count |
| `forks` | bigint | Current fork count |
| `star_1d` | bigint | Stars gained in last 1 day |
| `star_1d_pct` | double | 1-day star growth % |
| `star_7d` | bigint | Stars gained in last 7 days |
| `star_7d_pct` | double | 7-day star growth % |
| `category` | varchar | Top-level category (8 values: Infrastructure, AI Engineering, Model Development, Applications, Models, Tutorials, Lists, Misc) |
| `subcat` | varchar | Subcategory (may be comma-separated — use `TRIM(SPLIT_PART(subcat, ',', 1))` for primary) |
| `keywords` | varchar | Comma-separated keywords |
| `country` | varchar | Country of origin (nullable) |
| `top_devs` | varchar | Top developer usernames |
| `contributors` | bigint | Contributor count |
| `created_at` | varchar | Repo creation date |
| `updated_at` | varchar | Last update date |
| `language` | varchar | Primary language |
| `archived` | boolean | Whether repo is archived |

**Deduplication:** Repos may appear multiple times. Always deduplicate:

```sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY LOWER(repo)
    ORDER BY updated_at DESC NULLS LAST
  ) AS _rn
  FROM currentai.goodailist_repos.repos
)
SELECT * FROM ranked WHERE _rn = 1
```

#### `currentai.ossinsights_ai_collections.ossinsights_ai_collections` columns

| Column | Type | Description |
|--------|------|-------------|
| `collection_id` | bigint | OSS Insights collection ID |
| `collection_name` | varchar | Collection name (e.g. "Artificial Intelligence", "LLM") |
| `repo_id` | bigint | GitHub repo ID |
| `repo_name` | varchar | GitHub `owner/name` (LOWER for joins) |
| `github_url` | varchar | Full GitHub URL |

### OSO public tables (`oso.*`)

| Table | Description |
|-------|-------------|
| `oso.projects_v1` | Project registry (project_id, project_name, display_name) |
| `oso.artifacts_by_project_v1` | Artifacts (repos, contracts, packages) linked to projects |
| `oso.int_events__github_unified` | GitHub events (stars, forks, PRs, issues) — use for activity metrics |
| `oso.int_opendevdata__repositories_with_repo_id` | OpenDevData repo mapping (repo_name → opendevdata_id) |
| `oso.stg_opendevdata__repo_developer_28d_activities` | Developer activity: 28-day rolling active days per developer per repo |

#### Joining GoodAI repos to OSO developer metrics

```sql
WITH gl_repos AS (
  SELECT
    LOWER(repo) AS repo,
    LOWER(SPLIT_PART(repo, '/', 1)) AS owner,
    LOWER(SPLIT_PART(repo, '/', 2)) AS name
  FROM currentai.goodailist_repos.repos
),
mapped AS (
  SELECT gl.repo, r.opendevdata_id AS repo_id
  FROM gl_repos gl
  JOIN oso.int_opendevdata__repositories_with_repo_id r
    ON LOWER(r.repo_name) = gl.repo
)
SELECT
  m.repo,
  COUNT(DISTINCT rda.canonical_developer_id) AS total_contributors,
  COUNT(DISTINCT CASE WHEN rda.l28_days >= 10 THEN rda.canonical_developer_id END) AS full_time,
  COUNT(DISTINCT CASE WHEN rda.l28_days BETWEEN 1 AND 9 THEN rda.canonical_developer_id END) AS part_time
FROM mapped m
JOIN oso.stg_opendevdata__repo_developer_28d_activities rda
  ON rda.repo_id = m.repo_id
WHERE rda.day >= CURRENT_DATE - INTERVAL '90' DAY
GROUP BY m.repo
```

#### Joining GoodAI repos to GitHub star/fork events

```sql
WITH gl_repos AS (
  SELECT
    LOWER(repo) AS repo,
    LOWER(SPLIT_PART(repo, '/', 1)) AS owner,
    LOWER(SPLIT_PART(repo, '/', 2)) AS name
  FROM currentai.goodailist_repos.repos
)
SELECT
  gl.repo,
  COUNT(CASE WHEN ev.event_type = 'STARRED' THEN 1 END) AS stars_90d,
  COUNT(CASE WHEN ev.event_type = 'FORKED' THEN 1 END) AS forks_90d
FROM gl_repos gl
JOIN oso.int_events__github_unified ev
  ON LOWER(ev.to_artifact_namespace) = gl.owner
  AND LOWER(ev.to_artifact_name) = gl.name
WHERE ev.event_type IN ('STARRED', 'FORKED')
  AND ev.time >= CURRENT_DATE - INTERVAL '90' DAY
GROUP BY gl.repo
```

### Local CSV: OSAI Gap Map

The OSAI gap map (`data/*.csv`) provides qualitative maturity scores. It is NOT in the OSO warehouse — load it with pandas:

```python
import pandas as pd
from pathlib import Path

data_dir = Path("data")
csv_path = next(data_dir.glob("*OSAI*gap*map*.csv"))
df = pd.read_csv(csv_path, skiprows=1)
```

| Column | Description |
|--------|-------------|
| Layer | Stack layer (Infrastructure, Model Components: Datasets/Code/Weights, Product/UX, Documentation, Licensing, Safeguards) |
| Subcategory | Specific component (41 total) |
| Breadth through Standardization | 10 scoring dimensions (1-5 scale) |
| Criteria Avg | Mean of all dimension scores |
| Overall Score | Composite score (1-4) |
| Maturity | Label: "Early stage", "Viable, but fragmented", "Strong" |
| Parity Verdict | vs closed-source: "Closed leads", "Competitive", "Unique to open source" |

---

## Starter queries

**Repo counts by GoodAI category:**

```sql
SELECT
  category,
  COUNT(DISTINCT LOWER(repo)) AS repos,
  SUM(CAST(stars AS BIGINT)) AS total_stars
FROM currentai.goodailist_repos.repos
GROUP BY category
ORDER BY repos DESC
```

**Top subcategories by star velocity:**

```sql
WITH ranked AS (
  SELECT
    TRIM(SPLIT_PART(subcat, ',', 1)) AS primary_subcat,
    category,
    CAST(star_7d AS BIGINT) AS star_7d,
    LOWER(repo) AS repo,
    ROW_NUMBER() OVER (PARTITION BY LOWER(repo) ORDER BY updated_at DESC NULLS LAST) AS _rn
  FROM currentai.goodailist_repos.repos
)
SELECT
  category,
  primary_subcat,
  COUNT(*) AS repos,
  SUM(star_7d) AS weekly_stars
FROM ranked
WHERE _rn = 1
GROUP BY category, primary_subcat
HAVING COUNT(*) >= 10
ORDER BY weekly_stars DESC
LIMIT 25
```

**OSS Insights collections with most repos:**

```sql
SELECT
  collection_name,
  COUNT(DISTINCT repo_name) AS repos
FROM currentai.ossinsights_ai_collections.ossinsights_ai_collections
GROUP BY collection_name
ORDER BY repos DESC
```

**Find GoodAI repos that are also OSO projects:**

```sql
SELECT
  gl.repo,
  gl.category,
  p.project_name,
  p.display_name
FROM (
  SELECT LOWER(repo) AS repo, category,
    ROW_NUMBER() OVER (PARTITION BY LOWER(repo) ORDER BY updated_at DESC NULLS LAST) AS _rn
  FROM currentai.goodailist_repos.repos
) gl
JOIN oso.artifacts_by_project_v1 a
  ON LOWER(a.artifact_namespace || '/' || a.artifact_name) = gl.repo
  AND a.artifact_source = 'GITHUB'
JOIN oso.projects_v1 p
  ON a.project_id = p.project_id
WHERE gl._rn = 1
LIMIT 50
```

---

## Two taxonomies

This project uses two separate classification systems — they are different lenses, not merged:

**GoodAI taxonomy** (quantitative, repo-level)
- 8 categories, 284 subcategories
- Each repo has a category and subcategory
- Quantitative signals: stars, forks, contributors, star velocity

**OSAI gap map taxonomy** (qualitative, subcategory-level)
- 7 layers, 41 subcategories
- Each subcategory scored on 10 dimensions (1-5)
- Qualitative signals: maturity, parity vs closed-source

They can be joined at the repo level where a GoodAI subcategory maps to an OSAI gap map subcategory, but this mapping is manual and lives in the notebooks (see `FOCUS_MAPPING` in `notebooks/oss_ai_gaps.py`).

---

## Important notes

- **Always LOWER() repo names** when joining across sources — casing is inconsistent.
- **Always deduplicate** `currentai.goodailist_repos.repos` — repos appear multiple times.
- **`oso.artifacts_by_project_v1` is large** (477M rows). Filter by `artifact_source = 'GITHUB'` and consider joining against a known repo list rather than scanning the full table.
- **`currentai.*` tables require a currentai-scoped API key.** `oso.*` tables are publicly accessible.
- **Use `SPLIT_PART(subcat, ',', 1)`** to extract primary subcategory from the GoodAI List — the `subcat` field is sometimes comma-separated.
