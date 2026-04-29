# Data Model Design — currentai

## Purpose

Replace the current repo-centric, ad-hoc dataset layout with a proper semantic data model (entities → events → metrics) and website-ready mart tables. All UDMs deployed in the `currentai` org on OSO.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entity grain | OSO project (fallback: standalone repo) | Multi-repo orgs resolve correctly; grows as oss-directory expands |
| Repo catalog | GoodAI as primary (~15K), ossinsight collection tags as enrichment | Avoids 30K low-signal repos bloating the catalog |
| Taxonomy | OSAI layers as primary, GoodAI categories as enrichment columns | OSAI powers the website editorial structure |
| Events | Implicit — metrics query raw sources directly | No need to materialize a unified event table yet |
| Metrics | Daily per-repo, 12-month lookback | Sufficient for trend lines and sparklines |
| Rename resilience | `github_id` / `node_id` from oss_directory where available, name fallback | GitHub Archive joins are already ID-stable; catalog fragility shrinks as oss-directory grows |

## Prerequisites

- **oss-directory push:** Add ~672 GitHub orgs (those with 3+ repos in GoodAI but not in OSO) to oss-directory. Covers ~3,540 repos. Improves project match rate from ~9% to ~30%+.
- **Subscribe currentai to `oss_directory` dataset:** Done — `oso.oss_directory.*` now accessible.

---

## Current State

### Datasets in `currentai` (14 total)

**Static models (CSV uploads) — 7:**

| Dataset | Table | Type | Records | Source CSV |
|---------|-------|------|---------|------------|
| `goodailist_repos` | `currentai.goodailist_repos.repos` | STATIC_MODEL | 15,396 | `data/goodailist/repos.csv` |
| `ossinsights_ai_collections` | `currentai.ossinsights_ai_collections.ossinsights_ai_collections` | STATIC_MODEL | 616 | External |
| `osai_gap_map` | `currentai.osai_gap_map.osai_gap_map` | STATIC_MODEL | 41 | `data/osai-gap-map/scores.csv` |
| `osai_subcategory_mapping` | `currentai.osai_subcategory_mapping.osai_subcategory_mapping` | STATIC_MODEL | 42 | `data/osai_subcategory_repos.csv` |
| `taxonomy_crosswalk` | `currentai.taxonomy_crosswalk.taxonomy_crosswalk` | STATIC_MODEL | ~10 | `data/taxonomy_crosswalk.csv` |
| `model_benchmarks` | `currentai.model_benchmarks.model_benchmarks` | STATIC_MODEL | 4,576 | `data/huggingface/model_benchmarks.csv` |
| `model_repos` | `currentai.model_repos.model_repos` | STATIC_MODEL | 6,349 | `data/huggingface/model_repos.csv` |
| `foundation_model_repos` | `currentai.foundation_model_repos.foundation_model_repos` | STATIC_MODEL | 72 | `data/huggingface/foundation_model_repos.csv` |

**UDMs (SQL-defined) — 6:**

| Dataset | Table | Schedule | Depends on |
|---------|-------|----------|------------|
| `ai_repo_activity` | `currentai.ai_repo_activity.ai_repo_activity` | Daily | `goodailist_repos`, `oso.int_events__github_unified`, `oso.int_opendevdata__*` |
| `ai_monthly_devs` | `currentai.ai_monthly_devs.ai_monthly_devs` | Daily | `goodailist_repos`, `oso.int_opendevdata__*` |
| `ai_repo_packages` | `currentai.ai_repo_packages.ai_repo_packages` | Weekly | `goodailist_repos`, `oso.artifacts_by_project_v1` |
| `ai_dependency_graph` | `currentai.ai_dependency_graph.ai_dependency_graph` | Weekly | `ai_repo_activity`, `oso.int_code_dependencies` |
| `ai_fragility_scores` | `currentai.ai_fragility_scores.ai_fragility_scores` | Weekly | `ai_repo_activity`, `ai_dependency_graph` |
| `ai_investment_ranking` | `currentai.ai_investment_ranking.ai_investment_ranking` | Weekly | `ai_repo_activity`, `ai_fragility_scores`, `osai_gap_map`, `osai_subcategory_mapping` |

**Subscribed external datasets — 1:**

| Dataset | Tables | Source |
|---------|--------|--------|
| `oss_directory` | `oso.oss_directory.projects`, `oso.oss_directory.collections`, `oso.oss_directory.repositories`, `oso.oss_directory.projects_by_collection`, `oso.oss_directory.artifacts_by_project` | OSO public marketplace |

