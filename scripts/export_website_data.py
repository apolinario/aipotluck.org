"""
Export warehouse data to JSON bundle for the Ecosystem Explorer.

Queries 7 tables from the currentai org and produces a single
explorer-data.json with layers, projects, repos, packages, models,
sparklines, and taxonomy.

Usage:
    uv run scripts/export_website_data.py --output app/src/data/explorer-data.json
    uv run scripts/export_website_data.py --output app/src/data/explorer-data.json --skip-validation
    uv run scripts/export_website_data.py --validate-only app/src/data/explorer-data.json
"""

import argparse
import datetime
import json
import os
import sys

try:
    from pyoso import Client
except ImportError:
    print("pyoso not installed. Run: uv sync")
    sys.exit(1)


SPOT_CHECKS = {
    "Infrastructure": ["pytorch", "deepspeed"],
    "Model Components: Code": ["transformers", "peft"],
    "Model Components: Datasets": ["datasets"],
    "Model Components: Weights": ["llama", "mistral"],
    "Product/UX": ["langchain", "open-webui"],
    "Documentation": [],
    "Licensing": [],
    "Safeguards": ["guardrails"],
}


import pandas as pd


def _val(v, default=None):
    """Safely extract a scalar from a pandas row, handling NA/NaN."""
    if v is None or (isinstance(v, float) and pd.isna(v)) or pd.isna(v):
        return default
    return v


def _int(v):
    return int(_val(v, 0))


def _float(v):
    f = _val(v)
    return float(f) if f is not None else None


def _str(v):
    s = _val(v)
    return str(s) if s is not None else None


def get_client():
    if not os.environ.get("OSO_API_KEY"):
        print("OSO_API_KEY not set.")
        sys.exit(1)
    return Client()


def query_layers(client):
    print("  Querying layers (gap_map + investment_ranking)...")
    gap_df = client.to_pandas("""
        SELECT layer, subcategory, subcategory_id,
               CAST(overall_score AS DOUBLE) AS overall_score,
               maturity, parity_verdict
        FROM currentai.catalog.osai_gap_map
        WHERE subcategory_id IS NOT NULL AND subcategory_id != ''
    """)
    inv_df = client.to_pandas("""
        SELECT layer, subcategory, gap_urgency, composite_score,
               dep_centrality, fragility_risk, top_repo, repo_count
        FROM currentai.scores.investment_ranking
    """)
    inv_map = {}
    for _, row in inv_df.iterrows():
        inv_map[(row["layer"], row["subcategory"])] = {
            "gap_urgency": _float(row["gap_urgency"]) or 0,
            "composite_score": _float(row["composite_score"]) or 0,
        }

    layers = {}
    for _, row in gap_df.iterrows():
        name = row["layer"]
        if name not in layers:
            layers[name] = {"layer": name, "subcategories": []}
        sub = {
            "subcategory": row["subcategory"],
            "subcategory_id": row["subcategory_id"],
            "gap_score": _float(row["overall_score"]) or 0,
            "parity_verdict": row["parity_verdict"],
            "investment_ranking": inv_map.get((name, row["subcategory"]), {}),
        }
        layers[name]["subcategories"].append(sub)
    return list(layers.values())


def query_projects(client):
    print("  Querying projects (project_summary)...")
    df = client.to_pandas("SELECT * FROM currentai.scores.project_summary")
    projects = []
    for _, row in df.iterrows():
        projects.append({
            "project_slug": row["project_slug"],
            "display_name": _str(row.get("display_name")),
            "total_stars": _int(row.get("total_stars")),
            "stars_28d": _int(row.get("stars_28d")),
            "contributors_28d": _int(row.get("contributors_28d")),
            "full_time_28d": _int(row.get("full_time_28d")),
            "repo_count": _int(row.get("repo_count")),
            "package_count": _int(row.get("package_count")),
            "model_count": _int(row.get("model_count")),
            "direct_dependents": _int(row.get("direct_dependents")),
            "total_dependents": _int(row.get("total_dependents")),
            "max_fragility_score": _float(row.get("max_fragility_score")) or 0,
            "best_benchmark_avg": _float(row.get("best_benchmark_avg")),
            "primary_gap_score": _float(row.get("primary_gap_score")),
            "investment_priority": _float(row.get("investment_priority")),
        })
    return projects


def query_repos(client):
    print("  Querying repos (repos_summary + license from entities.repos)...")
    df = client.to_pandas("""
        SELECT rs.*, er.license
        FROM currentai.scores.repos_summary rs
        LEFT JOIN currentai.entities.repos er ON rs.repo = er.repo
    """)
    repos = []
    for _, row in df.iterrows():
        repos.append({
            "repo": row["repo"],
            "category": _str(row.get("category")),
            "subcategory": _str(row.get("subcategory")),
            "stars": _int(row.get("stars")),
            "star_7d": _int(row.get("star_7d")),
            "contributors": _int(row.get("contributors")),
            "language": _str(row.get("language")),
            "license": _str(row.get("license")),
            "country": _str(row.get("country")),
            "description": _str(row.get("description")),
            "stars_90d": _int(row.get("stars_90d")),
            "forks_90d": _int(row.get("forks_90d")),
            "commits_90d": _int(row.get("commits_90d")),
            "total_contributors": _int(row.get("total_contributors")),
            "full_time": _int(row.get("full_time")),
            "part_time": _int(row.get("part_time")),
        })
    return repos


