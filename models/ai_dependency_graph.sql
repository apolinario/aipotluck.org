-- Model: ai_dependency_graph
-- Dataset: currentai.ai_dependency_graph
-- Table: currentai.ai_dependency_graph.ai_dependency_graph
-- Kind: FULL (rebuilds weekly)
--
-- Transitive dependency graph between AI repos in our catalog.
-- Uses int_code_dependencies (repo→package→owning repo) filtered to repos
-- in ai_repo_activity, then expands transitively to depth 2.
-- Depth 3 exceeds Trino's 15GB per-node memory limit.
--
-- Each row is a directed edge: dependent_repo uses dependency_repo,
-- with the shortest path depth and metadata on both sides.
-- ~25K edges (6.3K direct + 19.4K transitive).
--
-- Columns:
--   dependent_repo       — repo that consumes the dependency
--   dependent_category   — GoodAI category of the dependent
--   dependency_repo      — repo that provides the dependency
--   dependency_category  — GoodAI category of the provider
--   min_depth            — shortest path (1=direct, 2=one hop)
--   dependent_stars      — star count of the dependent repo
--   dependency_stars     — star count of the dependency repo

WITH ai_repos AS (
  SELECT
    repo,
    category,
    CAST(total_stars AS DOUBLE) AS stars
  FROM currentai.ai_repo_activity.ai_repo_activity
),
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
  SELECT DISTINCT
    a.src,
    b.dst
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
  SELECT
    src,
    dst,
    MIN(depth) AS min_depth
  FROM combined
  GROUP BY src, dst
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