### Problems with current layout

1. **One dataset per table** — 14 datasets for 14 tables. No logical grouping. Each UDM creates its own dataset, which means downstream UDMs must cross-reference many dataset names.
2. **`ossinsights_ai_collections` is stale** — 616 repos from an old static upload. The same collections now exist natively in `oss_directory` with 31K+ repos.
3. **No unified repo catalog** — every UDM independently dedupes `goodailist_repos.repos`, duplicating the `ROW_NUMBER() OVER (PARTITION BY LOWER(repo))` pattern.
4. **Repo-centric, not entity-centric** — everything keys on `LOWER(repo)` strings with no stable IDs and no project grouping.
5. **Naming inconsistency** — mix of `ai_*` prefixed and unprefixed names, mix of singular and plural.

---

## Target State

### Dataset Organization

Consolidate from 14 datasets into **4 logical datasets** with clean layering:

- **`catalog`** — static facts (CSV uploads, manually refreshed)
- **`entities`** — resolved identities and relationships (repos, projects, packages, models)
- **`metrics`** — normalized time-series observations (daily activity per repo)
- **`scores`** — interpretive / business logic (taxonomy, dependencies, fragility, rankings)

#### Dataset 1: `catalog` (STATIC_MODEL)

Curated reference data uploaded via CSV. Refreshed manually via scripts.

| Table | Description | Source CSV | Records |
|-------|-------------|------------|---------|
| `catalog.goodailist_repos` | Primary repo catalog with categories, activity, metadata | `data/goodailist/repos.csv` | ~15K |
| `catalog.model_benchmarks` | Open LLM Leaderboard v2 scores | `data/huggingface/model_benchmarks.csv` | ~4.5K |
| `catalog.model_repos` | HF model → GitHub repo links | `data/huggingface/model_repos.csv` | ~6.3K |
| `catalog.foundation_model_repos` | Curated foundation model families → canonical repos | `data/huggingface/foundation_model_repos.csv` | ~72 |
| `catalog.osai_gap_map` | Qualitative maturity scores (41 subcats × 10 dims) | `data/osai-gap-map/scores.csv` | 41 |
| `catalog.osai_subcategory_mapping` | OSAI subcategory → GoodAI subcategory bridge | `data/osai_subcategory_repos.csv` | ~42 |
| `catalog.taxonomy_crosswalk` | OSAI layer → GoodAI category bridge | `data/taxonomy_crosswalk.csv` | ~10 |

#### Dataset 2: `entities` (USER_MODEL)

All identifiable things and the relationships between them.

| Table | Description | Schedule | Grain |
|-------|-------------|----------|-------|
| `entities.repos` | Deduped GoodAI repos + oss_directory IDs | Daily | 1 row per repo |
| `entities.projects` | Master project table — OSO project where matched, standalone repo otherwise | Daily | 1 row per project |
| `entities.packages` | Published packages (NPM, PIP, Go, etc.) linked to repos/projects | Weekly | 1 row per package |
| `entities.models` | HF models linked to repos/projects, with base_model lineage | Weekly | 1 row per model |

#### Dataset 3: `metrics` (USER_MODEL)

Normalized time-series observations — what happened, when.

| Table | Description | Schedule | Grain |
|-------|-------------|----------|-------|
| `metrics.daily` | Normalized daily metrics per repo (12-month lookback) | Daily | 1 row per repo × day × metric |

#### Dataset 4: `scores` (USER_MODEL)

Interpretive layer — all the messy business logic: taxonomy mapping, dependency analysis, fragility, rankings.

| Table | Description | Schedule | Grain |
|-------|-------------|----------|-------|
| `scores.taxonomy` | Project → OSAI layer/subcategory mapping (editorial classification) | Daily | 1 row per project × OSAI subcategory |
| `scores.dependency_graph` | Transitive AI→AI dependency edges | Weekly | 1 row per edge |
| `scores.fragility` | Dependency reach × maintainer capacity per repo | Weekly | 1 row per repo |
| `scores.investment_ranking` | Composite ranking per OSAI subcategory | Weekly | 1 row per subcategory |
| `scores.project_summary` | Rolled-up scores per project (stars, dependents, fragility, benchmarks, gap scores) | Weekly | 1 row per project |
| `scores.ossd_coverage` | Per-org match rates and top candidates for oss-directory additions | Daily | 1 row per GitHub org |

