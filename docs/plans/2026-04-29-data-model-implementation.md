# Data Model Implementation Plan

> **Status: COMPLETED (2026-04-29).** This plan was executed inline and diverged in several ways during implementation. The spec (`docs/specs/2026-04-29-data-model-design.md`) reflects the final state. Key deviations:
>
> - **4 → 5 datasets**: Added `events` dataset (github_events moved out of metrics)
> - **Added `scores.repos_summary`**: Pre-computed per-repo snapshot (15K rows) — notebooks were too slow querying metrics.daily (5M rows) directly
> - **`entities.packages` rewritten**: `package_owners_v0` replaced `artifacts_by_project_v1` (30min timeout → 42 seconds)
> - **Dropped `entities.artifacts_by_project`** and **`metrics.monthly_devs`**: unnecessary materialization
> - **ID-based event joins OOM'd**: Trino's 15GB limit. Reverted to name-based join
> - **All schedules daily** (plan had some weekly)
> - **MCP deployment flow**: plan missed the `createDataModelRelease` step between revision and run

**Goal:** Replace the 14-dataset ad-hoc layout with 5 clean datasets (catalog, entities, events, metrics, scores) deployed as UDMs in the `currentai` org on OSO, with formal verification at each phase.

**Architecture:** Static CSV reference data goes into a `catalog` dataset. SQL-defined UDMs build on top in four layers: `entities` (identity resolution), `events` (pre-filtered GitHub Archive), `metrics` (normalized daily aggregates), and `scores` (taxonomy, dependencies, fragility, rankings, summaries). Each layer reads only from the layers below it. Old datasets are retired after migration.

**Tech Stack:** Trino SQL (UDMs deployed via OSO MCP tools), Python + pyoso (verification scripts), marimo (notebooks), pnpm/Vite (website)

**Spec:** `docs/specs/2026-04-29-data-model-design.md`

---

## File Structure

### SQL models (new) — `models/`

Each file is the SQL source of truth for one UDM table, deployed via MCP.

| File | Dataset | Table |
|------|---------|-------|
| `models/entities_repos.sql` | `entities` | `entities.repos` |
| `models/entities_projects.sql` | `entities` | `entities.projects` |
| `models/entities_packages.sql` | `entities` | `entities.packages` |
| `models/entities_models.sql` | `entities` | `entities.models` |
| `models/metrics_daily.sql` | `metrics` | `metrics.daily` |
| `models/scores_taxonomy.sql` | `scores` | `scores.taxonomy` |
| `models/scores_dependency_graph.sql` | `scores` | `scores.dependency_graph` |
| `models/scores_fragility.sql` | `scores` | `scores.fragility` |
| `models/scores_investment_ranking.sql` | `scores` | `scores.investment_ranking` |
| `models/scores_project_summary.sql` | `scores` | `scores.project_summary` |
| `models/scores_ossd_coverage.sql` | `scores` | `scores.ossd_coverage` |

### SQL models (retire after migration) — `models/`

| File | Replaced by |
|------|-------------|
| `models/ai_repo_activity.sql` | `entities.repos` + `metrics.daily` |
| `models/ai_monthly_devs.sql` | notebook business logic over `metrics.daily` |
| `models/ai_repo_packages.sql` | `entities.packages` |
| `models/ai_dependency_graph.sql` | `scores.dependency_graph` |
| `models/ai_fragility_scores.sql` | `scores.fragility` |
| `models/ai_investment_ranking.sql` | `scores.investment_ranking` |

### Scripts (new/modified) — `scripts/`

| File | Purpose |
|------|---------|
| `scripts/verify_migration.py` | Post-migration verification: row counts, join rates, cross-checks |
| `scripts/generate_ossd_yaml.py` | Generate oss-directory YAML from `scores.ossd_coverage` |
| `scripts/export_website_data.py` | Query mart tables → JSON for `app/src/data.generated.js` |
| `scripts/query.py` | Update template queries to use new table names |

### Docs (modified)

| File | Change |
|------|--------|
| `models/README.md` | Rewrite to reflect new 4-dataset layout |
| `CLAUDE.md` | Update data sources section with new table names |
| `docs/guides/currentai-queries.md` | Update table references and join patterns |

### Notebooks (modified) — `notebooks/`

All 7 notebooks reference old table names. Each needs a find-and-replace for the new names:

| Notebook | Old references | New references |
|----------|---------------|----------------|
| `oss_ai_trends.py` | `ai_repo_activity`, `ai_monthly_devs` | `entities.repos`, `metrics.daily` |
| `france_ecosystem.py` | `ai_repo_activity` | `entities.repos`, `metrics.daily` |
| `oss_ai_gaps.py` | `ai_repo_activity` | `entities.repos` |
| `layer_mapping.py` | `goodailist_repos` | `catalog.goodailist_repos` or `entities.repos` |
| `taxonomy_mapping.py` | `goodailist_repos` | `catalog.goodailist_repos` or `entities.repos` |
| `data_inventory.py` | `goodailist_repos`, `ossinsights_ai_collections` | `entities.repos`, oss_directory join |
| `tier_data_audit.py` | `ai_repo_activity`, `ai_dependency_graph`, `goodailist_repos` | `entities.repos`, `scores.dependency_graph` |

---

## Verification Strategy

Every phase includes **formal checks** (automated, must-pass) and **sanity checks** (manual review, catch nonsense).

### Formal checks (automated via `scripts/verify_migration.py`)

1. **Row count invariants:**
   - `entities.repos` ≥ 15,000 (at least as many as deduped GoodAI)
   - `entities.repos` has zero duplicate `repo` values
   - `entities.projects` row count ≤ `entities.repos` row count (projects group repos)
   - `metrics.daily` row count ≈ repos × 365 × 8 metrics (within 20% — some repos have sparse data)
   - `scores.dependency_graph` ≈ 25K edges (within 20% of current `ai_dependency_graph`)

2. **Join rate checks:**
   - `entities.repos` → `oss_directory.artifacts_by_project`: match rate ≥ 8% (current is ~9%)
   - `entities.repos` → `oss_directory.repositories`: ID fill rate (github_id non-null) ≥ 8%
   - `entities.packages` → `entities.repos`: 100% of packages have a valid repo
   - `entities.models` → `entities.repos`: repo link rate ≥ 30% (many HF models lack GitHub links)
   - `scores.taxonomy` → `entities.projects`: coverage ≥ 40% of projects mapped to at least one OSAI subcategory

3. **Cross-source consistency:**
   - Total stars in `entities.repos` vs old `ai_repo_activity`: within 5% (same source, different dedup)
   - Dependency graph edge count: new vs old within 10%
   - Fragility top-10 repos: at least 7 of 10 match between old and new

4. **No data loss:**
   - Every repo in old `ai_repo_activity` appears in `entities.repos`
   - Every edge in old `ai_dependency_graph` appears in `scores.dependency_graph`

### Sanity checks (manual, eyeball review)

1. **Spot-check known projects:** Query `pytorch`, `tensorflow`, `huggingface/transformers` through the full stack — do they have correct project_slug, packages, models, taxonomy, scores?
2. **Top-N plausibility:** Top 10 by stars, top 10 by fragility, top 10 by investment_priority — do the rankings make intuitive sense?
3. **Website JSON:** Does `data.generated.js` produce a valid JS object? Does the dev server render it without errors?
4. **Notebook smoke test:** Run each notebook with `marimo run --headless` — does it complete without error?

---

## Task 1: Create `catalog` dataset and upload CSVs

**Files:**
- No code files — this is MCP operations only
- Verify: `scripts/verify_migration.py` (created in Task 2)

- [ ] **Step 1: Create the `catalog` dataset via MCP**

Use `mcp__oso-prod__createDataset` with:
```json
{
  "input": {
    "orgId": "ad7f4c1c-dd2f-430e-a831-e7f1f16e6d9e",
    "name": "catalog",
    "displayName": "Catalog",
    "description": "Curated reference data: GoodAI repos, OSAI gap map, taxonomy bridges, HF model benchmarks/repos. CSV uploads refreshed via scripts.",
    "type": "STATIC_MODEL"
  }
}
```

- [ ] **Step 2: Upload each CSV as a table within `catalog`**

For each of the 7 CSVs, use `createStaticModelUploadUrl` to get an upload URL, upload the CSV, then `createStaticModelRunRequest` to trigger ingestion. The table names within the dataset:

| CSV file | Table name |
|----------|-----------|
| `data/goodailist/repos.csv` | `goodailist_repos` |
| `data/huggingface/model_benchmarks.csv` | `model_benchmarks` |
| `data/huggingface/model_repos.csv` | `model_repos` |
| `data/huggingface/foundation_model_repos.csv` | `foundation_model_repos` |
| `data/osai-gap-map/scores.csv` | `osai_gap_map` |
| `data/osai_subcategory_repos.csv` | `osai_subcategory_mapping` |
| `data/taxonomy_crosswalk.csv` | `taxonomy_crosswalk` |

- [ ] **Step 3: Verify `catalog` tables are queryable**

Run via MCP `execute_sql`:
```sql
-- Check each table is accessible and has expected row counts
SELECT 'goodailist_repos' AS tbl, COUNT(*) AS cnt FROM currentai.catalog.goodailist_repos
UNION ALL
SELECT 'model_benchmarks', COUNT(*) FROM currentai.catalog.model_benchmarks
UNION ALL
SELECT 'model_repos', COUNT(*) FROM currentai.catalog.model_repos
UNION ALL
SELECT 'foundation_model_repos', COUNT(*) FROM currentai.catalog.foundation_model_repos
UNION ALL
SELECT 'osai_gap_map', COUNT(*) FROM currentai.catalog.osai_gap_map
UNION ALL
SELECT 'osai_subcategory_mapping', COUNT(*) FROM currentai.catalog.osai_subcategory_mapping
UNION ALL
SELECT 'taxonomy_crosswalk', COUNT(*) FROM currentai.catalog.taxonomy_crosswalk
```

Expected: `goodailist_repos` ≈ 15,396; `model_benchmarks` ≈ 4,576; `model_repos` ≈ 6,349; `foundation_model_repos` ≈ 72; `osai_gap_map` = 41; `osai_subcategory_mapping` ≈ 42; `taxonomy_crosswalk` ≈ 10.

