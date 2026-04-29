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
        ("goodailist_repos row count >= 15000",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.goodailist_repos",
         lambda df: df['cnt'].iloc[0] >= 15000),
        ("osai_gap_map has >= 41 rows",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.osai_gap_map",
         lambda df: df['cnt'].iloc[0] >= 41),
        ("model_benchmarks row count >= 4000",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.model_benchmarks",
         lambda df: df['cnt'].iloc[0] >= 4000),
        ("model_repos row count >= 6000",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.model_repos",
         lambda df: df['cnt'].iloc[0] >= 6000),
        ("foundation_model_repos row count >= 30",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.foundation_model_repos",
         lambda df: df['cnt'].iloc[0] >= 30),
        ("osai_subcategory_mapping row count >= 30",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.osai_subcategory_mapping",
         lambda df: df['cnt'].iloc[0] >= 30),
        ("taxonomy_crosswalk row count >= 5",
         "SELECT COUNT(*) AS cnt FROM currentai.catalog.taxonomy_crosswalk",
         lambda df: df['cnt'].iloc[0] >= 5),
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
        ("entities.repos >= 15000 rows",
         "SELECT COUNT(*) AS cnt FROM currentai.entities.repos",
         lambda df: df['cnt'].iloc[0] >= 15000),
        ("entities.repos has no duplicate repos",
         """SELECT COUNT(*) AS cnt FROM (
              SELECT repo, COUNT(*) AS n FROM currentai.entities.repos
              GROUP BY repo HAVING COUNT(*) > 1
            )""",
         lambda df: df['cnt'].iloc[0] == 0),
        ("entities.repos oss_directory match rate >= 8%",
         """SELECT
              COUNT(*) AS total,
              COUNT(CASE WHEN is_in_oss_directory THEN 1 END) AS matched,
              ROUND(CAST(COUNT(CASE WHEN is_in_oss_directory THEN 1 END) AS DOUBLE)
                / COUNT(*) * 100, 1) AS pct
            FROM currentai.entities.repos""",
         lambda df: df['pct'].iloc[0] >= 8.0),
        ("entities.repos github_id fill rate >= 8%",
         """SELECT
              ROUND(CAST(COUNT(CASE WHEN github_id IS NOT NULL THEN 1 END) AS DOUBLE)
                / COUNT(*) * 100, 1) AS pct
            FROM currentai.entities.repos""",
         lambda df: df['pct'].iloc[0] >= 8.0),
        ("entities.projects <= entities.repos",
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
        ("entities.models repo link rate >= 30%",
         """SELECT
              ROUND(CAST(COUNT(CASE WHEN repo IS NOT NULL THEN 1 END) AS DOUBLE)
                / COUNT(*) * 100, 1) AS pct
            FROM currentai.entities.models""",
         lambda df: df['pct'].iloc[0] >= 30.0),
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
        ("metrics.daily has data (>1M rows)",
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
        ("scores.taxonomy maps >= 40% of projects",
         """SELECT
              ROUND(CAST(COUNT(DISTINCT t.project_slug) AS DOUBLE) /
                (SELECT COUNT(*) FROM currentai.entities.projects) * 100, 1) AS pct
            FROM currentai.scores.taxonomy t""",
         lambda df: df['pct'].iloc[0] >= 40.0),
        ("scores.dependency_graph edge count within 20% of old",
         """SELECT
              (SELECT COUNT(*) FROM currentai.scores.dependency_graph) AS new_edges,
              (SELECT COUNT(*) FROM currentai.ai_dependency_graph.ai_dependency_graph) AS old_edges""",
         lambda df: abs(df['new_edges'].iloc[0] - df['old_edges'].iloc[0])
                     / max(df['old_edges'].iloc[0], 1) < 0.20),
        ("scores.fragility top-10 overlap with old >= 7",
         """WITH new_top AS (
              SELECT repo FROM currentai.scores.fragility
              ORDER BY total_dependents DESC LIMIT 10
            ), old_top AS (
              SELECT repo FROM currentai.ai_fragility_scores.ai_fragility_scores
              ORDER BY total_dependents DESC LIMIT 10
            )
            SELECT COUNT(*) AS overlap FROM new_top n
            WHERE EXISTS (SELECT 1 FROM old_top o WHERE o.repo = n.repo)""",
         lambda df: df['overlap'].iloc[0] >= 7),
        ("scores.investment_ranking has 41 subcategories",
         "SELECT COUNT(*) AS cnt FROM currentai.scores.investment_ranking",
         lambda df: df['cnt'].iloc[0] == 41),
        ("scores.project_summary has no null project_slugs",
         """SELECT COUNT(*) AS cnt FROM currentai.scores.project_summary
            WHERE project_slug IS NULL""",
         lambda df: df['cnt'].iloc[0] == 0),
        ("scores.project_summary stars_28d are non-negative",
         """SELECT COUNT(*) AS cnt FROM currentai.scores.project_summary
            WHERE stars_28d < 0""",
         lambda df: df['cnt'].iloc[0] == 0),
        ("scores.ossd_coverage has data",
         "SELECT COUNT(*) AS cnt FROM currentai.scores.ossd_coverage",
         lambda df: df['cnt'].iloc[0] > 500),
        ("scores.ossd_coverage unmatched > 0 for partial_match orgs",
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
    parser.add_argument(
        "--phase",
        choices=["catalog", "entities", "metrics", "scores", "all"],
        default="all",
    )
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