### Datasets to retire

| Dataset | Action | Reason |
|---------|--------|--------|
| `ossinsights_ai_collections` | **Deleted** | Superseded by `oso.oss_directory.projects_by_collection` (31K repos vs 616) |
| `goodailist_repos` | **Keep as source, replace in DAG** | Absorbed into `catalog.goodailist_repos`; downstream UDMs read from `entities.repos` instead |
| Individual UDM datasets (`ai_repo_activity`, `ai_monthly_devs`, `ai_repo_packages`, `ai_dependency_graph`, `ai_fragility_scores`, `ai_investment_ranking`) | **Delete after migration** | Replaced by tables within `entities`, `metrics`, `scores` datasets |
| Individual static model datasets (`osai_gap_map`, `osai_subcategory_mapping`, `taxonomy_crosswalk`, `model_benchmarks`, `model_repos`, `foundation_model_repos`) | **Delete after migration** | Absorbed into `catalog` dataset |

Net result: **14 datasets → 4 datasets** (+ 1 subscribed external).

---

## DAG

```
EXTERNAL SOURCES                         OSO PUBLIC
─────────────────                        ──────────

data/goodailist/repos.csv ──┐
data/osai-gap-map/scores.csv ┤
data/osai_subcategory_repos.csv ┤       oso.oss_directory.*
data/taxonomy_crosswalk.csv ──┤         (projects, repositories,
data/huggingface/*.csv ──────┤           artifacts_by_project,
                              ▼          projects_by_collection,
                     ┌──────────────┐    collections)
                     │   catalog    │         │
                     │ (static)     │         │
                     │              │         │
                     │ .goodailist_ │         │
                     │   repos      │         │
                     │ .model_*     │         │
                     │ .osai_*      │         │
                     │ .taxonomy_   │         │
                     │   crosswalk  │         │
                     └──────┬───────┘         │
                            │                 │
                            ▼                 ▼
                     ┌─────────────────────────────┐
                     │         entities             │  (UDM, daily/weekly)
                     │                              │
                     │ .repos ◄─── catalog +        │
                     │             oss_directory     │
                     │ .projects ◄─ .repos +        │
                     │              oss_directory    │
                     │ .packages ◄─ .repos +        │  ← oso.artifacts_by_project_v1
                     │              abp_v1 (pkgs)   │    (packages only)
                     │ .models ◄── .repos +         │
                     │             catalog.model_*  │
                     └──────────────┬───────────────┘
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                   ┌────────────┐      ┌──────────┐
                   │  metrics   │      │  scores  │
                   │  (UDM)     │      │  (UDM)   │
                   │            │      │          │
                   │ .daily ◄───│      │.taxonomy │
                   │  gh_unified│      │.dep_graph│
                   │  opendev   │      │.fragility│
                   │            │      │.invest_  │
                   │            │      │  ranking │
                   │            │      │.project_ │
                   │            │      │  summary │
                   └────────────┘      └──────────┘
                          │                   │
                          └────────┬──────────┘
                                   ▼
                            ┌──────────────┐
                            │   Website    │
                            │  app/src/    │
                            │  data.       │
                            │  generated.js│
                            └──────────────┘
```

### Dependency matrix (table → reads from)

| Table | Reads from |
|-------|-----------|
| **entities** | |
| `entities.repos` | `catalog.goodailist_repos`, `oso.oss_directory.artifacts_by_project`, `oso.oss_directory.repositories`, `oso.oss_directory.projects_by_collection`, `oso.oss_directory.collections` |
| `entities.projects` | `entities.repos`, `oso.oss_directory.projects`, `catalog.goodailist_repos` (location via github-orgs static model — see open question) |
| `entities.packages` | `entities.repos`, `oso.package_owners_v0` (maps packages to their owner repos) |
| `entities.models` | `entities.repos`, `catalog.model_repos`, `catalog.foundation_model_repos`, `catalog.model_benchmarks` |
| **metrics** | |
| `metrics.daily` | `entities.repos`, `oso.int_events__github_unified`, `oso.int_opendevdata__*` |
| **scores** | |
| `scores.taxonomy` | `entities.repos`, `catalog.osai_subcategory_mapping`, `catalog.taxonomy_crosswalk`, `catalog.osai_gap_map` |
| `scores.dependency_graph` | `entities.repos`, `oso.int_code_dependencies` |
| `scores.fragility` | `entities.repos`, `scores.dependency_graph` |
| `scores.investment_ranking` | `entities.repos`, `scores.fragility`, `catalog.osai_gap_map`, `catalog.osai_subcategory_mapping` |
| `scores.project_summary` | `entities.projects`, `entities.repos`, `scores.fragility`, `scores.taxonomy`, `entities.models`, `entities.packages` |
| `scores.ossd_coverage` | `entities.repos` |