- [ ] **Step 4: Cross-check catalog vs old datasets**

```sql
-- Row counts should match exactly (same CSVs)
SELECT
  (SELECT COUNT(*) FROM currentai.catalog.goodailist_repos) AS new_goodai,
  (SELECT COUNT(*) FROM currentai.goodailist_repos.repos) AS old_goodai,
  (SELECT COUNT(*) FROM currentai.catalog.osai_gap_map) AS new_gap,
  (SELECT COUNT(*) FROM currentai.osai_gap_map.osai_gap_map) AS old_gap
```

Expected: new = old for each pair. If not, the CSV upload had issues.

---

## Task 2: Write verification script

**Files:**
- Create: `scripts/verify_migration.py`

- [ ] **Step 1: Create the verification script**

```python
"""
Post-migration verification for the currentai data model.

Runs formal checks against the new 4-dataset layout:
- Row count invariants
- Join rate checks
- Cross-source consistency
- No data loss vs old tables

Usage:
    uv run scripts/verify_migration.py                    # run all checks
    uv run scripts/verify_migration.py --phase entities   # run checks for one phase
    uv run scripts/verify_migration.py --phase catalog
    uv run scripts/verify_migration.py --phase metrics
    uv run scripts/verify_migration.py --phase scores
"""

import argparse
import os
import sys

try:
    from pyoso import Client
except ImportError:
    print("pyoso not installed. Run: uv sync")
    sys.exit(1)


def get_client():
    if not os.environ.get("OSO_API_KEY"):
        print("OSO_API_KEY not set.")
        sys.exit(1)
    return Client()


def check(name, query, predicate, client):
    """Run a query and check a predicate on the result."""
    try:
        df = client.to_pandas(query)
        result = predicate(df)
        status = "PASS" if result else "FAIL"
        print(f"  [{status}] {name}")
        if not result:
            print(f"         Data: {df.to_dict('records')[:3]}")
        return result
    except Exception as e:
        print(f"  [ERROR] {name}: {e}")
        return False


def check_catalog(client):
    print("\n=== CATALOG CHECKS ===")
    passed = 0
    total = 0

    checks = [
        ("goodailist_repos row count ≥ 15000",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.goodailist_repos",
         lambda df: df['cnt'].iloc[0] >= 15000),
        ("osai_gap_map has 41 rows",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.osai_gap_map",
         lambda df: df['cnt'].iloc[0] == 41),
        ("model_benchmarks row count ≥ 4000",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.model_benchmarks",
         lambda df: df['cnt'].iloc[0] >= 4000),
        ("model_repos row count ≥ 6000",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.model_repos",
         lambda df: df['cnt'].iloc[0] >= 6000),
        ("catalog matches old goodailist",
         """SELECT
              (SELECT COUNT(*) FROM currentai.catalog.goodailist_repos) AS new_cnt,
              (SELECT COUNT(*) FROM currentai.goodailist_repos.repos) AS old_cnt""",
         lambda df: df['new_cnt'].iloc[0] == df['old_cnt'].iloc[0]),
    ]

    for name, query, pred in checks:
        total += 1
        if check(name, query, pred, client):
            passed += 1

    print(f"\n  Catalog: {passed}/{total} passed")
    return passed == total


def check_entities(client):
    print("\n=== ENTITIES CHECKS ===")
    passed = 0
    total = 0

    checks = [
        ("entities.repos ≥ 15000 rows",
         "SELECT COUNT(*) AS cnt FROM currentai.entities.repos",
         lambda df: df['cnt'].iloc[0] >= 15000),
        ("entities.repos has no duplicate repos",
         "SELECT COUNT(*) AS cnt FROM (SELECT repo, COUNT(*) AS n FROM currentai.entities.repos GROUP BY repo HAVING COUNT(*) > 1)",
         lambda df: df['cnt'].iloc[0] == 0),
        ("entities.repos oss_directory match rate ≥ 8%",
         """SELECT
              COUNT(*) AS total,
              COUNT(CASE WHEN is_in_oss_directory THEN 1 END) AS matched,
              ROUND(CAST(COUNT(CASE WHEN is_in_oss_directory THEN 1 END) AS DOUBLE) / COUNT(*) * 100, 1) AS pct
            FROM currentai.entities.repos""",
         lambda df: df['pct'].iloc[0] >= 8.0),
        ("entities.repos github_id fill rate ≥ 8%",
         """SELECT
              ROUND(CAST(COUNT(CASE WHEN github_id IS NOT NULL THEN 1 END) AS DOUBLE) / COUNT(*) * 100, 1) AS pct
            FROM currentai.entities.repos""",
         lambda df: df['pct'].iloc[0] >= 8.0),
        ("entities.projects ≤ entities.repos",
         """SELECT
              (SELECT COUNT(*) FROM currentai.entities.projects) AS projects,
              (SELECT COUNT(*) FROM currentai.entities.repos) AS repos""",
         lambda df: df['projects'].iloc[0] <= df['repos'].iloc[0]),
        ("no data loss: old ai_repo_activity repos all present",
         """SELECT COUNT(*) AS missing FROM currentai.ai_repo_activity.ai_repo_activity old
            WHERE NOT EXISTS (
              SELECT 1 FROM currentai.entities.repos new WHERE new.repo = old.repo
            )""",
         lambda df: df['missing'].iloc[0] == 0),
        ("entities.packages all have valid repos",
         """SELECT COUNT(*) AS orphans FROM currentai.entities.packages p
            WHERE NOT EXISTS (
              SELECT 1 FROM currentai.entities.repos r WHERE r.repo = p.repo
            )""",
         lambda df: df['orphans'].iloc[0] == 0),
        ("entities.models repo link rate ≥ 30%",
         """SELECT
              ROUND(CAST(COUNT(CASE WHEN repo IS NOT NULL THEN 1 END) AS DOUBLE) / COUNT(*) * 100, 1) AS pct
            FROM currentai.entities.models""",
         lambda df: df['pct'].iloc[0] >= 30.0),
        ("total stars within 5% of old ai_repo_activity",
         """SELECT
              (SELECT SUM(CAST(total_stars AS BIGINT)) FROM currentai.ai_repo_activity.ai_repo_activity) AS old_stars,
              (SELECT SUM(CAST(total_stars AS BIGINT)) FROM currentai.catalog.goodailist_repos) AS new_stars""",
         lambda df: abs(df['new_stars'].iloc[0] - df['old_stars'].iloc[0]) / df['old_stars'].iloc[0] < 0.05),
    ]

    for name, query, pred in checks:
        total += 1
        if check(name, query, pred, client):
            passed += 1

    print(f"\n  Entities: {passed}/{total} passed")
    return passed == total


def check_metrics(client):
    print("\n=== METRICS CHECKS ===")
    passed = 0
    total = 0

    checks = [
        ("metrics.daily has data",
         "SELECT COUNT(*) AS cnt FROM currentai.metrics.daily",
         lambda df: df['cnt'].iloc[0] > 1000000),
        ("metrics.daily has 8 metric types",
         "SELECT COUNT(DISTINCT metric) AS cnt FROM currentai.metrics.daily",
         lambda df: df['cnt'].iloc[0] == 8),
        ("metrics.daily date range spans ~12 months",
         """SELECT
              MIN(day) AS min_day, MAX(day) AS max_day,
              DATE_DIFF('day', MIN(day), MAX(day)) AS span_days
            FROM currentai.metrics.daily""",
         lambda df: df['span_days'].iloc[0] >= 330),
        ("metrics.daily no negative values",
         "SELECT COUNT(*) AS cnt FROM currentai.metrics.daily WHERE value < 0",
         lambda df: df['cnt'].iloc[0] == 0),
        ("metrics.daily repos match entities.repos",
         """SELECT COUNT(*) AS orphans FROM (
              SELECT DISTINCT repo FROM currentai.metrics.daily
            ) m WHERE NOT EXISTS (
              SELECT 1 FROM currentai.entities.repos r WHERE r.repo = m.repo
            )""",
         lambda df: df['orphans'].iloc[0] == 0),
    ]

    for name, query, pred in checks:
        total += 1
        if check(name, query, pred, client):
            passed += 1

    print(f"\n  Metrics: {passed}/{total} passed")
    return passed == total


def check_scores(client):
    print("\n=== SCORES CHECKS ===")
    passed = 0
    total = 0

    checks = [
        ("scores.taxonomy maps ≥ 40% of projects",
         """SELECT
              ROUND(CAST(COUNT(DISTINCT t.project_slug) AS DOUBLE) /
                (SELECT COUNT(*) FROM currentai.entities.projects) * 100, 1) AS pct
            FROM currentai.scores.taxonomy t""",
         lambda df: df['pct'].iloc[0] >= 40.0),
        ("scores.dependency_graph edge count within 20% of old",
         """SELECT
              (SELECT COUNT(*) FROM currentai.scores.dependency_graph) AS new_edges,
              (SELECT COUNT(*) FROM currentai.ai_dependency_graph.ai_dependency_graph) AS old_edges""",
         lambda df: abs(df['new_edges'].iloc[0] - df['old_edges'].iloc[0]) / max(df['old_edges'].iloc[0], 1) < 0.20),
        ("scores.fragility top-10 overlap with old ≥ 7",
         """WITH new_top AS (
              SELECT repo FROM currentai.scores.fragility ORDER BY total_dependents DESC LIMIT 10
            ), old_top AS (
              SELECT repo FROM currentai.ai_fragility_scores.ai_fragility_scores ORDER BY total_dependents DESC LIMIT 10
            )
            SELECT COUNT(*) AS overlap FROM new_top n
            WHERE EXISTS (SELECT 1 FROM old_top o WHERE o.repo = n.repo)""",
         lambda df: df['overlap'].iloc[0] >= 7),
        ("scores.investment_ranking has 41 subcategories",
         "SELECT COUNT(*) AS cnt FROM currentai.scores.investment_ranking",
         lambda df: df['cnt'].iloc[0] == 41),
        ("scores.project_summary has no null project_slugs",
         "SELECT COUNT(*) AS cnt FROM currentai.scores.project_summary WHERE project_slug IS NULL",
         lambda df: df['cnt'].iloc[0] == 0),
        ("scores.project_summary stars_28d are non-negative",
         "SELECT COUNT(*) AS cnt FROM currentai.scores.project_summary WHERE stars_28d < 0",
         lambda df: df['cnt'].iloc[0] == 0),
        ("scores.ossd_coverage has data",
         "SELECT COUNT(*) AS cnt FROM currentai.scores.ossd_coverage",
         lambda df: df['cnt'].iloc[0] > 500),
        ("scores.ossd_coverage unmatched repos > 0 for partial_match orgs",
         """SELECT COUNT(*) AS cnt FROM currentai.scores.ossd_coverage
            WHERE opportunity_type = 'partial_match' AND unmatched_repos = 0""",
         lambda df: df['cnt'].iloc[0] == 0),
    ]

    for name, query, pred in checks:
        total += 1
        if check(name, query, pred, client):
            passed += 1

    print(f"\n  Scores: {passed}/{total} passed")
    return passed == total


def main():
    parser = argparse.ArgumentParser(description="Verify currentai data model migration")
    parser.add_argument("--phase", choices=["catalog", "entities", "metrics", "scores", "all"],
                        default="all")
    args = parser.parse_args()

    client = get_client()
    results = {}

    if args.phase in ("catalog", "all"):
        results["catalog"] = check_catalog(client)
    if args.phase in ("entities", "all"):
        results["entities"] = check_entities(client)
    if args.phase in ("metrics", "all"):
        results["metrics"] = check_metrics(client)
    if args.phase in ("scores", "all"):
        results["scores"] = check_scores(client)

    print("\n" + "=" * 40)
    all_passed = all(results.values())
    for phase, passed in results.items():
        print(f"  {phase}: {'PASS' if passed else 'FAIL'}")
    print(f"\n  Overall: {'ALL PASSED' if all_passed else 'FAILURES DETECTED'}")
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test the catalog phase checks**

```bash
export $(grep -v '^#' .env | xargs) && uv run scripts/verify_migration.py --phase catalog
```

Expected: all catalog checks pass (once Task 1 is complete).

- [ ] **Step 3: Commit**

```bash
git add scripts/verify_migration.py
git commit -m "feat: add migration verification script for data model redesign"
```

---

## Task 3: Write and deploy `entities.repos`

**Files:**
- Create: `models/entities_repos.sql`

- [ ] **Step 1: Create the `entities` dataset via MCP**

Use `mcp__oso-prod__createDataset` with:
```json
{
  "input": {
    "orgId": "ad7f4c1c-dd2f-430e-a831-e7f1f16e6d9e",
    "name": "entities",
    "displayName": "Entities",
    "description": "Resolved identities: repos, projects, packages, and models with stable IDs and project grouping.",
    "type": "USER_MODEL"
  }
}
```

- [ ] **Step 2: Write the SQL model**

Create `models/entities_repos.sql`:

```sql
-- Model: entities.repos
-- Dataset: currentai.entities
-- Table: currentai.entities.repos
-- Kind: FULL (daily cron)
--
-- Foundation table: deduped GoodAI repo catalog enriched with
-- oss_directory stable IDs and project resolution.
-- Every downstream model chains off this.

