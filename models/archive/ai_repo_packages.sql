-- Model: ai_repo_packages
-- Dataset: currentai.ai_repo_packages
-- Table: currentai.ai_repo_packages.ai_repo_packages
-- Kind: FULL (rebuilds weekly)
--
-- Links open-source AI repos (from GoodAI List) to their published
-- packages (NPM, PIP, Go, Maven, NuGet, Rust) via the OSO project registry.
--
-- Columns:
--   repo             — GitHub owner/name (lowercased)
--   category         — GoodAI List top-level category
--   subcategory      — GoodAI List primary subcategory
--   project_name     — OSO project slug
--   display_name     — OSO project display name
--   package_source   — Package registry (NPM, PIP, GO, MAVEN, NUGET, RUST)
--   package_namespace — Package namespace (if applicable)
--   package_name     — Package name in the registry

WITH ai_repos AS (
  SELECT
    LOWER(repo) AS repo,
    category,
    TRIM(SPLIT_PART(subcat, ',', 1)) AS subcategory,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(repo)
      ORDER BY updated_at DESC NULLS LAST
    ) AS _rn
  FROM currentai.goodailist_repos.repos
),
ai_projects AS (
  SELECT DISTINCT
    r.repo,
    r.category,
    r.subcategory,
    a.project_id,
    p.project_name,
    p.display_name
  FROM ai_repos r
  JOIN oso.artifacts_by_project_v1 a
    ON LOWER(a.artifact_namespace || '/' || a.artifact_name) = r.repo
    AND a.artifact_source = 'GITHUB'
  JOIN oso.projects_v1 p
    ON a.project_id = p.project_id
  WHERE r._rn = 1
)
SELECT
  ap.repo,
  ap.category,
  ap.subcategory,
  ap.project_name,
  ap.display_name,
  pkg.artifact_source AS package_source,
  pkg.artifact_namespace AS package_namespace,
  pkg.artifact_name AS package_name
FROM ai_projects ap
JOIN oso.artifacts_by_project_v1 pkg
  ON ap.project_id = pkg.project_id
  AND pkg.artifact_source IN ('NPM', 'PIP', 'GO', 'MAVEN', 'NUGET', 'RUST')