### External data sources

| Source | Used by | Purpose |
|--------|---------|---------|
| `oso.oss_directory.projects` | `entities.projects` | Canonical project identity |
| `oso.oss_directory.repositories` | `entities.repos` | Stable `github_id`, `node_id`, license, star/fork counts |
| `oso.oss_directory.artifacts_by_project` | `entities.repos` | Repo→project mapping (entity resolution) |
| `oso.oss_directory.projects_by_collection` | `entities.repos` | Ossinsight collection membership (queryable via join, not denormalized) |
| `oso.oss_directory.collections` | `entities.repos` | Collection names/display names |
| `oso.package_owners_v0` | `entities.packages` | Maps packages to their owner repos (NPM, PIP, GO, RUST, MAVEN, NUGET, GEM) — 153K packages |
| `oso.int_events__github_unified` | `metrics.daily` | Stars, forks, commits, PRs, issues |
| `oso.int_opendevdata__*` | `metrics.daily` | Developer activity (28-day rolling) |
| `oso.int_code_dependencies` | `scores.dependency_graph` | Package-level dependency edges |

### Schedule tiers

| Cadence | Tables | Rationale |
|---------|--------|-----------|
| **Daily** | `entities.repos`, `entities.projects`, `metrics.daily`, `scores.taxonomy`, `scores.ossd_coverage` | Track real-time activity; `entities.repos` refreshes first as the foundation |
| **Weekly (Mon 6am)** | `entities.packages`, `entities.models`, `scores.dependency_graph` | Package/dependency/model data changes slowly |
| **Weekly (Mon 7am)** | `scores.fragility`, `scores.investment_ranking`, `scores.project_summary` | Depend on dependency graph; run after it |

---

## Table Schemas

### `entities.repos`

The foundation table. Every downstream model chains off this.

```sql
-- Grain: one row per GitHub repo (deduped by LOWER(repo))
repo                VARCHAR   -- GitHub owner/name (lowercased), e.g. 'pytorch/pytorch'
url                 VARCHAR   -- https://github.com/{repo}
github_id           BIGINT    -- GitHub REST API numeric ID (stable across renames), nullable
node_id             VARCHAR   -- GitHub GraphQL node ID, nullable
project_slug        VARCHAR   -- OSO project_name if matched, nullable
category            VARCHAR   -- GoodAI top-level category
subcategory         VARCHAR   -- GoodAI primary subcategory
language            VARCHAR   -- Primary programming language
country             VARCHAR   -- Maintainer country
description         VARCHAR   -- Repo description (from GoodAI)
license             VARCHAR   -- License (from oss_directory.repositories where available)
created_at          DATE      -- Repo creation date
is_in_oss_directory BOOLEAN   -- Whether this repo has a matching OSO project
```

Ossinsight collection membership is queryable via `oso.oss_directory.projects_by_collection` — not denormalized here.

### `entities.projects`

Slim identity table. Categories, languages, and collections are many-to-many — derive them by joining through `entities.repos` or `scores.taxonomy`.

```sql
-- Grain: one row per project
-- For repos with an OSO project: grouped by project_slug
-- For repos without: each repo is its own project (repo = project_slug)
project_slug        VARCHAR   -- Human-readable key: OSO project_name, or LOWER(repo) for standalone
display_name        VARCHAR   -- Human-readable display name
org                 VARCHAR   -- GitHub org/owner
description         VARCHAR   -- From OSO project or GoodAI repo description
location            VARCHAR   -- From github-orgs/orgs.csv
repo_count          INTEGER   -- Number of repos in this project
total_stars         BIGINT    -- Sum of stars across all repos
source              VARCHAR   -- 'oss_directory', 'goodai_standalone'
```

### `entities.packages`

Published packages linked to repos and projects.