WITH goodai AS (
  SELECT
    LOWER(repo) AS repo,
    category,
    TRIM(SPLIT_PART(subcat, ',', 1)) AS subcategory,
    language,
    country,
    description,
    CAST(stars AS BIGINT) AS total_stars,
    CAST(created_at AS DATE) AS created_at,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(repo)
      ORDER BY updated_at DESC NULLS LAST
    ) AS _rn
  FROM currentai.catalog.goodailist_repos
),
deduped AS (
  SELECT repo, category, subcategory, language, country, description,
         total_stars, created_at
  FROM goodai WHERE _rn = 1
),
ossd_match AS (
  SELECT
    LOWER(a.artifact_namespace || '/' || a.artifact_name) AS repo,
    a.project_id,
    a.project_name AS project_slug
  FROM oso.oss_directory.artifacts_by_project a
  WHERE a.artifact_source = 'GITHUB'
),
ossd_repos AS (
  SELECT
    LOWER(name_with_owner) AS repo,
    CAST(id AS BIGINT) AS github_id,
    node_id,
    license_spdx_id AS license
  FROM oso.oss_directory.repositories
)
SELECT
  d.repo,
  'https://github.com/' || d.repo AS url,
  r.github_id,
  r.node_id,
  m.project_slug,
  d.category,
  d.subcategory,
  d.language,
  d.country,
  d.description,
  COALESCE(r.license, '') AS license,
  d.created_at,
  m.project_slug IS NOT NULL AS is_in_oss_directory
FROM deduped d
LEFT JOIN ossd_match m ON d.repo = m.repo
LEFT JOIN ossd_repos r ON d.repo = r.repo
```

- [ ] **Step 3: Deploy via MCP**

Use `createDataModel` to register the model, then `createDataModelRevision` with the SQL, then `createUserModelRunRequest` to trigger the first build.

- [ ] **Step 4: Wait for build, then run entity checks**

```bash
export $(grep -v '^#' .env | xargs) && uv run scripts/verify_migration.py --phase entities
```

Note: some entity checks depend on `entities.projects` (deployed in Task 4) — expect those to fail at this stage. The key checks here:
- `entities.repos ≥ 15000 rows`
- `entities.repos has no duplicate repos`
- `entities.repos oss_directory match rate ≥ 8%`
- `no data loss: old ai_repo_activity repos all present`

- [ ] **Step 5: Sanity check — spot-check known repos**

```sql
SELECT repo, url, github_id, project_slug, category, is_in_oss_directory
FROM currentai.entities.repos
WHERE repo IN ('pytorch/pytorch', 'huggingface/transformers', 'tensorflow/tensorflow')
```

Expected: all three present, `is_in_oss_directory = true`, correct categories.

- [ ] **Step 6: Commit**

```bash
git add models/entities_repos.sql
git commit -m "feat: add entities.repos UDM — foundation table with oss_directory IDs"
```

---

## Task 4: Write and deploy `entities.projects`

**Files:**
- Create: `models/entities_projects.sql`

- [ ] **Step 1: Write the SQL model**

Create `models/entities_projects.sql`:

```sql
-- Model: entities.projects
-- Dataset: currentai.entities
-- Table: currentai.entities.projects
-- Kind: FULL (daily cron)
--
-- Slim identity table. OSO projects where matched, standalone
-- repo-as-project otherwise. Categories, languages, collections
-- are many-to-many — derive via joins.

WITH ossd_projects AS (
  SELECT
    r.project_slug,
    p.display_name,
    MIN(SPLIT_PART(r.repo, '/', 1)) AS org,
    MAX(r.description) AS description,
    COUNT(*) AS repo_count,
    SUM(CAST(g.stars AS BIGINT)) AS total_stars,
    'oss_directory' AS source
  FROM currentai.entities.repos r
  JOIN currentai.catalog.goodailist_repos g
    ON LOWER(g.repo) = r.repo
  JOIN oso.oss_directory.projects p
    ON r.project_slug = p.project_name
  WHERE r.is_in_oss_directory
  GROUP BY r.project_slug, p.display_name
),
goodai_deduped_for_stars AS (
  SELECT LOWER(repo) AS repo, CAST(stars AS BIGINT) AS stars,
    ROW_NUMBER() OVER (PARTITION BY LOWER(repo) ORDER BY updated_at DESC NULLS LAST) AS _rn
  FROM currentai.catalog.goodailist_repos
),
standalone AS (
  SELECT
    r.repo AS project_slug,
    SPLIT_PART(r.repo, '/', 2) AS display_name,
    SPLIT_PART(r.repo, '/', 1) AS org,
    r.description,
    1 AS repo_count,
    gs.stars AS total_stars,
    'goodai_standalone' AS source
  FROM currentai.entities.repos r
  JOIN goodai_deduped_for_stars gs ON gs.repo = r.repo AND gs._rn = 1
  WHERE NOT r.is_in_oss_directory
),
all_projects AS (
  SELECT * FROM ossd_projects
  UNION ALL
  SELECT * FROM standalone
),
org_locations AS (
  SELECT LOWER(login) AS org, location
  FROM currentai.catalog.goodailist_repos
  WHERE location IS NOT NULL AND location != ''
  GROUP BY LOWER(login), location
)
SELECT
  p.project_slug,
  p.display_name,
  p.org,
  p.description,
  l.location,
  p.repo_count,
  p.total_stars,
  p.source
FROM all_projects p
LEFT JOIN org_locations l ON p.org = l.org
```

Note: The `org_locations` CTE above uses GoodAI's `country` field on repos as a proxy. This may need refinement — the `data/github-orgs/orgs.csv` has richer location data. If `catalog` includes a `github_orgs` table, use that instead. For now, this gets location from the GoodAI repo data which has a `country` column.

- [ ] **Step 2: Deploy via MCP and trigger build**

Same flow as Task 3: `createDataModelRevision` + `createUserModelRunRequest`.

- [ ] **Step 3: Verify**

```sql
-- Basic counts
SELECT source, COUNT(*) AS cnt, SUM(repo_count) AS total_repos
FROM currentai.entities.projects
GROUP BY source

-- Spot check
SELECT * FROM currentai.entities.projects
WHERE project_slug IN ('pytorch', 'huggingface/transformers', 'tensorflow')
```

Expected: `oss_directory` source has ~1,400 projects. `goodai_standalone` has ~14,000. Total repo_count sums to ~15,375.

- [ ] **Step 4: Commit**

```bash
git add models/entities_projects.sql
git commit -m "feat: add entities.projects UDM — project identity with oss_directory resolution"
```

---

## Task 5: Write and deploy `entities.packages`

**Files:**
- Create: `models/entities_packages.sql`

- [ ] **Step 1: Write the SQL model**

Create `models/entities_packages.sql`:

```sql
-- Model: entities.packages
-- Dataset: currentai.entities
-- Table: currentai.entities.packages
-- Kind: FULL (weekly cron)
--
-- Published packages (NPM, PIP, Go, etc.) linked to AI repos
-- via the OSO project registry.

