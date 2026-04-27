import marimo

__generated_with = "unknown"
app = marimo.App()


@app.cell(hide_code=True)
def header(mo):
    mo.md(
        """
    # Data Inventory — Open Source AI Ecosystem

    Central inventory of all data sources used for the open-source AI ecosystem mapping.
    Loads and normalizes four sources: **Good AI List** (curated repo catalog),
    **OSS Insights AI Collections** (GitHub collection metadata),
    **OSAI Gap Map** (expert-scored maturity/parity ratings),
    and **OSO Projects** (Open Source Observer project registry).

    **Created:** 2026-04-27 · **Data:** OSO · Current AI · OSS Insights
    """
    )
    return


@app.cell(hide_code=True)
def setup_pyoso():
    import pyoso
    import marimo as mo
    pyoso_db_conn = pyoso.Client().dbapi_connection()
    return mo, pyoso_db_conn


@app.cell(hide_code=True)
def imports():
    import pandas as pd
    import plotly.graph_objects as go
    return go, pd


@app.cell(hide_code=True)
def load_goodailist(mo, pyoso_db_conn):
    df_goodailist = mo.sql(
        f"""
        WITH ranked AS (
          SELECT
            LOWER(repo)                        AS repo,
            LOWER(SPLIT_PART(repo, '/', 1))    AS owner,
            SPLIT_PART(repo, '/', 2)           AS name,
            category,
            TRIM(SPLIT_PART(subcat, ',', 1))   AS primary_subcat,
            CAST(stars        AS DOUBLE)        AS stars,
            CAST(contributors AS DOUBLE)        AS contributors,
            language,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(repo)
              ORDER BY updated_at DESC NULLS LAST
            ) AS _rn
          FROM currentai.goodailist_repos.repos
        )
        SELECT repo, owner, name, category, primary_subcat, stars, contributors, language
        FROM ranked
        WHERE _rn = 1
        """,
        output=False,
        engine=pyoso_db_conn
    )
    return (df_goodailist,)


@app.cell(hide_code=True)
def load_ossinsights(mo, pyoso_db_conn):
    df_ossinsights = mo.sql(
        f"""
        SELECT
          collection_id,
          collection_name,
          repo_id,
          LOWER(repo_name) AS repo,
          github_url
        FROM currentai.ossinsights_ai_collections.ossinsights_ai_collections
        """,
        output=False,
        engine=pyoso_db_conn
    )
    return (df_ossinsights,)


@app.cell(hide_code=True)
def load_osai_gap_map(pd):
    from pathlib import Path

    _data_dir = Path(__file__).parent.parent / "data"
    _csv_files = list(_data_dir.glob("*OSAI gap map*scores_spreadsheet*.csv"))
    _csv_path = _csv_files[0]

    _col_names = [
        "layer", "subcategory", "description", "subcategory_id",
        "breadth", "production_readiness", "ease_of_adoption",
        "documentation", "community_activity", "performance_vs_closed",
        "enterprise_readiness", "interoperability", "sustainability",
        "standardization", "criteria_avg", "overall_score",
        "maturity", "parity_verdict",
    ]

    df_gap_map = pd.read_csv(
        _csv_path,
        skiprows=2,
        names=_col_names,
    )
    return (df_gap_map,)


@app.cell(hide_code=True)
def load_oso_projects(mo, pyoso_db_conn):
    df_oso_projects = mo.sql(
        f"""
        SELECT
          p.project_id,
          p.project_name,
          p.display_name,
          a.artifact_namespace AS owner,
          a.artifact_name      AS name,
          LOWER(a.artifact_namespace || '/' || a.artifact_name) AS repo
        FROM oso.projects_v1 AS p
        JOIN oso.artifacts_by_project_v1 AS a
          ON p.project_id = a.project_id
        WHERE a.artifact_source = 'GITHUB'
          AND a.artifact_type = 'REPOSITORY'
        """,
        output=False,
        engine=pyoso_db_conn
    )
    return (df_oso_projects,)


if __name__ == "__main__":
    app.run()
