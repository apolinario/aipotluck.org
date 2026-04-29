"""
Export mart tables to JSON for the website.

Queries scores.project_summary, scores.taxonomy, scores.repos_summary,
and catalog.osai_gap_map, then assembles them into the MARKET_MAP_DATA
structure that app/src/data.js expects.

Usage:
    uv run scripts/export_website_data.py                     # preview to stdout
    uv run scripts/export_website_data.py --output app/src/data.generated.js
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


def get_client():
    if not os.environ.get("OSO_API_KEY"):
        print("OSO_API_KEY not set.")
        sys.exit(1)
    return Client()


def format_stars(n):
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}k"
    return str(n)


def export_data():
    client = get_client()

    gap_df = client.to_pandas("""
        SELECT layer, subcategory, subcategory_id,
               CAST(overall_score AS DOUBLE) AS overall_score,
               maturity, parity_verdict
        FROM currentai.catalog.osai_gap_map
        WHERE subcategory_id IS NOT NULL AND subcategory_id != ''
    """)

    projects_df = client.to_pandas("""
        WITH ranked AS (
          SELECT
            t.project_slug,
            t.osai_layer,
            t.osai_subcategory,
            p.display_name,
            p.total_stars,
            p.repo_count,
            p.package_count,
            ROW_NUMBER() OVER (
              PARTITION BY t.osai_layer, t.osai_subcategory
              ORDER BY p.total_stars DESC
            ) AS rn
          FROM currentai.scores.taxonomy t
          JOIN currentai.scores.project_summary p
            ON t.project_slug = p.project_slug
          WHERE p.total_stars > 0
        )
        SELECT project_slug, osai_layer, osai_subcategory,
               display_name, total_stars, repo_count, package_count
        FROM ranked WHERE rn <= 10
    """)

    layer_blurbs = {
        "Infrastructure": "Hardware, kernels, and low-level runtimes that make models run.",
        "Model Components: Code": "Training frameworks, fine-tuning tools, and evaluation code.",
        "Model Components: Datasets": "Training data, benchmarks, and data curation tools.",
        "Model Components: Weights": "Pre-trained models, checkpoints, and model hubs.",
        "Product/UX": "Applications, agents, and user-facing AI tools.",
        "Documentation": "Docs, tutorials, courses, and educational resources.",
        "Licensing": "Open licenses, governance frameworks, and compliance tools.",
        "Safeguards": "Safety, alignment, red-teaming, and content moderation.",
    }

    market_map = {"layers": []}
    layer_map = {}

    for _, row in gap_df.iterrows():
        layer_name = row["layer"]
        if layer_name not in layer_map:
            layer_id = (
                layer_name.lower()
                .replace(" ", "_")
                .replace(":", "")
                .replace("/", "_")
            )
            layer_obj = {
                "id": layer_id,
                "title": layer_name,
                "blurb": layer_blurbs.get(layer_name, ""),
                "categories": [],
            }
            layer_map[layer_name] = layer_obj
            market_map["layers"].append(layer_obj)

        health = max(0, min(100, int((row["overall_score"] / 5.0) * 100)))
        cat_obj = {
            "id": row["subcategory_id"],
            "name": row["subcategory"],
            "health": health,
            "parity": row["parity_verdict"],
            "projects": [],
        }

        cat_projects = projects_df[
            (projects_df["osai_layer"] == layer_name)
            & (projects_df["osai_subcategory"] == row["subcategory"])
        ].head(10)

        for _, p in cat_projects.iterrows():
            proj = {
                "slug": p["project_slug"],
                "name": p["display_name"] or p["project_slug"],
                "stars": format_stars(int(p["total_stars"] or 0)),
                "repos": int(p["repo_count"] or 0),
            }
            if p["package_count"] and int(p["package_count"]) > 0:
                proj["packages"] = int(p["package_count"])
            cat_obj["projects"].append(proj)

        layer_map[layer_name]["categories"].append(cat_obj)

    return market_map


def main():
    parser = argparse.ArgumentParser(
        description="Export mart tables to JSON for the website"
    )
    parser.add_argument("--output", help="Write to file instead of stdout")
    args = parser.parse_args()

    data = export_data()
    js_content = (
        "// Auto-generated from OSO data warehouse — do not edit by hand\n"
        f"// Generated: {datetime.date.today()}\n\n"
        f"export const MARKET_MAP_DATA = {json.dumps(data, indent=2)};\n"
    )

    if args.output:
        with open(args.output, "w") as f:
            f.write(js_content)
        print(f"Written to {args.output} ({len(data['layers'])} layers, "
              f"{sum(len(l['categories']) for l in data['layers'])} categories)")
    else:
        print(js_content[:3000])
        if len(js_content) > 3000:
            print(f"\n... ({len(js_content)} chars total)")


if __name__ == "__main__":
    main()