WITH repo_projects AS (
  SELECT repo, project_slug
  FROM currentai.entities.repos
  WHERE is_in_oss_directory
)
SELECT DISTINCT
  rp.repo,
  rp.project_slug,
  pkg.artifact_source AS package_source,
  pkg.artifact_namespace AS package_namespace,
  pkg.artifact_name AS package_name,
  CASE pkg.artifact_source
    WHEN 'NPM' THEN 'https://www.npmjs.com/package/' || pkg.artifact_name
    WHEN 'PIP' THEN 'https://pypi.org/project/' || pkg.artifact_name
    WHEN 'GO' THEN 'https://pkg.go.dev/' || pkg.artifact_namespace || '/' || pkg.artifact_name
    WHEN 'RUST' THEN 'https://crates.io/crates/' || pkg.artifact_name
    WHEN 'MAVEN' THEN 'https://central.sonatype.com/artifact/' || pkg.artifact_namespace || '/' || pkg.artifact_name
    WHEN 'NUGET' THEN 'https://www.nuget.org/packages/' || pkg.artifact_name
    ELSE ''
  END AS url
FROM repo_projects rp
JOIN oso.oss_directory.artifacts_by_project abp
  ON rp.project_slug = abp.project_name
  AND abp.artifact_source = 'GITHUB'
JOIN oso.artifacts_by_project_v1 pkg
  ON abp.project_id = pkg.project_id
  AND pkg.artifact_source IN ('NPM', 'PIP', 'GO', 'MAVEN', 'NUGET', 'RUST')
```

- [ ] **Step 2: Deploy via MCP and trigger build**

- [ ] **Step 3: Verify**

```sql
SELECT package_source, COUNT(*) AS cnt
FROM currentai.entities.packages
GROUP BY package_source
ORDER BY cnt DESC
```

Expected: similar distribution to old `ai_repo_packages` (~718K total across NPM, PIP, GO, etc.).

- [ ] **Step 4: Commit**

```bash
git add models/entities_packages.sql
git commit -m "feat: add entities.packages UDM — published packages linked to repos/projects"
```

---

## Task 6: Write and deploy `entities.models`

**Files:**
- Create: `models/entities_models.sql`

- [ ] **Step 1: Write the SQL model**

Create `models/entities_models.sql`:

```sql
-- Model: entities.models
-- Dataset: currentai.entities
-- Table: currentai.entities.models
-- Kind: FULL (weekly cron)
--
-- HF models linked to repos and projects via catalog.model_repos,
-- enriched with benchmarks and foundation model family.

WITH model_repo_links AS (
  SELECT
    mr.model_id,
    'https://huggingface.co/' || mr.model_id AS url,
    mr.author,
    LOWER(mr.github_repo) AS repo,
    mr.base_model_id,
    mr.pipeline_tag,
    mr.library_name,
    CAST(mr.downloads AS BIGINT) AS downloads,
    CAST(mr.likes AS INTEGER) AS likes
  FROM currentai.catalog.model_repos mr
),
foundation AS (
  SELECT
    LOWER(github_repo) AS repo,
    model_family
  FROM currentai.catalog.foundation_model_repos
),
benchmarks AS (
  SELECT
    model_id,
    CAST(average AS DOUBLE) AS benchmark_avg,
    architecture
  FROM currentai.catalog.model_benchmarks
),
repo_projects AS (
  SELECT repo, project_slug
  FROM currentai.entities.repos
)
SELECT
  m.model_id,
  m.url,
  m.author,
  m.repo,
  rp.project_slug,
  m.base_model_id,
  m.pipeline_tag,
  m.library_name,
  m.downloads,
  m.likes,
  f.model_family,
  b.benchmark_avg,
  b.architecture
FROM model_repo_links m
LEFT JOIN repo_projects rp ON m.repo = rp.repo
LEFT JOIN foundation f ON m.repo = f.repo
LEFT JOIN benchmarks b ON m.model_id = b.model_id
```

- [ ] **Step 2: Deploy via MCP and trigger build**

- [ ] **Step 3: Verify**

```sql
-- Row count and link rates
SELECT
  COUNT(*) AS total_models,
  COUNT(CASE WHEN repo IS NOT NULL AND repo != '' THEN 1 END) AS with_repo,
  COUNT(CASE WHEN project_slug IS NOT NULL THEN 1 END) AS with_project,
  COUNT(CASE WHEN benchmark_avg IS NOT NULL THEN 1 END) AS with_benchmark,
  COUNT(CASE WHEN model_family IS NOT NULL THEN 1 END) AS with_family
FROM currentai.entities.models
```

Expected: ~6,349 total models. ≥30% with repo link. Benchmark coverage varies.

- [ ] **Step 4: Commit**

```bash
git add models/entities_models.sql
git commit -m "feat: add entities.models UDM — HF models with repo links and benchmarks"
```

---

## Task 7: Write and deploy `metrics.daily`

**Files:**
- Create: `models/metrics_daily.sql`

- [ ] **Step 1: Create the `metrics` dataset via MCP**

```json
{
  "input": {
    "orgId": "ad7f4c1c-dd2f-430e-a831-e7f1f16e6d9e",
    "name": "metrics",
    "displayName": "Metrics",
    "description": "Normalized time-series activity metrics: daily stars, forks, commits, PRs, issues, and contributor counts per repo.",
    "type": "USER_MODEL"
  }
}
```

- [ ] **Step 2: Write the SQL model**

Create `models/metrics_daily.sql`:

```sql
-- Model: metrics.daily
-- Dataset: currentai.metrics
-- Table: currentai.metrics.daily
-- Kind: FULL (daily cron)
--
-- Normalized daily activity metrics per repo, 12-month rolling window.
-- Long format: one row per repo × day × metric.
-- Event metrics from GitHub Archive, contributor metrics from OpenDevData.

WITH repos AS (
  SELECT repo, github_id,
    LOWER(SPLIT_PART(repo, '/', 1)) AS owner,
    LOWER(SPLIT_PART(repo, '/', 2)) AS name
  FROM currentai.entities.repos
),
github_events AS (
  SELECT
    r.repo,
    r.github_id,
    CAST(ev.time AS DATE) AS day,
    ev.event_type
  FROM repos r
  JOIN oso.int_events__github_unified ev
    ON LOWER(ev.to_artifact_namespace) = r.owner
    AND LOWER(ev.to_artifact_name) = r.name
  WHERE ev.time >= CURRENT_DATE - INTERVAL '365' DAY
    AND ev.event_type IN ('STARRED', 'FORKED', 'COMMIT_CODE', 'PULL_REQUEST_OPENED', 'ISSUE_OPENED')
),
event_counts AS (
  SELECT
    repo, github_id, day,
    COUNT(CASE WHEN event_type = 'STARRED' THEN 1 END) AS stars,
    COUNT(CASE WHEN event_type = 'FORKED' THEN 1 END) AS forks,
    COUNT(CASE WHEN event_type = 'COMMIT_CODE' THEN 1 END) AS commits,
    COUNT(CASE WHEN event_type = 'PULL_REQUEST_OPENED' THEN 1 END) AS pull_requests,
    COUNT(CASE WHEN event_type = 'ISSUE_OPENED' THEN 1 END) AS issues_opened
  FROM github_events
  GROUP BY repo, github_id, day
),
contrib AS (
  SELECT
    r.repo,
    r.github_id,
    CAST(rda.day AS DATE) AS day,
    COUNT(DISTINCT rda.canonical_developer_id) AS contributors,
    COUNT(DISTINCT CASE WHEN rda.l28_days >= 10 THEN rda.canonical_developer_id END) AS full_time,
    COUNT(DISTINCT CASE WHEN rda.l28_days BETWEEN 1 AND 9 THEN rda.canonical_developer_id END) AS part_time
  FROM repos r
  JOIN oso.int_opendevdata__repositories_with_repo_id rid
    ON LOWER(rid.repo_name) = r.repo
  JOIN oso.stg_opendevdata__repo_developer_28d_activities rda
    ON rda.repo_id = rid.opendevdata_id
  WHERE rda.day >= CURRENT_DATE - INTERVAL '365' DAY
  GROUP BY r.repo, r.github_id, CAST(rda.day AS DATE)
),
all_days AS (
  SELECT repo, github_id, day FROM event_counts
  UNION
  SELECT repo, github_id, day FROM contrib
),
combined AS (
  SELECT
    ad.repo,
    ad.github_id,
    ad.day,
    COALESCE(ec.stars, 0) AS stars,
    COALESCE(ec.forks, 0) AS forks,
    COALESCE(ec.commits, 0) AS commits,
    COALESCE(ec.pull_requests, 0) AS pull_requests,
    COALESCE(ec.issues_opened, 0) AS issues_opened,
    COALESCE(c.contributors, 0) AS contributors,
    COALESCE(c.full_time, 0) AS full_time,
    COALESCE(c.part_time, 0) AS part_time
  FROM all_days ad
  LEFT JOIN event_counts ec ON ad.repo = ec.repo AND ad.day = ec.day
  LEFT JOIN contrib c ON ad.repo = c.repo AND ad.day = c.day
)
SELECT repo, github_id, day, 'stars' AS metric, CAST(stars AS DOUBLE) AS value FROM combined WHERE stars > 0
UNION ALL
SELECT repo, github_id, day, 'forks', CAST(forks AS DOUBLE) FROM combined WHERE forks > 0
UNION ALL
SELECT repo, github_id, day, 'commits', CAST(commits AS DOUBLE) FROM combined WHERE commits > 0
UNION ALL
SELECT repo, github_id, day, 'pull_requests', CAST(pull_requests AS DOUBLE) FROM combined WHERE pull_requests > 0
UNION ALL
SELECT repo, github_id, day, 'issues_opened', CAST(issues_opened AS DOUBLE) FROM combined WHERE issues_opened > 0
UNION ALL
SELECT repo, github_id, day, 'contributors', CAST(contributors AS DOUBLE) FROM combined WHERE contributors > 0
UNION ALL
SELECT repo, github_id, day, 'full_time', CAST(full_time AS DOUBLE) FROM combined WHERE full_time > 0
UNION ALL
SELECT repo, github_id, day, 'part_time', CAST(part_time AS DOUBLE) FROM combined WHERE part_time > 0
```

- [ ] **Step 3: Deploy via MCP and trigger build**

Note: This is the heaviest query — touches `int_events__github_unified` for 15K repos × 365 days. May take 5-10 minutes.

- [ ] **Step 4: Verify**

```bash
export $(grep -v '^#' .env | xargs) && uv run scripts/verify_migration.py --phase metrics
```

Also spot-check a known repo:
```sql
SELECT metric, SUM(value) AS total
FROM currentai.metrics.daily
WHERE repo = 'pytorch/pytorch'
GROUP BY metric
ORDER BY metric
```

Expected: stars total in thousands, meaningful commit/PR/fork counts.

- [ ] **Step 5: Commit**

```bash
git add models/metrics_daily.sql
git commit -m "feat: add metrics.daily UDM — normalized daily activity per repo"
```

---

## Task 8: Write and deploy `scores.taxonomy`

**Files:**
- Create: `models/scores_taxonomy.sql`

- [ ] **Step 1: Create the `scores` dataset via MCP**

```json
{
  "input": {
    "orgId": "ad7f4c1c-dd2f-430e-a831-e7f1f16e6d9e",
    "name": "scores",
    "displayName": "Scores",
    "description": "Interpretive layer: taxonomy mapping, dependency graph, fragility, investment ranking, project summaries, and OSSD coverage.",
    "type": "USER_MODEL"
  }
}
```

- [ ] **Step 2: Write the SQL model**

Create `models/scores_taxonomy.sql`:

```sql
-- Model: scores.taxonomy
-- Dataset: currentai.scores
-- Table: currentai.scores.taxonomy
-- Kind: FULL (daily cron)
--
-- Maps projects into the OSAI editorial layer structure via
-- hand-curated bridge tables. A project can appear in multiple
-- subcategories.