```sql
-- Grain: one row per package
repo                VARCHAR   -- Owning GitHub repo
project_slug        VARCHAR   -- Owning project (nullable for standalone repos)
package_source      VARCHAR   -- NPM, PIP, GO, MAVEN, NUGET, RUST
package_namespace   VARCHAR   -- Package namespace (if applicable)
package_name        VARCHAR   -- Package name in the registry
url                 VARCHAR   -- External link to package registry
```

### `entities.models`

HF models linked to repos and projects.

```sql
-- Grain: one row per HF model
model_id            VARCHAR   -- HF model ID (e.g. 'meta-llama/Llama-3-8B')
url                 VARCHAR   -- https://huggingface.co/{model_id}
author              VARCHAR   -- HF author
repo                VARCHAR   -- Linked GitHub repo (nullable)
project_slug        VARCHAR   -- Owning project (nullable)
base_model_id       VARCHAR   -- Parent model (for fine-tunes)
pipeline_tag        VARCHAR   -- e.g. 'text-generation', 'feature-extraction'
library_name        VARCHAR   -- e.g. 'transformers', 'sentence-transformers'
downloads           BIGINT    -- HF download count
likes               INTEGER   -- HF likes
model_family        VARCHAR   -- Foundation model family (from foundation_model_repos), nullable
benchmark_avg       DOUBLE    -- Open LLM Leaderboard v2 average score, nullable
architecture        VARCHAR   -- Model architecture, nullable
```

### `metrics.daily`

Normalized daily activity metrics per repo, 12-month rolling window. Long format — new metric types are new rows, not schema changes.

```sql
-- Grain: one row per repo × day × metric
repo                VARCHAR
github_id           BIGINT
day                 DATE
metric              VARCHAR   -- 'stars', 'forks', 'commits', 'pull_requests',
                              -- 'issues_opened', 'contributors', 'full_time', 'part_time'
value               DOUBLE
```

Metric definitions:
- `stars`, `forks`, `commits`, `pull_requests`, `issues_opened` — daily event counts from GitHub Archive
- `contributors` — distinct active contributors (28-day rolling from OpenDevData)
- `full_time` — contributors with ≥10 active days in trailing 28d
- `part_time` — contributors with 1-9 active days in trailing 28d

Monthly developer aggregations by category (the old `ai_monthly_devs`) are not materialized — compute in notebooks as `GROUP BY category, DATE_TRUNC('month', day)` over this table + `entities.repos`.

### `scores.taxonomy`

Maps projects into the OSAI editorial structure. This is an interpretive classification — the bridge tables are hand-curated and approximate.

```sql
-- Grain: one row per project × OSAI subcategory
project_slug        VARCHAR
osai_layer          VARCHAR   -- e.g. 'Infrastructure', 'Model Components: Code'
osai_subcategory    VARCHAR   -- e.g. 'Cloud Compute', 'Deep Learning Frameworks'
osai_subcategory_id VARCHAR   -- e.g. 'infrastructure.cloud_compute'
gap_score           DOUBLE    -- OSAI overall_score for this subcategory (1-5)
parity_verdict      VARCHAR   -- e.g. 'Competitive', 'Closed leads'
mapping_source      VARCHAR   -- 'subcategory_bridge' or 'category_bridge'
```

### `scores.dependency_graph`

Transitive AI→AI dependency edges.

```sql
-- Grain: one row per directed edge
dependent_repo      VARCHAR
dependent_category  VARCHAR
dependency_repo     VARCHAR
dependency_category VARCHAR
min_depth           INTEGER   -- 1 = direct, 2 = one hop
dependent_stars     DOUBLE
dependency_stars    DOUBLE
```

### `scores.fragility`

Dependency reach × maintainer capacity.

```sql
-- Grain: one row per repo (only repos that have dependents)
repo                VARCHAR
category            VARCHAR
total_stars         BIGINT
full_time           INTEGER
part_time           INTEGER
total_contributors  INTEGER
direct_dependents   INTEGER
transitive_dependents INTEGER
total_dependents    INTEGER
transitive_ratio    DOUBLE
fragility_score     DOUBLE    -- dependents / max(contributors, 1)
```

### `scores.investment_ranking`

Composite ranking per OSAI subcategory.

```sql
-- Grain: one row per OSAI subcategory
layer               VARCHAR
subcategory         VARCHAR
parity_verdict      VARCHAR
gap_urgency         DOUBLE    -- 0-100
top_repo            VARCHAR
repo_count          INTEGER
dep_centrality      DOUBLE    -- 0-100
max_fragility       DOUBLE
fragility_risk      DOUBLE    -- 0-100
composite_score     DOUBLE    -- 0-100
```

