-- Model: ai_investment_ranking
-- Dataset: currentai.ai_investment_ranking
-- Table: currentai.ai_investment_ranking.ai_investment_ranking
-- Kind: FULL (rebuilds weekly)
--
-- Investment ranking for Current AI: where to deploy resources for
-- maximum ecosystem impact. Combines gap analysis, dependency centrality,
-- and maintainer health into a composite score at the OSAI subcategory level.
--
-- Uses osai_subcategory_mapping to bridge OSAI subcategories to GoodAI
-- subcategories, enabling subcategory-level dependency and fragility stats.
--
-- Scoring dimensions (each 0-100):
--   gap_urgency     — inverted OSAI gap map score (lower = higher urgency)
--   dep_centrality  — normalized max dependency reach for repos in this subcategory
--   fragility_risk  — normalized max fragility score for repos in this subcategory

WITH gap AS (
  SELECT
    layer,
    subcategory,
    subcategory_id,
    CAST(overall_score AS DOUBLE) AS overall_score,
    maturity,
    parity_verdict
  FROM currentai.osai_gap_map.osai_gap_map
),
subcat_map_raw AS (
  SELECT
    osai_layer,
    osai_subcategory,
    TRIM(goodai_sub) AS goodai_subcategory
  FROM currentai.osai_subcategory_mapping.osai_subcategory_mapping
  CROSS JOIN UNNEST(SPLIT(goodai_subcategories, ',')) AS t(goodai_sub)
),
repo_fragility AS (
  SELECT
    a.repo,
    a.subcategory AS goodai_subcategory,
    f.total_dependents,
    f.fragility_score
  FROM currentai.ai_repo_activity.ai_repo_activity a
  LEFT JOIN currentai.ai_fragility_scores.ai_fragility_scores f
    ON a.repo = f.repo
  WHERE a.subcategory IS NOT NULL AND a.subcategory != ''
),
subcat_deps AS (
  SELECT
    sm.osai_layer,
    sm.osai_subcategory,
    MAX(rf.total_dependents) AS max_dependents,
    MAX(rf.fragility_score) AS max_fragility,
    MAX_BY(rf.repo, COALESCE(rf.total_dependents, 0)) AS top_repo,
    COUNT(DISTINCT rf.repo) AS repo_count
  FROM subcat_map_raw sm
  INNER JOIN repo_fragility rf ON sm.goodai_subcategory = rf.goodai_subcategory
  GROUP BY sm.osai_layer, sm.osai_subcategory
),
max_vals AS (
  SELECT
    MAX(max_dependents) AS global_max_deps,
    MAX(max_fragility) AS global_max_frag
  FROM subcat_deps
)
SELECT
  g.layer,
  g.subcategory,
  g.parity_verdict,
  ROUND((5.0 - g.overall_score) / 4.0 * 100, 1) AS gap_urgency,
  sd.top_repo,
  sd.repo_count,
  ROUND(COALESCE(CAST(sd.max_dependents AS DOUBLE), 0) / GREATEST(mv.global_max_deps, 1) * 100, 1) AS dep_centrality,
  sd.max_fragility,
  ROUND(COALESCE(sd.max_fragility, 0) / GREATEST(mv.global_max_frag, 1) * 100, 1) AS fragility_risk,
  ROUND(
    (
      (5.0 - g.overall_score) / 4.0 * 100
      + COALESCE(CAST(sd.max_dependents AS DOUBLE), 0) / GREATEST(mv.global_max_deps, 1) * 100
      + (5.0 - g.overall_score) / 4.0 * 100
      + COALESCE(sd.max_fragility, 0) / GREATEST(mv.global_max_frag, 1) * 100
    ) / 4.0,
    1
  ) AS composite_score
FROM gap g
LEFT JOIN subcat_deps sd
  ON g.layer = sd.osai_layer AND g.subcategory = sd.osai_subcategory
CROSS JOIN max_vals mv
ORDER BY
  (
    (5.0 - g.overall_score) / 4.0 * 100
    + COALESCE(CAST(sd.max_dependents AS DOUBLE), 0) / GREATEST(mv.global_max_deps, 1) * 100
    + (5.0 - g.overall_score) / 4.0 * 100
    + COALESCE(sd.max_fragility, 0) / GREATEST(mv.global_max_frag, 1) * 100
  ) / 4.0 DESC