WITH subcat_bridge AS (
  SELECT
    osai_layer,
    osai_subcategory,
    TRIM(goodai_sub) AS goodai_subcategory
  FROM currentai.catalog.osai_subcategory_mapping
  CROSS JOIN UNNEST(SPLIT(goodai_subcategories, ',')) AS t(goodai_sub)
),
cat_bridge AS (
  SELECT
    osai_layer,
    goodai_category
  FROM currentai.catalog.taxonomy_crosswalk
),
gap AS (
  SELECT
    layer,
    subcategory,
    subcategory_id,
    CAST(overall_score AS DOUBLE) AS gap_score,
    parity_verdict
  FROM currentai.catalog.osai_gap_map
),
repo_subcats AS (
  SELECT DISTINCT
    COALESCE(r.project_slug, r.repo) AS project_slug,
    sb.osai_layer,
    sb.osai_subcategory,
    'subcategory_bridge' AS mapping_source
  FROM currentai.entities.repos r
  INNER JOIN subcat_bridge sb ON r.subcategory = sb.goodai_subcategory
),
repo_cats AS (
  SELECT DISTINCT
    COALESCE(r.project_slug, r.repo) AS project_slug,
    g.layer AS osai_layer,
    g.subcategory AS osai_subcategory,
    'category_bridge' AS mapping_source
  FROM currentai.entities.repos r
  INNER JOIN cat_bridge cb ON r.category = cb.goodai_category
  INNER JOIN gap g ON cb.osai_layer = g.layer
  WHERE NOT EXISTS (
    SELECT 1 FROM repo_subcats rs
    WHERE rs.project_slug = COALESCE(r.project_slug, r.repo)
  )
),
all_mappings AS (
  SELECT * FROM repo_subcats
  UNION ALL
  SELECT * FROM repo_cats
)
SELECT
  m.project_slug,
  m.osai_layer,
  m.osai_subcategory,
  g.subcategory_id AS osai_subcategory_id,
  g.gap_score,
  g.parity_verdict,
  m.mapping_source
FROM all_mappings m
INNER JOIN gap g
  ON m.osai_layer = g.layer
  AND m.osai_subcategory = g.subcategory
```

- [ ] **Step 3: Deploy via MCP and trigger build**

- [ ] **Step 4: Verify**

```sql
-- Coverage check
SELECT
  COUNT(DISTINCT project_slug) AS mapped_projects,
  COUNT(DISTINCT osai_subcategory) AS subcategories_used,
  COUNT(*) AS total_mappings
FROM currentai.scores.taxonomy

-- Spot check
SELECT * FROM currentai.scores.taxonomy WHERE project_slug = 'pytorch'
```

Expected: mapped_projects ≥ 40% of total projects. All 41 OSAI subcategories should have at least some projects.

- [ ] **Step 5: Commit**

```bash
git add models/scores_taxonomy.sql
git commit -m "feat: add scores.taxonomy UDM — OSAI layer mapping"
```

---

## Task 9: Write and deploy `scores.dependency_graph`, `scores.fragility`, `scores.investment_ranking`

**Files:**
- Create: `models/scores_dependency_graph.sql`
- Create: `models/scores_fragility.sql`
- Create: `models/scores_investment_ranking.sql`

These are essentially the existing `ai_dependency_graph`, `ai_fragility_scores`, `ai_investment_ranking` models repointed to read from `entities.repos` and `catalog.*` instead of the old table names.

- [ ] **Step 1: Write `scores_dependency_graph.sql`**

Copy `models/ai_dependency_graph.sql` and update:
- Replace `currentai.ai_repo_activity.ai_repo_activity` → `currentai.entities.repos`
- Column mapping: `CAST(total_stars AS DOUBLE) AS stars` stays the same (source column is `total_stars` from goodai catalog via entities.repos — but entities.repos doesn't have `total_stars`. Need to join to `catalog.goodailist_repos` or add a derived column.)

Actually, `entities.repos` doesn't carry `total_stars` — it's on the catalog. The dependency graph needs star counts for sorting. Two options: (a) join to catalog, or (b) add total_stars to entities.repos. Since total_stars is a GoodAI snapshot value, it belongs on the catalog. The dependency graph should join.

```sql
-- Model: scores.dependency_graph
-- Dataset: currentai.scores
-- Table: currentai.scores.dependency_graph
-- Kind: FULL (weekly cron, Mon 6am)
--
-- Transitive dependency graph between AI repos.
-- Direct + depth-2 edges with category metadata.
-- Repointed from entities.repos + catalog.

WITH ai_repos AS (
  SELECT
    r.repo,
    r.category,
    CAST(g.stars AS DOUBLE) AS stars
  FROM currentai.entities.repos r
  JOIN currentai.catalog.goodailist_repos g
    ON LOWER(g.repo) = r.repo
    AND ROW_NUMBER() OVER (PARTITION BY LOWER(g.repo) ORDER BY g.updated_at DESC NULLS LAST) = 1
),
-- REST OF QUERY IS IDENTICAL TO models/ai_dependency_graph.sql
-- (direct, depth2, combined, deduped CTEs, final SELECT)
direct AS (
  SELECT DISTINCT
    d.dependent_artifact_namespace || '/' || d.dependent_artifact_name AS src,
    d.package_owner_artifact_namespace || '/' || d.package_owner_artifact_name AS dst
  FROM oso.int_code_dependencies d
  INNER JOIN ai_repos a1
    ON d.dependent_artifact_namespace || '/' || d.dependent_artifact_name = a1.repo
  INNER JOIN ai_repos a2
    ON d.package_owner_artifact_namespace || '/' || d.package_owner_artifact_name = a2.repo
  WHERE d.dependent_artifact_namespace || '/' || d.dependent_artifact_name
     != d.package_owner_artifact_namespace || '/' || d.package_owner_artifact_name
),
depth2 AS (
  SELECT DISTINCT a.src, b.dst
  FROM direct a
  INNER JOIN direct b ON a.dst = b.src
  WHERE a.src != b.dst
),
combined AS (
  SELECT src, dst, 1 AS depth FROM direct
  UNION ALL
  SELECT src, dst, 2 AS depth FROM depth2
),
deduped AS (
  SELECT src, dst, MIN(depth) AS min_depth
  FROM combined GROUP BY src, dst
)
SELECT
  e.src AS dependent_repo,
  a1.category AS dependent_category,
  e.dst AS dependency_repo,
  a2.category AS dependency_category,
  e.min_depth,
  a1.stars AS dependent_stars,
  a2.stars AS dependency_stars
FROM deduped e
INNER JOIN ai_repos a1 ON e.src = a1.repo
INNER JOIN ai_repos a2 ON e.dst = a2.repo
```

Note: The `ai_repos` CTE above has an issue — `ROW_NUMBER()` can't be used in a JOIN ON clause. Use a subquery pattern instead:

```sql
WITH goodai_deduped AS (
  SELECT
    LOWER(repo) AS repo,
    CAST(stars AS DOUBLE) AS stars,
    ROW_NUMBER() OVER (PARTITION BY LOWER(repo) ORDER BY updated_at DESC NULLS LAST) AS _rn
  FROM currentai.catalog.goodailist_repos
),
ai_repos AS (
  SELECT
    r.repo,
    r.category,
    g.stars
  FROM currentai.entities.repos r
  JOIN goodai_deduped g ON g.repo = r.repo AND g._rn = 1
),
-- ... rest unchanged
```

- [ ] **Step 2: Write `scores_fragility.sql`**

Copy `models/ai_fragility_scores.sql` and update:
- Replace `currentai.ai_repo_activity.ai_repo_activity` → `currentai.entities.repos` + contributor data
- Replace `currentai.ai_dependency_graph.ai_dependency_graph` → `currentai.scores.dependency_graph`

The tricky part: `entities.repos` doesn't carry `total_contributors`, `full_time`, `part_time`, or `goodai_contributors` — those were computed in the old `ai_repo_activity`. For fragility, we need contributor counts. Two options:
- (a) Compute inline by joining to OpenDevData (same CTEs as old ai_repo_activity)
- (b) Derive from `metrics.daily` — get latest contributor values per repo

Option (b) is cleaner since metrics.daily already has the data:

```sql
-- Model: scores.fragility
-- Dataset: currentai.scores
-- Table: currentai.scores.fragility
-- Kind: FULL (weekly cron, Mon 7am)

