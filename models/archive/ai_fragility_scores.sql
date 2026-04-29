-- Model: ai_fragility_scores
-- Dataset: currentai.ai_fragility_scores
-- Table: currentai.ai_fragility_scores.ai_fragility_scores
-- Kind: FULL (rebuilds weekly)
--
-- Fragility analysis: which foundation projects have high downstream
-- impact but low maintainer capacity? Crosses the dependency graph
-- with contributor counts to surface single points of failure.
--
-- Columns:
--   repo                 — GitHub owner/name
--   category             — GoodAI category
--   total_stars          — star count
--   full_time            — full-time contributors (≥10 active days/28d)
--   part_time            — part-time contributors (1-9 active days/28d)
--   total_contributors   — FT + PT from OpenDevData
--   direct_dependents    — AI repos that directly depend on this
--   transitive_dependents — AI repos that transitively depend on this
--   total_dependents     — direct + transitive
--   transitive_ratio     — fraction of dependents that are transitive
--   fragility_score      — dependents / max(contributors, 1) — higher = more fragile

WITH dep_counts AS (
  SELECT
    dependency_repo AS repo,
    COUNT(*) AS total_dependents,
    COUNT(CASE WHEN min_depth = 1 THEN 1 END) AS direct_dependents,
    COUNT(CASE WHEN min_depth = 2 THEN 1 END) AS transitive_dependents
  FROM currentai.ai_dependency_graph.ai_dependency_graph
  GROUP BY dependency_repo
)
SELECT
  a.repo,
  a.category,
  CAST(a.total_stars AS BIGINT) AS total_stars,
  CAST(a.full_time AS INTEGER) AS full_time,
  CAST(a.part_time AS INTEGER) AS part_time,
  CAST(CASE
    WHEN a.total_contributors > 0 THEN a.total_contributors
    ELSE a.goodai_contributors
  END AS INTEGER) AS total_contributors,
  d.direct_dependents,
  d.transitive_dependents,
  d.total_dependents,
  ROUND(CAST(d.transitive_dependents AS DOUBLE) / d.total_dependents, 3) AS transitive_ratio,
  ROUND(
    CAST(d.total_dependents AS DOUBLE)
    / GREATEST(
        CAST(CASE
          WHEN a.total_contributors > 0 THEN a.total_contributors
          ELSE a.goodai_contributors
        END AS DOUBLE),
        1.0
      ),
    2
  ) AS fragility_score
FROM dep_counts d
INNER JOIN currentai.ai_repo_activity.ai_repo_activity a
  ON d.repo = a.repo
ORDER BY d.total_dependents DESC