### `scores.project_summary`

Rolled-up snapshot per project for website cards.

```sql
-- Grain: one row per project
project_slug        VARCHAR
display_name        VARCHAR
total_stars         BIGINT
stars_28d           BIGINT
contributors_28d    INTEGER
full_time_28d       INTEGER
repo_count          INTEGER
package_count       INTEGER
model_count         INTEGER
direct_dependents   INTEGER
total_dependents    INTEGER
max_fragility_score DOUBLE
best_benchmark_avg  DOUBLE    -- Best average benchmark score across project's models
primary_gap_score   DOUBLE    -- Lowest gap score across mapped subcategories
investment_priority DOUBLE    -- Highest composite score across mapped subcategories
```

### `scores.ossd_coverage`

Per-org oss-directory match rates. Surfaces the best candidates for adding to oss-directory.

```sql
-- Grain: one row per GitHub org
org                 VARCHAR   -- GitHub org/owner
total_repos         INTEGER   -- repos in our catalog for this org
matched_repos       INTEGER   -- repos already linked to an oss-directory project
unmatched_repos     INTEGER   -- repos with no oss-directory project
total_stars_unmatched BIGINT  -- sum of stars across unmatched repos
opportunity_type    VARCHAR   -- 'partial_match' (org has some projects), 'new_org' (none)
top_unmatched_repo  VARCHAR   -- highest-star unmatched repo in this org
existing_project    VARCHAR   -- oss-directory project_name if partial match, nullable
```

A companion script `scripts/generate_ossd_yaml.py` reads from this table (or takes an org name) and generates oss-directory YAML files locally for manual review and PR submission.

---

## Migration Plan

### Phase 1: Create `catalog` dataset

1. Create a single `catalog` dataset (STATIC_MODEL)
2. Upload all 7 CSV sources as tables within it
3. Verify queries work against `currentai.catalog.*`

### Phase 2: Build `entities` UDMs

4. Create `entities` dataset
5. Deploy `entities.repos` — the foundation table
6. Verify output (row counts, join rates, ID coverage)
7. Deploy `entities.projects` — entity resolution
8. Deploy `entities.packages`, `entities.models`

### Phase 3: Build `metrics` UDM

9. Create `metrics` dataset
10. Deploy `metrics.daily` (normalized long format)

### Phase 4: Build `scores` UDMs

11. Create `scores` dataset
12. Deploy `scores.taxonomy` — OSAI layer mapping
13. Deploy `scores.dependency_graph`
14. Deploy `scores.fragility` (depends on dependency_graph)
15. Deploy `scores.investment_ranking` (depends on fragility)
16. Deploy `scores.project_summary` (depends on all above)

### Phase 5: Retire old datasets

17. Verify all new tables produce correct data
18. Delete the 12 remaining old individual datasets
19. Update `models/README.md`, `CLAUDE.md`, notebooks to reference new table names

### Phase 6: oss-directory push (can run in parallel with phases 2-4)

20. Generate YAML files for ~672 orgs with 3+ repos
21. Submit PR to oss-directory
22. After merge + ingestion, `entities.repos` automatically picks up improved project matches

---

## Resolved Questions

1. **Multi-table datasets:** Confirmed — a single dataset (UDM or STATIC_MODEL) can hold multiple tables. The 4-dataset grouping works as designed.
2. **Daily metrics rebuild:** Incremental tables aren't supported, so `metrics.daily` does a full rebuild daily (15K repos × 365 days ≈ 5.5M rows). Acceptable for now; if it becomes slow, we can reduce lookback or split into a weekly historical + daily recent window.
3. **Contributor daily grain:** OpenDevData provides daily snapshots of 28-day rolling counts (`l28_days`). We use these as-is — each day gets the rolling contributor count for that day. This is the correct daily value, not a flat repeat.
4. **`ossinsights_ai_collections`:** Deleted — fully superseded by `oso.oss_directory.projects_by_collection`.
5. **Package ownership:** Use `oso.package_owners_v0` for `entities.packages` — it directly maps packages to their owner repos via deps.dev. Much faster than joining through `artifacts_by_project_v1` (which has 3.4M rows). Coverage: ~153K packages across NPM, PIP, GO, RUST, MAVEN, NUGET, GEM.
