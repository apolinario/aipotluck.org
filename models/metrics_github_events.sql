-- Model: metrics.github_events
-- Dataset: currentai.metrics
-- Table: currentai.metrics.github_events
-- Kind: FULL (daily cron)
--
-- Pre-filtered GitHub Archive events for repos in our catalog.
-- Keyed by github_id (stable across renames) where available,
-- falls back to name matching. 12-month rolling window.
-- Downstream: metrics.daily aggregates from this.

WITH repo_ids AS (
  SELECT
    repo,
    github_id,
    LOWER(SPLIT_PART(repo, '/', 1)) AS owner,
    LOWER(SPLIT_PART(repo, '/', 2)) AS name
  FROM currentai.entities.repos
)
SELECT
  r.github_id,
  r.repo,
  ev.event_type,
  ev.time
FROM repo_ids r
JOIN oso.int_events__github_unified ev
  ON LOWER(ev.to_artifact_namespace) = r.owner
  AND LOWER(ev.to_artifact_name) = r.name
WHERE ev.time >= CURRENT_DATE - INTERVAL '365' DAY
