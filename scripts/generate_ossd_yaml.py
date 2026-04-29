"""
Generate oss-directory YAML files from scores.ossd_coverage.

Reads top unmatched orgs and generates project YAML files
for manual review and PR submission to oss-directory.

Usage:
    uv run scripts/generate_ossd_yaml.py --org nvidia          # single org
    uv run scripts/generate_ossd_yaml.py --min-repos 3         # all orgs with 3+ unmatched repos
    uv run scripts/generate_ossd_yaml.py --min-repos 3 --dry-run
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


def get_org_repos(client, org):
    return client.to_pandas(f"""
        SELECT repo, category, subcategory, description
        FROM currentai.entities.repos
        WHERE SPLIT_PART(repo, '/', 1) = '{org}'
          AND NOT is_in_oss_directory
        ORDER BY repo
    """)


def generate_yaml(org, repos_df):
    lines = [
        f"version: 7",
        f"name: {org}",
        f"display_name: {org}",
        f"github:",
    ]
    for _, row in repos_df.iterrows():
        lines.append(f"  - url: https://github.com/{row['repo']}")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(
        description="Generate oss-directory YAML from ossd_coverage"
    )
    parser.add_argument("--org", help="Generate YAML for a single org")
    parser.add_argument("--min-repos", type=int, default=3,
                        help="Min unmatched repos (default: 3)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview without writing files")
    parser.add_argument("--output-dir", default="data/ossd-yaml",
                        help="Output directory (default: data/ossd-yaml)")
    args = parser.parse_args()

    client = get_client()

    if args.org:
        orgs = [args.org]
    else:
        df = client.to_pandas(f"""
            SELECT org, unmatched_repos, total_stars_unmatched, opportunity_type
            FROM currentai.scores.ossd_coverage
            WHERE unmatched_repos >= {args.min_repos}
              AND opportunity_type = 'new_org'
            ORDER BY unmatched_repos DESC
        """)
        orgs = df["org"].tolist()
        print(f"Found {len(orgs)} orgs with {args.min_repos}+ unmatched repos")

    if not args.dry_run:
        os.makedirs(args.output_dir, exist_ok=True)

    generated = 0
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
            print(f"  {path} ({len(repos_df)} repos)")
        generated += 1

    if not args.dry_run and generated:
        print(f"\nGenerated {generated} YAML files in {args.output_dir}/")
        print("Review, then copy to oss-directory/data/projects/ and submit a PR.")


if __name__ == "__main__":
    main()