WITH latest_contributors AS (
  SELECT
    repo,
    value AS contributors
  FROM currentai.metrics.daily
  WHERE metric = 'contributors'
    AND day = (SELECT MAX(day) FROM currentai.metrics.daily WHERE metric = 'contributors')
),
latest_ft AS (
  SELECT repo, value AS full_time
  FROM currentai.metrics.daily
  WHERE metric = 'full_time'
    AND day = (SELECT MAX(day) FROM currentai.metrics.daily WHERE metric = 'full_time')
),
latest_pt AS (
  SELECT repo, value AS part_time
  FROM currentai.metrics.daily
  WHERE metric = 'part_time'
    AND day = (SELECT MAX(day) FROM currentai.metrics.daily WHERE metric = 'part_time')
),
goodai_deduped AS (
  SELECT LOWER(repo) AS repo, CAST(stars AS BIGINT) AS total_stars,
    CAST(contributors AS BIGINT) AS goodai_contributors,
    ROW_NUMBER() OVER (PARTITION BY LOWER(repo) ORDER BY updated_at DESC NULLS LAST) AS _rn
  FROM currentai.catalog.goodailist_repos
),
dep_counts AS (
  SELECT
    dependency_repo AS repo,
    COUNT(*) AS total_dependents,
    COUNT(CASE WHEN min_depth = 1 THEN 1 END) AS direct_dependents,
    COUNT(CASE WHEN min_depth = 2 THEN 1 END) AS transitive_dependents
  FROM currentai.scores.dependency_graph
  GROUP BY dependency_repo
)
SELECT
  r.repo,
  r.category,
  g.total_stars,
  CAST(COALESCE(ft.full_time, 0) AS INTEGER) AS full_time,
  CAST(COALESCE(pt.part_time, 0) AS INTEGER) AS part_time,
  CAST(CASE
    WHEN COALESCE(lc.contributors, 0) > 0 THEN lc.contributors
    ELSE g.goodai_contributors
  END AS INTEGER) AS total_contributors,
  d.direct_dependents,
  d.transitive_dependents,
  d.total_dependents,
  ROUND(CAST(d.transitive_dependents AS DOUBLE) / d.total_dependents, 3) AS transitive_ratio,
  ROUND(
    CAST(d.total_dependents AS DOUBLE)
    / GREATEST(
        CAST(CASE
          WHEN COALESCE(lc.contributors, 0) > 0 THEN lc.contributors
          ELSE g.goodai_contributors
        END AS DOUBLE),
        1.0
      ),
    2
  ) AS fragility_score
FROM dep_counts d
INNER JOIN currentai.entities.repos r ON d.repo = r.repo
INNER JOIN goodai_deduped g ON r.repo = g.repo AND g._rn = 1
LEFT JOIN latest_contributors lc ON r.repo = lc.repo
LEFT JOIN latest_ft ft ON r.repo = ft.repo
LEFT JOIN latest_pt pt ON r.repo = pt.repo
ORDER BY d.total_dependents DESC
```

- [ ] **Step 3: Write `scores_investment_ranking.sql`**

Copy `models/ai_investment_ranking.sql` and update table references:
- `currentai.ai_repo_activity.ai_repo_activity` → `currentai.entities.repos`
- `currentai.ai_fragility_scores.ai_fragility_scores` → `currentai.scores.fragility`
- `currentai.osai_gap_map.osai_gap_map` → `currentai.catalog.osai_gap_map`
- `currentai.osai_subcategory_mapping.osai_subcategory_mapping` → `currentai.catalog.osai_subcategory_mapping`

The SQL logic is otherwise identical.

- [ ] **Step 4: Deploy all three via MCP and trigger builds**

Deploy in order: dependency_graph first (Mon 6am), then fragility and investment_ranking (Mon 7am — they depend on the graph).

- [ ] **Step 5: Verify**

```bash
export $(grep -v '^#' .env | xargs) && uv run scripts/verify_migration.py --phase scores
```

Key cross-checks:
- Dependency graph edge count within 20% of old
- Fragility top-10 overlap ≥ 7 of 10
- Investment ranking has all 41 subcategories

- [ ] **Step 6: Commit**

```bash
git add models/scores_dependency_graph.sql models/scores_fragility.sql models/scores_investment_ranking.sql
git commit -m "feat: add scores.dependency_graph, fragility, investment_ranking UDMs"
```

---

## Task 10: Write and deploy `scores.project_summary` and `scores.ossd_coverage`

**Files:**
- Create: `models/scores_project_summary.sql`
- Create: `models/scores_ossd_coverage.sql`

- [ ] **Step 1: Write `scores_project_summary.sql`**

```sql
-- Model: scores.project_summary
-- Dataset: currentai.scores
-- Table: currentai.scores.project_summary
-- Kind: FULL (weekly cron, Mon 7am)

WITH proj AS (
  SELECT project_slug, display_name, repo_count
  FROM currentai.entities.projects
),
repo_stars AS (
  SELECT
    COALESCE(r.project_slug, r.repo) AS project_slug,
    SUM(CASE WHEN m.metric = 'stars' AND m.day >= CURRENT_DATE - INTERVAL '28' DAY THEN m.value ELSE 0 END) AS stars_28d,
    MAX(CASE WHEN m.metric = 'contributors' THEN m.value ELSE 0 END) AS contributors_28d,
    MAX(CASE WHEN m.metric = 'full_time' THEN m.value ELSE 0 END) AS full_time_28d
  FROM currentai.entities.repos r
  LEFT JOIN currentai.metrics.daily m ON r.repo = m.repo
  GROUP BY COALESCE(r.project_slug, r.repo)
),
star_totals AS (
  SELECT
    COALESCE(r.project_slug, r.repo) AS project_slug,
    SUM(CAST(g.stars AS BIGINT)) AS total_stars
  FROM currentai.entities.repos r
  JOIN currentai.catalog.goodailist_repos g ON LOWER(g.repo) = r.repo
  GROUP BY COALESCE(r.project_slug, r.repo)
),
pkg_counts AS (
  SELECT project_slug, COUNT(*) AS package_count
  FROM currentai.entities.packages
  WHERE project_slug IS NOT NULL
  GROUP BY project_slug
),
model_counts AS (
  SELECT project_slug, COUNT(*) AS model_count,
    MAX(benchmark_avg) AS best_benchmark_avg
  FROM currentai.entities.models
  WHERE project_slug IS NOT NULL
  GROUP BY project_slug
),
frag AS (
  SELECT
    COALESCE(r.project_slug, f.repo) AS project_slug,
    MAX(f.direct_dependents) AS direct_dependents,
    MAX(f.total_dependents) AS total_dependents,
    MAX(f.fragility_score) AS max_fragility_score
  FROM currentai.scores.fragility f
  JOIN currentai.entities.repos r ON f.repo = r.repo
  GROUP BY COALESCE(r.project_slug, f.repo)
),
tax AS (
  SELECT
    project_slug,
    MIN(gap_score) AS primary_gap_score
  FROM currentai.scores.taxonomy
  GROUP BY project_slug
),
inv AS (
  SELECT
    t.project_slug,
    MAX(ir.composite_score) AS investment_priority
  FROM currentai.scores.taxonomy t
  JOIN currentai.scores.investment_ranking ir
    ON t.osai_layer = ir.layer AND t.osai_subcategory = ir.subcategory
  GROUP BY t.project_slug
)
SELECT
  p.project_slug,
  p.display_name,
  COALESCE(st.total_stars, 0) AS total_stars,
  CAST(COALESCE(rs.stars_28d, 0) AS BIGINT) AS stars_28d,
  CAST(COALESCE(rs.contributors_28d, 0) AS INTEGER) AS contributors_28d,
  CAST(COALESCE(rs.full_time_28d, 0) AS INTEGER) AS full_time_28d,
  p.repo_count,
  COALESCE(pk.package_count, 0) AS package_count,
  COALESCE(mc.model_count, 0) AS model_count,
  COALESCE(fr.direct_dependents, 0) AS direct_dependents,
  COALESCE(fr.total_dependents, 0) AS total_dependents,
  COALESCE(fr.max_fragility_score, 0.0) AS max_fragility_score,
  mc.best_benchmark_avg,
  tx.primary_gap_score,
  inv.investment_priority
FROM proj p
LEFT JOIN repo_stars rs ON p.project_slug = rs.project_slug
LEFT JOIN star_totals st ON p.project_slug = st.project_slug
LEFT JOIN pkg_counts pk ON p.project_slug = pk.project_slug
LEFT JOIN model_counts mc ON p.project_slug = mc.project_slug
LEFT JOIN frag fr ON p.project_slug = fr.project_slug
LEFT JOIN tax tx ON p.project_slug = tx.project_slug
LEFT JOIN inv ON p.project_slug = inv.project_slug
```

- [ ] **Step 2: Write `scores_ossd_coverage.sql`**

```sql
-- Model: scores.ossd_coverage
-- Dataset: currentai.scores
-- Table: currentai.scores.ossd_coverage
-- Kind: FULL (daily cron)

WITH repo_orgs AS (
  SELECT
    SPLIT_PART(repo, '/', 1) AS org,
    repo,
    is_in_oss_directory,
    project_slug
  FROM currentai.entities.repos
),
org_stats AS (
  SELECT
    org,
    COUNT(*) AS total_repos,
    COUNT(CASE WHEN is_in_oss_directory THEN 1 END) AS matched_repos,
    COUNT(CASE WHEN NOT is_in_oss_directory THEN 1 END) AS unmatched_repos
  FROM repo_orgs
  GROUP BY org
),
unmatched_stars AS (
  SELECT
    SPLIT_PART(r.repo, '/', 1) AS org,
    SUM(CAST(g.stars AS BIGINT)) AS total_stars_unmatched,
    MAX_BY(r.repo, CAST(g.stars AS BIGINT)) AS top_unmatched_repo
  FROM currentai.entities.repos r
  JOIN currentai.catalog.goodailist_repos g ON LOWER(g.repo) = r.repo
  WHERE NOT r.is_in_oss_directory
  GROUP BY SPLIT_PART(r.repo, '/', 1)
),
existing AS (
  SELECT DISTINCT
    SPLIT_PART(repo, '/', 1) AS org,
    project_slug AS existing_project
  FROM repo_orgs
  WHERE is_in_oss_directory
)
SELECT
  o.org,
  o.total_repos,
  o.matched_repos,
  o.unmatched_repos,
  COALESCE(us.total_stars_unmatched, 0) AS total_stars_unmatched,
  CASE WHEN o.matched_repos > 0 THEN 'partial_match' ELSE 'new_org' END AS opportunity_type,
  us.top_unmatched_repo,
  e.existing_project
