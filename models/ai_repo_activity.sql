-- Model: ai_repo_activity
-- Dataset: currentai.ai_repo_activity
-- Table: currentai.ai_repo_activity.ai_repo_activity
-- Kind: FULL (daily cron)
--
-- Per-repo activity metrics: total stars, 7-day stars, 90-day stars/forks
-- from GitHub Archive, GoodAI contributor count, FT/PT contributors from
-- OpenDevData. Single source of truth for all notebook repo-level queries.
--
-- Columns:
--   repo                — GitHub owner/name (lowercased)
--   category            — GoodAI List category
--   subcategory         — GoodAI List primary subcategory
--   total_stars         — Current total star count
--   star_7d             — Stars gained in last 7 days (from GoodAI)
--   goodai_contributors — Contributor count from GoodAI List
--   language            — Primary programming language
--   country             — Maintainer country
--   stars_90d           — New stars in last 90 days (GitHub Archive events)
--   forks_90d           — New forks in last 90 days (GitHub Archive events)
--   total_contributors  — Active contributors last 90 days (OpenDevData)
--   full_time           — Full-time contributors (>=10 active days/28d)
--   part_time           — Part-time contributors (1-9 active days/28d)

WITH ai_repos AS (
  SELECT
    LOWER(repo) AS repo,
    LOWER(SPLIT_PART(repo, '/', 1)) AS owner,
    LOWER(SPLIT_PART(repo, '/', 2)) AS name,
    category,
    TRIM(SPLIT_PART(subcat, ',', 1)) AS subcategory,
    CAST(stars AS BIGINT) AS total_stars,
    CAST(star_7d AS BIGINT) AS star_7d,
    CAST(contributors AS BIGINT) AS goodai_contributors,
    language,
    country,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(repo)
      ORDER BY updated_at DESC NULLS LAST
    ) AS _rn
  FROM currentai.goodailist_repos.repos
),
deduped AS (
  SELECT repo, owner, name, category, subcategory, total_stars, star_7d, goodai_contributors, language, country
  FROM ai_repos WHERE _rn = 1
),
star_fork_events AS (
  SELECT
    d.repo,
    COUNT(CASE WHEN ev.event_type = 'STARRED' THEN 1 END) AS stars_90d,
    COUNT(CASE WHEN ev.event_type = 'FORKED' THEN 1 END) AS forks_90d
  FROM deduped d
  JOIN oso.int_events__github_unified ev
    ON LOWER(ev.to_artifact_namespace) = d.owner
    AND LOWER(ev.to_artifact_name) = d.name
  WHERE ev.event_type IN ('STARRED', 'FORKED')
    AND ev.time >= CURRENT_DATE - INTERVAL '90' DAY
  GROUP BY d.repo
),
contrib AS (
  SELECT
    d.repo,
    COUNT(DISTINCT rda.canonical_developer_id) AS total_contributors,
    COUNT(DISTINCT CASE WHEN rda.l28_days >= 10 THEN rda.canonical_developer_id END) AS full_time,
    COUNT(DISTINCT CASE WHEN rda.l28_days BETWEEN 1 AND 9 THEN rda.canonical_developer_id END) AS part_time
  FROM deduped d
  JOIN oso.int_opendevdata__repositories_with_repo_id r
    ON LOWER(r.repo_name) = d.repo
  JOIN oso.stg_opendevdata__repo_developer_28d_activities rda
    ON rda.repo_id = r.opendevdata_id
  WHERE rda.day >= CURRENT_DATE - INTERVAL '90' DAY
  GROUP BY d.repo
)
SELECT
  d.repo,
  d.category,
  d.subcategory,
  d.total_stars,
  d.star_7d,
  d.goodai_contributors,
  d.language,
  d.country,
  COALESCE(sf.stars_90d, 0) AS stars_90d,
  COALESCE(sf.forks_90d, 0) AS forks_90d,
  COALESCE(c.total_contributors, 0) AS total_contributors,
  COALESCE(c.full_time, 0) AS full_time,
  COALESCE(c.part_time, 0) AS part_time
FROM deduped d
LEFT JOIN star_fork_events sf ON d.repo = sf.repo
LEFT JOIN contrib c ON d.repo = c.repo
