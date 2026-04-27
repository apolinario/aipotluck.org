"""
Open Source AI ecosystem data query tool.

Connects to the OSO data warehouse and runs Trino SQL queries against
the Current AI ecosystem data: repo catalogs, developer activity,
star trends, and collection memberships.

Setup:
    uv sync
    export OSO_API_KEY=<your_key>

Usage:
    uv run scripts/query.py "SELECT repo, stars FROM currentai.goodailist_repos.repos LIMIT 5"
    uv run scripts/query.py "top repos by stars"
    uv run scripts/query.py "categories"
    uv run scripts/query.py "collections"
"""

import os
import sys

try:
    from pyoso import Client
except ImportError:
    print("pyoso not installed. Run: uv sync")
    sys.exit(1)


def get_client():
    if not os.environ.get("OSO_API_KEY"):
        print("OSO_API_KEY not set. Get one at https://www.oso.xyz/start")
        print("Must be scoped to the currentai organization.")
        sys.exit(1)
    return Client()


TEMPLATES = {
    "top repos by stars": """
        WITH ranked AS (
          SELECT
            LOWER(repo) AS repo,
            category,
            TRIM(SPLIT_PART(subcat, ',', 1)) AS subcategory,
            CAST(stars AS BIGINT) AS stars,
            CAST(contributors AS BIGINT) AS contributors,
            language,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(repo)
              ORDER BY updated_at DESC NULLS LAST
            ) AS _rn
          FROM currentai.goodailist_repos.repos
        )
        SELECT repo, category, subcategory, stars, contributors, language
        FROM ranked WHERE _rn = 1
        ORDER BY stars DESC
        LIMIT 30
    """,
    "trending": """
        WITH ranked AS (
          SELECT
            LOWER(repo) AS repo,
            category,
            TRIM(SPLIT_PART(subcat, ',', 1)) AS subcategory,
            CAST(stars AS BIGINT) AS stars,
            CAST(star_7d AS BIGINT) AS star_7d,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(repo)
              ORDER BY updated_at DESC NULLS LAST
            ) AS _rn
          FROM currentai.goodailist_repos.repos
        )
        SELECT repo, category, subcategory, stars, star_7d
        FROM ranked WHERE _rn = 1 AND star_7d > 0
        ORDER BY star_7d DESC
        LIMIT 30
    """,
    "categories": """
        WITH ranked AS (
          SELECT
            category,
            LOWER(repo) AS repo,
            CAST(stars AS BIGINT) AS stars,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(repo)
              ORDER BY updated_at DESC NULLS LAST
            ) AS _rn
          FROM currentai.goodailist_repos.repos
        )
        SELECT
          category,
          COUNT(*) AS repos,
          SUM(stars) AS total_stars
        FROM ranked WHERE _rn = 1
        GROUP BY category
        ORDER BY repos DESC
    """,
    "subcategories": """
        WITH ranked AS (
          SELECT
            category,
            TRIM(SPLIT_PART(subcat, ',', 1)) AS subcategory,
            LOWER(repo) AS repo,
            CAST(stars AS BIGINT) AS stars,
            CAST(star_7d AS BIGINT) AS star_7d,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(repo)
              ORDER BY updated_at DESC NULLS LAST
            ) AS _rn
          FROM currentai.goodailist_repos.repos
        )
        SELECT
          category,
          subcategory,
          COUNT(*) AS repos,
          SUM(stars) AS total_stars,
          SUM(star_7d) AS weekly_stars
        FROM ranked WHERE _rn = 1
        GROUP BY category, subcategory
        HAVING COUNT(*) >= 5
        ORDER BY weekly_stars DESC
        LIMIT 40
    """,
    "collections": """
        SELECT
          collection_name,
          COUNT(DISTINCT repo_name) AS repos
        FROM currentai.ossinsights_ai_collections.ossinsights_ai_collections
        GROUP BY collection_name
        ORDER BY repos DESC
    """,
    "gaps": """
        WITH ranked AS (
          SELECT
            category,
            TRIM(SPLIT_PART(subcat, ',', 1)) AS subcategory,
            LOWER(repo) AS repo,
            CAST(stars AS BIGINT) AS stars,
            CAST(contributors AS BIGINT) AS contributors,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(repo)
              ORDER BY updated_at DESC NULLS LAST
            ) AS _rn
          FROM currentai.goodailist_repos.repos
        ),
        agg AS (
          SELECT
            category,
            subcategory,
            COUNT(*) AS repos,
            APPROX_PERCENTILE(CAST(stars AS DOUBLE), 0.5) AS median_stars,
            APPROX_PERCENTILE(CAST(contributors AS DOUBLE), 0.5) AS median_contributors
          FROM ranked WHERE _rn = 1
          GROUP BY category, subcategory
          HAVING COUNT(*) >= 5
        )
        SELECT category, subcategory, repos,
          CAST(median_stars AS BIGINT) AS median_stars,
          CAST(median_contributors AS BIGINT) AS median_contributors
        FROM agg
        WHERE median_contributors < 8 OR median_stars < 800 OR repos < 60
        ORDER BY median_contributors ASC, median_stars ASC
        LIMIT 30
    """,
    "search": None,
}