FROM org_stats o
LEFT JOIN unmatched_stars us ON o.org = us.org
LEFT JOIN existing e ON o.org = e.org
WHERE o.unmatched_repos > 0
ORDER BY o.unmatched_repos DESC
```

- [ ] **Step 3: Deploy both via MCP and trigger builds**

- [ ] **Step 4: Verify**

```sql
-- project_summary spot check
SELECT project_slug, display_name, total_stars, stars_28d, repo_count, package_count, model_count
FROM currentai.scores.project_summary
ORDER BY total_stars DESC
LIMIT 10

-- ossd_coverage top candidates
SELECT org, total_repos, matched_repos, unmatched_repos, opportunity_type, top_unmatched_repo
FROM currentai.scores.ossd_coverage
WHERE total_repos >= 3
ORDER BY unmatched_repos DESC
LIMIT 20
```

- [ ] **Step 5: Commit**

```bash
git add models/scores_project_summary.sql models/scores_ossd_coverage.sql
git commit -m "feat: add scores.project_summary and ossd_coverage UDMs"
```

---

## Task 11: Update notebooks to use new table names

**Files:**
- Modify: all 7 notebooks in `notebooks/`

- [ ] **Step 1: Create a table name mapping**

| Old reference | New reference |
|---------------|---------------|
| `currentai.ai_repo_activity.ai_repo_activity` | `currentai.entities.repos` (for metadata) or `currentai.metrics.daily` (for time-series) |
| `currentai.ai_monthly_devs.ai_monthly_devs` | Compute inline from `currentai.metrics.daily` + `currentai.entities.repos` |
| `currentai.ai_dependency_graph.ai_dependency_graph` | `currentai.scores.dependency_graph` |
| `currentai.ai_fragility_scores.ai_fragility_scores` | `currentai.scores.fragility` |
| `currentai.ai_investment_ranking.ai_investment_ranking` | `currentai.scores.investment_ranking` |
| `currentai.goodailist_repos.repos` | `currentai.catalog.goodailist_repos` or `currentai.entities.repos` |
| `currentai.ossinsights_ai_collections.ossinsights_ai_collections` | `oso.oss_directory.projects_by_collection` joined with `oso.oss_directory.collections` |
| `currentai.osai_gap_map.osai_gap_map` | `currentai.catalog.osai_gap_map` |
| `currentai.osai_subcategory_mapping.osai_subcategory_mapping` | `currentai.catalog.osai_subcategory_mapping` |
| `currentai.taxonomy_crosswalk.taxonomy_crosswalk` | `currentai.catalog.taxonomy_crosswalk` |

- [ ] **Step 2: Update each notebook**

For each of the 7 notebooks, do a find-and-replace of old table names with new ones. The key pattern changes:

**`oss_ai_trends.py`** — reads `ai_repo_activity` for stars/forks/contributors and `ai_monthly_devs` for dev counts. Replace with `entities.repos` for metadata and `metrics.daily` for time-series. The monthly devs query becomes a GROUP BY over `metrics.daily`.

**`france_ecosystem.py`** — reads `ai_repo_activity` filtering by `country = 'France'`. Replace with `entities.repos WHERE country = 'France'` for the filter, `metrics.daily` for activity data.

**`oss_ai_gaps.py`** — reads `ai_repo_activity` for health scatter. Replace with `entities.repos` joined to `scores.taxonomy`.

**`layer_mapping.py`** — reads `goodailist_repos`. Replace with `catalog.goodailist_repos` or `entities.repos`.

**`taxonomy_mapping.py`** — reads `goodailist_repos`. Same replacement.

**`data_inventory.py`** — reads `goodailist_repos` and `ossinsights_ai_collections`. Replace with `entities.repos` and oss_directory join.

**`tier_data_audit.py`** — heaviest changes: reads `ai_repo_activity`, `ai_dependency_graph`, `goodailist_repos`. Replace all.

- [ ] **Step 3: Smoke test each notebook**

```bash
uv run marimo check notebooks/oss_ai_trends.py
uv run marimo check notebooks/france_ecosystem.py
uv run marimo check notebooks/oss_ai_gaps.py
uv run marimo check notebooks/layer_mapping.py
uv run marimo check notebooks/taxonomy_mapping.py
uv run marimo check notebooks/data_inventory.py
uv run marimo check notebooks/tier_data_audit.py
```

`marimo check` validates structure (no cycles, no multiple definitions). It doesn't execute queries, but catches import/reference errors.

- [ ] **Step 4: Commit**

```bash
git add notebooks/
git commit -m "chore: update notebooks to use new catalog/entities/metrics/scores table names"
```

---

## Task 12: Write website data export script

**Files:**
- Create: `scripts/export_website_data.py`

- [ ] **Step 1: Write the export script**

```python
"""
Export mart tables to JSON for the website.

Queries scores.project_summary, scores.taxonomy, entities.repos,
and catalog.osai_gap_map, then assembles them into the MARKET_MAP_DATA
structure that app/src/data.js expects.

Usage:
    uv run scripts/export_website_data.py                     # preview to stdout
    uv run scripts/export_website_data.py --output app/src/data.generated.js
"""

import argparse
import json
import os
import sys

try:
    from pyoso import Client
except ImportError:
    print("pyoso not installed. Run: uv sync")
    sys.exit(1)


def get_client():
    if not os.environ.get("OSO_API_KEY"):
        print("OSO_API_KEY not set.")
        sys.exit(1)
    return Client()