def query_packages(client):
    print("  Querying packages...")
    df = client.to_pandas("SELECT * FROM currentai.entities.packages")
    packages = []
    for _, row in df.iterrows():
        packages.append({
            "repo": row["repo"],
            "project_slug": _str(row.get("project_slug")),
            "package_source": row["package_source"],
            "package_name": row["package_name"],
            "url": _str(row.get("url")) or "",
        })
    return packages


def query_models(client):
    print("  Querying models...")
    df = client.to_pandas("SELECT * FROM currentai.entities.models")
    models = []
    for _, row in df.iterrows():
        models.append({
            "model_id": row["model_id"],
            "url": _str(row.get("url")),
            "repo": _str(row.get("repo")),
            "project_slug": _str(row.get("project_slug")),
            "pipeline_tag": _str(row.get("pipeline_tag")),
            "library_name": _str(row.get("library_name")),
            "downloads": _int(row.get("downloads")),
            "likes": _int(row.get("likes")),
            "model_family": _str(row.get("model_family")),
            "benchmark_avg": _float(row.get("benchmark_avg")),
            "architecture": _str(row.get("architecture")),
        })
    return models


def query_sparklines(client):
    # Only fetch sparklines for repos with recent activity
    active_filter = """
        AND repo IN (
          SELECT repo FROM currentai.metrics.daily
          WHERE day >= CURRENT_DATE - INTERVAL '91' DAY
            AND metric = 'commits'
            AND value > 0
          GROUP BY repo
        )
    """

    print("  Querying sparklines — stars+forks for active repos (weekly, 91 days)...")
    events_df = client.to_pandas(f"""
        SELECT
          repo,
          DATE_TRUNC('week', day) AS week,
          metric,
          SUM(value) AS total
        FROM currentai.metrics.daily
        WHERE day >= CURRENT_DATE - INTERVAL '91' DAY
          AND metric IN ('stars', 'forks')
          {active_filter}
        GROUP BY repo, DATE_TRUNC('week', day), metric
        ORDER BY repo, week
    """)

    print("  Querying sparklines — contributors for active repos (weekly, 91 days)...")
    contrib_df = client.to_pandas(f"""
        SELECT
          repo,
          DATE_TRUNC('week', day) AS week,
          MAX(value) AS total
        FROM currentai.metrics.daily
        WHERE day >= CURRENT_DATE - INTERVAL '91' DAY
          AND metric = 'contributors'
          {active_filter}
        GROUP BY repo, DATE_TRUNC('week', day)
        ORDER BY repo, week
    """)

    sparklines = {}
    for _, row in events_df.iterrows():
        repo = row["repo"]
        if repo not in sparklines:
            sparklines[repo] = {"stars": [], "forks": [], "contributors": []}
        metric = row["metric"]
        if metric in sparklines[repo]:
            sparklines[repo][metric].append(_int(row.get("total")))

    for _, row in contrib_df.iterrows():
        repo = row["repo"]
        if repo not in sparklines:
            sparklines[repo] = {"stars": [], "forks": [], "contributors": []}
        sparklines[repo]["contributors"].append(_int(row.get("total")))

    return sparklines


def query_taxonomy(client):
    print("  Querying taxonomy...")
    df = client.to_pandas("SELECT * FROM currentai.scores.taxonomy")
    taxonomy = []
    for _, row in df.iterrows():
        taxonomy.append({
            "project_slug": row["project_slug"],
            "osai_layer": row["osai_layer"],
            "osai_subcategory": row["osai_subcategory"],
            "osai_subcategory_id": _str(row.get("osai_subcategory_id")),
            "gap_score": _float(row.get("gap_score")) or 0,
            "parity_verdict": _str(row.get("parity_verdict")),
        })
    return taxonomy


def enrich_layers(layers, taxonomy, repos):
    repo_map = {r["repo"]: r for r in repos}
    for layer in layers:
        for sub in layer["subcategories"]:
            matching_slugs = [
                t["project_slug"] for t in taxonomy
                if t["osai_layer"] == layer["layer"]
                and t["osai_subcategory"] == sub["subcategory"]
            ]
            unique_slugs = list(set(matching_slugs))
            sub["project_count"] = len(unique_slugs)
            matching_repos = [
                repo_map[s] for s in unique_slugs if s in repo_map
            ]
            top = sorted(matching_repos, key=lambda r: r["stars"], reverse=True)[:3]
            sub["top_projects"] = [
                r["repo"].split("/")[-1] for r in top
            ]