def looks_like_sql(text):
    first_word = text.strip().split()[0].upper() if text.strip() else ""
    return first_word in ("SELECT", "WITH", "SHOW", "DESCRIBE", "EXPLAIN")


def match_template(question):
    q = question.lower()
    for key, sql in TEMPLATES.items():
        if sql is not None and key in q:
            return sql
    return None


def search_repos(term):
    sql = f"""
        WITH ranked AS (
          SELECT
            LOWER(repo) AS repo,
            category,
            TRIM(SPLIT_PART(subcat, ',', 1)) AS subcategory,
            CAST(stars AS BIGINT) AS stars,
            CAST(contributors AS BIGINT) AS contributors,
            language,
            description,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(repo)
              ORDER BY updated_at DESC NULLS LAST
            ) AS _rn
          FROM currentai.goodailist_repos.repos
        )
        SELECT repo, category, subcategory, stars, contributors, language
        FROM ranked
        WHERE _rn = 1
          AND (
            LOWER(repo) LIKE '%{term.lower()}%'
            OR LOWER(description) LIKE '%{term.lower()}%'
            OR LOWER(subcategory) LIKE '%{term.lower()}%'
          )
        ORDER BY stars DESC
        LIMIT 20
    """
    return sql


def run_query(sql):
    client = get_client()
    df = client.to_pandas(sql)
    return df


def main():
    if len(sys.argv) < 2:
        print("Usage: uv run scripts/query.py <sql_or_question>")
        print()
        print("Examples:")
        print('  uv run scripts/query.py "SELECT repo, stars FROM currentai.goodailist_repos.repos LIMIT 5"')
        print('  uv run scripts/query.py "top repos by stars"')
        print('  uv run scripts/query.py "trending"')
        print('  uv run scripts/query.py "categories"')
        print('  uv run scripts/query.py "subcategories"')
        print('  uv run scripts/query.py "collections"')
        print('  uv run scripts/query.py "gaps"')
        print('  uv run scripts/query.py "search langchain"')
        print()
        print(f"Available templates: {', '.join(k for k, v in TEMPLATES.items() if v is not None)}")
        sys.exit(0)

    query = " ".join(sys.argv[1:])

    if looks_like_sql(query):
        sql = query
    elif query.lower().startswith("search "):
        term = query[7:].strip()
        if not term:
            print("Usage: search <term>")
            sys.exit(1)
        sql = search_repos(term)
    else:
        sql = match_template(query)
        if sql is None:
            print(f"No template matched for: {query}")
            print(f"Available: {', '.join(k for k, v in TEMPLATES.items() if v is not None)}")
            print('Or pass raw SQL, or use "search <term>" to find repos.')
            sys.exit(1)

    df = run_query(sql)
    if df.empty:
        print("No results.")
    else:
        print(df.to_string(index=False))


if __name__ == "__main__":
    main()
