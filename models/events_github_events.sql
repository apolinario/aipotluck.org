-- Model: events.github_events
-- Dataset: currentai.events
-- Table: currentai.events.github_events
-- Kind: FULL (daily cron)
--
-- Pre-filtered GitHub Archive events for repos in our catalog.
-- Joins on numeric github_id (stable across renames).
-- For repos without a known ID, resolves it from recent events.
-- Events under old repo names automatically map to the current name
-- because we select r.repo (current) not the event's namespace/name.
-- 12-month rolling window.

WITH known_ids AS (
  SELECT repo, github_id
  FROM currentai.entities.repos
  WHERE github_id IS NOT NULL
),
resolved_ids AS (
  SELECT
    r.repo,
    CAST(ev.to_artifact_source_id AS BIGINT) AS github_id
  FROM currentai.entities.repos r
  JOIN oso.int_events__github_unified ev
    ON LOWER(ev.to_artifact_namespace) = LOWER(SPLIT_PART(r.repo, '/', 1))
    AND LOWER(ev.to_artifact_name) = LOWER(SPLIT_PART(r.repo, '/', 2))
  WHERE r.github_id IS NULL
    AND ev.time >= CURRENT_DATE - INTERVAL '30' DAY
  GROUP BY r.repo, ev.to_artifact_source_id
),
all_ids AS (
  SELECT repo, github_id FROM known_ids
  UNION ALL
  SELECT repo, github_id FROM resolved_ids
)
SELECT
  r.github_id,
  r.repo,
  ev.event_type,
  ev.time
FROM all_ids r
JOIN oso.int_events__github_unified ev
  ON CAST(ev.to_artifact_source_id AS BIGINT) = r.github_id
WHERE ev.time >= CURRENT_DATE - INTERVAL '365' DAY