def validate(bundle):
    errors = []
    warnings = []
    layers = bundle["layers"]
    repos = bundle["repos"]
    projects = bundle["projects"]
    taxonomy = bundle["taxonomy"]
    sparklines = bundle["sparklines"]
    packages = bundle["packages"]
    models = bundle["models"]

    if len(layers) < 4:
        errors.append(f"Only {len(layers)} layers (expected 8)")
    for layer in layers:
        for sub in layer["subcategories"]:
            if sub.get("project_count", 0) < 2:
                star_count = sum(
                    1 for t in taxonomy
                    if t["osai_layer"] == layer["layer"]
                    and t["osai_subcategory"] == sub["subcategory"]
                    and any(
                        p["total_stars"] > 100 for p in projects
                        if p["project_slug"] == t["project_slug"]
                    )
                )
                if star_count < 2:
                    warnings.append(
                        f"{layer['layer']} > {sub['subcategory']}: "
                        f"only {star_count} recognizable projects (stars>100)"
                    )

    if not (10_000 <= len(repos) <= 20_000):
        errors.append(f"Repo count {len(repos)} outside expected range 10K-20K")
    if not (8_000 <= len(projects) <= 18_000):
        errors.append(f"Project count {len(projects)} outside expected range 8K-18K")
    if len(sparklines) < len(repos) * 0.5:
        warnings.append(f"Sparklines cover only {len(sparklines)}/{len(repos)} repos")

    neg_stars = sum(1 for r in repos if r["stars"] < 0)
    if neg_stars:
        errors.append(f"{neg_stars} repos with negative stars")
    empty_cat = sum(1 for r in repos if not r.get("category"))
    if empty_cat > len(repos) * 0.1:
        warnings.append(f"{empty_cat} repos missing category")
    country_pct = sum(1 for r in repos if r.get("country")) / max(len(repos), 1)
    if country_pct < 0.3:
        warnings.append(f"Country coverage only {country_pct:.0%} (expected >30%)")
    active = sum(1 for r in repos if r.get("commits_90d", 0) > 0)
    if active < 1000:
        warnings.append(f"Only {active} repos with nonzero commits_90d")
    if not (1_000 <= len(packages) <= 5_000):
        warnings.append(f"Package count {len(packages)} outside expected range")
    if not (3_000 <= len(models) <= 10_000):
        warnings.append(f"Model count {len(models)} outside expected range")

    project_layers = {}
    for t in taxonomy:
        project_layers.setdefault(t["osai_layer"], set()).add(t["project_slug"])
    for layer_name, expected in SPOT_CHECKS.items():
        layer_projects = project_layers.get(layer_name, set())
        for slug in expected:
            found = any(slug in p for p in layer_projects)
            if not found:
                warnings.append(f"Spot check: '{slug}' not found in {layer_name}")

    return errors, warnings


def export_data(skip_validation=False):
    client = get_client()
    print("Exporting ecosystem data...")

    layers = query_layers(client)
    projects = query_projects(client)
    repos = query_repos(client)
    packages = query_packages(client)
    models = query_models(client)
    sparklines = query_sparklines(client)
    taxonomy = query_taxonomy(client)

    enrich_layers(layers, taxonomy, repos)

    bundle = {
        "generated": str(datetime.date.today()),
        "layers": layers,
        "projects": projects,
        "repos": repos,
        "packages": packages,
        "models": models,
        "sparklines": sparklines,
        "taxonomy": taxonomy,
    }

    if not skip_validation:
        errors, warnings = validate(bundle)
        for w in warnings:
            print(f"  WARN: {w}")
        for e in errors:
            print(f"  ERROR: {e}")
        if errors:
            print("Validation failed. Use --skip-validation to override.")
            sys.exit(1)

    print(f"  {len(layers)} layers, {len(repos)} repos, {len(projects)} projects")
    print(f"  {len(packages)} packages, {len(models)} models, {len(sparklines)} sparklines")
    return bundle


def validate_only(path):
    with open(path) as f:
        bundle = json.load(f)
    errors, warnings = validate(bundle)
    for w in warnings:
        print(f"  WARN: {w}")
    for e in errors:
        print(f"  ERROR: {e}")
    if errors:
        print("Validation FAILED.")
        sys.exit(1)
    else:
        print("Validation passed.")


def main():
    parser = argparse.ArgumentParser(description="Export ecosystem data to JSON")
    parser.add_argument("--output", help="Write to file instead of stdout")
    parser.add_argument("--skip-validation", action="store_true")
    parser.add_argument("--validate-only", metavar="FILE", help="Validate existing file")
    args = parser.parse_args()

    if args.validate_only:
        validate_only(args.validate_only)
        return

    bundle = export_data(skip_validation=args.skip_validation)
    content = json.dumps(bundle, separators=(",", ":"))

    if args.output:
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, "w") as f:
            f.write(content)
        size_mb = len(content) / 1_000_000
        print(f"Written to {args.output} ({size_mb:.1f} MB)")
    else:
        print(json.dumps(bundle, indent=2)[:3000])
        if len(content) > 3000:
            print(f"\n... ({len(content)} chars total)")


if __name__ == "__main__":
    main()
