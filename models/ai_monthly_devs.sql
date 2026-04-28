-- Model: ai_monthly_devs
-- Dataset: currentai.ai_monthly_devs
-- Table: currentai.ai_monthly_devs.ai_monthly_devs
-- Kind: FULL (daily cron)
--
-- Monthly active developer counts by GoodAI category.
-- Full-time: >=10 active days in the 28-day window.
-- Part-time: 1-9 active days.
--
-- Columns:
--   category    — GoodAI List category
--   month       — Month (truncated)
--   active_devs — Total active developers
--   full_time   — Full-time (>=10 active days/28d)
--   part_time   — Part-time (1-9 active days/28d)

WITH gl_repos AS (
  SELECT
    LOWER(repo) AS repo,
    TRIM(category) AS category,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(repo)
      ORDER BY updated_at DESC NULLS LAST
    ) AS _rn
  FROM currentai.goodailist_repos.repos
),
mapped AS (
  SELECT gl.repo, gl.category, r.opendevdata_id AS repo_id
  FROM gl_repos gl
  JOIN oso.int_opendevdata__repositories_with_repo_id r
    ON LOWER(r.repo_name) = gl.repo
  WHERE gl._rn = 1
)
SELECT
  m.category,
  DATE_TRUNC('month', CAST(rda.day AS DATE)) AS month,
  COUNT(DISTINCT rda.canonical_developer_id) AS active_devs,
  COUNT(DISTINCT CASE WHEN rda.l28_days >= 10 THEN rda.canonical_developer_id END) AS full_time,
  COUNT(DISTINCT CASE WHEN rda.l28_days BETWEEN 1 AND 9 THEN rda.canonical_developer_id END) AS part_time
FROM mapped m
JOIN oso.stg_opendevdata__repo_developer_28d_activities rda
  ON rda.repo_id = m.repo_id
WHERE rda.day >= CURRENT_DATE - INTERVAL '90' DAY
GROUP BY m.category, DATE_TRUNC('month', CAST(rda.day AS DATE))
ORDER BY month, category