def export_data():
    client = get_client()

    layers_df = client.to_pandas("""
        SELECT DISTINCT osai_layer, osai_subcategory, osai_subcategory_id,
               gap_score, parity_verdict
        FROM currentai.scores.taxonomy
        ORDER BY osai_layer, osai_subcategory
    """)

    projects_df = client.to_pandas("""
        SELECT
          t.project_slug,
          t.osai_layer,
          t.osai_subcategory,
          p.display_name,
          p.total_stars,
          p.stars_28d,
          p.repo_count,
          p.package_count,
          p.max_fragility_score,
          p.best_benchmark_avg,
          p.primary_gap_score,
          p.investment_priority
        FROM currentai.scores.taxonomy t
        JOIN currentai.scores.project_summary p
          ON t.project_slug = p.project_slug
        ORDER BY t.osai_layer, t.osai_subcategory, p.total_stars DESC
    """)

    gap_df = client.to_pandas("""
        SELECT layer, subcategory, subcategory_id,
               CAST(overall_score AS DOUBLE) AS overall_score,
               maturity, parity_verdict
        FROM currentai.catalog.osai_gap_map
    """)

    market_map = {"layers": []}
    layer_map = {}

    for _, row in gap_df.iterrows():
        layer_name = row["layer"]
        if layer_name not in layer_map:
            layer_obj = {
                "id": layer_name.lower().replace(" ", "_").replace(":", ""),
                "title": layer_name,
                "categories": []
            }
            layer_map[layer_name] = layer_obj
            market_map["layers"].append(layer_obj)

        health = max(0, min(100, int((row["overall_score"] / 5.0) * 100)))
        cat_obj = {
            "id": row["subcategory_id"],
            "name": row["subcategory"],
            "health": health,
            "parity": row["parity_verdict"],
            "projects": []
        }

        cat_projects = projects_df[
            (projects_df["osai_layer"] == layer_name) &
            (projects_df["osai_subcategory"] == row["subcategory"])
        ].head(10)

        for _, p in cat_projects.iterrows():
            cat_obj["projects"].append({
                "slug": p["project_slug"],
                "name": p["display_name"] or p["project_slug"],
                "stars": int(p["total_stars"] or 0),
                "repos": int(p["repo_count"] or 0),
            })

        layer_map[layer_name]["categories"].append(cat_obj)

    return market_map


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", help="Write to file instead of stdout")
    args = parser.parse_args()

    data = export_data()
    js_content = (
        "// Auto-generated from OSO data warehouse — do not edit by hand\n"
        f"// Generated: {__import__('datetime').date.today()}\n\n"
        f"export const MARKET_MAP_DATA = {json.dumps(data, indent=2)};\n"
    )

    if args.output:
        with open(args.output, "w") as f:
            f.write(js_content)
        print(f"Written to {args.output}")
    else:
        print(js_content[:2000])
        print(f"\n... ({len(js_content)} chars total)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test the export**

```bash
export $(grep -v '^#' .env | xargs) && uv run scripts/export_website_data.py
```

Expected: valid JS object structure with layers, categories, projects. Spot-check that known projects appear in correct categories.

- [ ] **Step 3: Generate and test with dev server**

```bash
export $(grep -v '^#' .env | xargs) && uv run scripts/export_website_data.py --output app/src/data.generated.js
cd app && pnpm dev
```

Open http://localhost:5173 and verify the map renders. Check that:
- All 7 OSAI layers appear
- Categories have health scores
- Projects appear in drill-down
- No JS console errors

- [ ] **Step 4: Commit**

```bash
git add scripts/export_website_data.py
git commit -m "feat: add website data export script — queries mart tables to JSON"
```

---

## Task 13: Write oss-directory YAML generation script

**Files:**
- Create: `scripts/generate_ossd_yaml.py`

- [ ] **Step 1: Write the script**

```python
"""
Generate oss-directory YAML files from scores.ossd_coverage.

Reads the top unmatched orgs and generates project YAML files
for manual review and PR submission to oss-directory.

Usage:
    uv run scripts/generate_ossd_yaml.py --org nvidia          # single org
    uv run scripts/generate_ossd_yaml.py --min-repos 3         # all orgs with 3+ repos
    uv run scripts/generate_ossd_yaml.py --min-repos 3 --dry-run  # preview only
"""

import argparse
import os
import sys

try:
    from pyoso import Client
except ImportError:
    print("pyoso not installed. Run: uv sync")
    sys.exit(1)

import yaml


def get_client():
    if not os.environ.get("OSO_API_KEY"):
        print("OSO_API_KEY not set.")
        sys.exit(1)
    return Client()


def get_org_repos(client, org):
    df = client.to_pandas(f"""
        SELECT repo, category, subcategory, description
        FROM currentai.entities.repos
        WHERE SPLIT_PART(repo, '/', 1) = '{org}'
          AND NOT is_in_oss_directory
        ORDER BY repo
    """)
    return df


def generate_yaml(org, repos_df):
    project = {
        "version": 7,
        "name": org,
        "display_name": org,
        "github": [
            {"url": f"https://github.com/{row['repo']}"}
            for _, row in repos_df.iterrows()
        ]
    }
    return yaml.dump(project, default_flow_style=False, sort_keys=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--org", help="Generate YAML for a single org")
    parser.add_argument("--min-repos", type=int, default=3, help="Min unmatched repos")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing files")
    parser.add_argument("--output-dir", default="data/ossd-yaml", help="Output directory")
    args = parser.parse_args()

    client = get_client()

    if args.org:
        orgs = [args.org]
    else:
        df = client.to_pandas(f"""
            SELECT org, unmatched_repos, total_stars_unmatched, opportunity_type, existing_project
            FROM currentai.scores.ossd_coverage
            WHERE unmatched_repos >= {args.min_repos}
              AND opportunity_type = 'new_org'
            ORDER BY unmatched_repos DESC
        """)
        orgs = df["org"].tolist()
        print(f"Found {len(orgs)} orgs with {args.min_repos}+ unmatched repos")

    if not args.dry_run:
        os.makedirs(args.output_dir, exist_ok=True)

    for org in orgs:
        repos_df = get_org_repos(client, org)
        if repos_df.empty:
            continue

        yaml_content = generate_yaml(org, repos_df)

        if args.dry_run:
            print(f"\n--- {org} ({len(repos_df)} repos) ---")
            print(yaml_content)
        else:
            path = os.path.join(args.output_dir, f"{org}.yaml")
            with open(path, "w") as f:
                f.write(yaml_content)
            print(f"  Written: {path} ({len(repos_df)} repos)")

    if not args.dry_run and orgs:
        print(f"\nGenerated {len(orgs)} YAML files in {args.output_dir}/")
        print("Review, then copy to oss-directory/data/projects/ and submit a PR.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Add pyyaml dependency**

```bash
uv add pyyaml
```

- [ ] **Step 3: Test with dry run**

```bash
export $(grep -v '^#' .env | xargs) && uv run scripts/generate_ossd_yaml.py --org nvidia --dry-run
```

Expected: YAML output with nvidia's unmatched repos listed under `github:`.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate_ossd_yaml.py
git commit -m "feat: add oss-directory YAML generation script"
```

---

## Task 14: Update documentation

**Files:**
- Modify: `models/README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/guides/currentai-queries.md`
- Modify: `scripts/query.py`

- [ ] **Step 1: Rewrite `models/README.md`**

Replace the current content with the new 4-dataset layout, table inventory, query examples, and refresh instructions. Mirror the structure from the spec's DAG and dependency matrix sections.

- [ ] **Step 2: Update `CLAUDE.md` data sources section**

Replace references to "15 queryable tables" and the old dataset names with the new 4-dataset layout. Update the `models/README.md` pointer.

- [ ] **Step 3: Update `docs/guides/currentai-queries.md`**

Replace old table name examples with new ones. Update join patterns to use `entities.repos` as the foundation.

- [ ] **Step 4: Update `scripts/query.py` templates**

Replace old table names in the `TEMPLATES` dict with new `currentai.entities.*`, `currentai.metrics.*`, `currentai.scores.*` references.

- [ ] **Step 5: Commit**

```bash
git add models/README.md CLAUDE.md docs/guides/currentai-queries.md scripts/query.py
git commit -m "docs: update all references to new 4-dataset layout"
```

---

## Task 15: Retire old datasets

**Files:**
- Delete: old SQL model files
- MCP: delete old datasets

- [ ] **Step 1: Run full verification**

```bash
export $(grep -v '^#' .env | xargs) && uv run scripts/verify_migration.py --phase all
```

All checks must pass before proceeding. If any fail, fix the issue and re-run.

- [ ] **Step 2: Run notebook smoke tests**

```bash
uv run marimo check notebooks/oss_ai_trends.py && \
uv run marimo check notebooks/france_ecosystem.py && \
uv run marimo check notebooks/oss_ai_gaps.py && \
uv run marimo check notebooks/layer_mapping.py && \
uv run marimo check notebooks/taxonomy_mapping.py && \
uv run marimo check notebooks/data_inventory.py && \
uv run marimo check notebooks/tier_data_audit.py
```

- [ ] **Step 3: Delete old datasets via MCP**

Delete each of the 12 remaining old datasets using `mcp__oso-prod__deleteDataset`:

| Dataset | ID |
|---------|-----|
| `goodailist_repos` | `e5c2951e-3002-43f9-a843-f207d23f3193` |
| `ai_repo_activity` | `f2bce900-6d7a-41b2-867d-08468d7122fd` |
| `ai_monthly_devs` | `0bf1f877-d4ab-4a82-8aa1-f749c6eae2a1` |
| `ai_repo_packages` | `91e4a90b-f97d-4b50-a198-3e6e09ddaf0d` |
| `ai_dependency_graph` | `1b62a623-5c02-45ef-9a4a-ec1cd62accb6` |
| `ai_fragility_scores` | `9b6f83ba-3ea6-432a-9c64-d48832c0ba47` |
| `ai_investment_ranking` | `d74c21bf-64b0-4341-be43-abce5fec84d8` |
| `osai_gap_map` | `cca8a5fc-f96b-461f-ba83-0f3466cd3a59` |
| `osai_subcategory_mapping` | `9c7105d4-7cc9-4709-85d7-b4a406904eca` |
| `taxonomy_crosswalk` | `c1ef5a33-cbeb-4be0-8611-5be95372f5b8` |
| `model_benchmarks` | `d6f51229-d7ec-4a52-86a8-ec35a47d6f3d` |
| `model_repos` | `bc40584d-1858-4ca1-843b-041725e20b11` |
| `foundation_model_repos` | `7c5bcd7d-7a5b-4e13-a50b-900bbada15d4` |

**IMPORTANT:** Do this in reverse dependency order. Delete UDMs first (they reference the static models), then static models last.

Order: `ai_investment_ranking` → `ai_fragility_scores` → `ai_dependency_graph` → `ai_repo_packages` → `ai_monthly_devs` → `ai_repo_activity` → then all 7 static models.

- [ ] **Step 4: Remove old SQL model files**

```bash
rm models/ai_repo_activity.sql models/ai_monthly_devs.sql models/ai_repo_packages.sql \
   models/ai_dependency_graph.sql models/ai_fragility_scores.sql models/ai_investment_ranking.sql
```

- [ ] **Step 5: Verify new tables still work after deletion**

```sql
SELECT COUNT(*) FROM currentai.entities.repos
SELECT COUNT(*) FROM currentai.scores.dependency_graph
SELECT COUNT(*) FROM currentai.scores.project_summary
```

The new UDMs reference `currentai.catalog.*` (which is new) and `currentai.entities.*` / `currentai.scores.*` (also new). They should not be affected by deleting the old datasets. But confirm.

- [ ] **Step 6: Commit**

```bash
git add -A models/
git commit -m "chore: retire old per-table datasets — replaced by catalog/entities/metrics/scores"
```

---

## Task 16: Final end-to-end sanity check

No files changed — this is a manual verification pass.

- [ ] **Step 1: Run full verification suite**

```bash
export $(grep -v '^#' .env | xargs) && uv run scripts/verify_migration.py --phase all
```

All checks must pass.

- [ ] **Step 2: Spot-check known projects through the full stack**

```sql
-- pytorch through every layer
SELECT 'repos' AS layer, repo, project_slug FROM currentai.entities.repos WHERE repo LIKE 'pytorch/%' LIMIT 5;
SELECT 'projects' AS layer, * FROM currentai.entities.projects WHERE project_slug = 'pytorch';
SELECT 'packages' AS layer, package_source, package_name FROM currentai.entities.packages WHERE project_slug = 'pytorch' LIMIT 5;
SELECT 'models' AS layer, model_id, benchmark_avg FROM currentai.entities.models WHERE project_slug = 'pytorch' LIMIT 5;
SELECT 'taxonomy' AS layer, osai_layer, osai_subcategory FROM currentai.scores.taxonomy WHERE project_slug = 'pytorch';
SELECT 'summary' AS layer, total_stars, stars_28d, repo_count, package_count FROM currentai.scores.project_summary WHERE project_slug = 'pytorch';
```

- [ ] **Step 3: Top-N plausibility check**

```sql
-- Top 10 by stars — should be recognizable names
SELECT project_slug, total_stars, repo_count FROM currentai.scores.project_summary ORDER BY total_stars DESC LIMIT 10;

-- Top 10 by fragility — should be well-known foundational projects
SELECT repo, total_dependents, fragility_score FROM currentai.scores.fragility ORDER BY fragility_score DESC LIMIT 10;

-- Top 10 investment priority — should be gap areas
SELECT layer, subcategory, composite_score, parity_verdict FROM currentai.scores.investment_ranking ORDER BY composite_score DESC LIMIT 10;
```

Review these for reasonableness. Flag anything surprising.

- [ ] **Step 4: Export website data and visual check**

```bash
export $(grep -v '^#' .env | xargs) && uv run scripts/export_website_data.py --output app/src/data.generated.js
cd app && pnpm dev
```

Open http://localhost:5173. Verify:
- All 7 layers render
- Health scores look reasonable (reds for known gaps, greens for known strengths)
- Clicking into a category shows projects
- No JS errors in console

- [ ] **Step 5: Run each notebook end-to-end**

```bash
export $(grep -v '^#' .env | xargs)
uv run marimo run notebooks/oss_ai_trends.py --headless 2>&1 | tail -5
uv run marimo run notebooks/oss_ai_gaps.py --headless 2>&1 | tail -5
uv run marimo run notebooks/france_ecosystem.py --headless 2>&1 | tail -5
```

Each should complete without errors. (Note: `--headless` may break `mo.persistent_cache` per marimo rules — if it fails, try `marimo run` without `--headless` and check the browser.)
