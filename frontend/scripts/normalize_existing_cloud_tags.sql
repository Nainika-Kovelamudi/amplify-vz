-- PostgreSQL: one-time normalization of recognized cloud tags.
-- No ownership, family, status or score changes. No Alembic revision change.
-- Run in the backend's database. Default is preview-only (ROLLBACK at end).
-- After reviewing the preview, replace the final ROLLBACK with COMMIT and rerun.
BEGIN;
SET LOCAL lock_timeout = '15s';

CREATE TEMP TABLE cloud_normalization_plan ON COMMIT DROP AS
WITH assets AS (
    SELECT 'catalog_asset'::text AS entity_type, id, title, cloud_provider AS old_value
    FROM catalog_assets
    UNION ALL
    SELECT 'submission', id, title, cloud_provider FROM submissions
), tokens AS (
    SELECT a.*, t.ordinality AS position,
        CASE lower(btrim(t.token))
            WHEN 'azure' THEN 'Azure'
            WHEN 'aws' THEN 'AWS'
            WHEN 'gcp' THEN 'GCP'
            WHEN 'on-prem' THEN 'On-Premise'
            WHEN 'on-premise' THEN 'On-Premise'
            WHEN 'on-premises' THEN 'On-Premise'
            WHEN 'on premises' THEN 'On-Premise'
            WHEN 'hybrid' THEN 'Hybrid'
            WHEN 'multi-cloud' THEN 'Multi-Cloud'
            WHEN 'multi cloud' THEN 'Multi-Cloud'
        END AS canonical
    FROM assets a
    CROSS JOIN LATERAL unnest(string_to_array(a.old_value, ','))
        WITH ORDINALITY AS t(token, ordinality)
    WHERE a.old_value IS NOT NULL AND btrim(a.old_value) <> ''
), classified AS (
    SELECT entity_type, id, title, old_value,
        bool_and(canonical IS NOT NULL) AS recognized
    FROM tokens GROUP BY entity_type, id, title, old_value
), distinct_tags AS (
    SELECT entity_type, id, canonical, min(position) AS first_position
    FROM tokens WHERE canonical IS NOT NULL
    GROUP BY entity_type, id, canonical
), normalized AS (
    SELECT entity_type, id,
        string_agg(canonical, ', ' ORDER BY first_position) AS new_value
    FROM distinct_tags GROUP BY entity_type, id
)
SELECT c.*, n.new_value
FROM classified c LEFT JOIN normalized n USING (entity_type, id);

-- Preview proposed changes; first occurrence order is preserved.
SELECT entity_type, id, title, old_value, new_value
FROM cloud_normalization_plan
WHERE recognized AND old_value IS DISTINCT FROM new_value
ORDER BY entity_type, title;

-- Unknown tags are skipped as a whole; no partial removal of cloud claims.
SELECT entity_type, id, title, old_value AS skipped_value
FROM cloud_normalization_plan WHERE NOT recognized
ORDER BY entity_type, title;

-- Recheck old values during UPDATE so concurrent edits are not overwritten.
WITH changed AS (
    UPDATE catalog_assets a
    SET cloud_provider = p.new_value, updated_at = now()
    FROM cloud_normalization_plan p
    WHERE p.entity_type = 'catalog_asset' AND p.recognized
      AND a.id = p.id AND a.cloud_provider = p.old_value
      AND p.old_value IS DISTINCT FROM p.new_value
    RETURNING a.id, p.old_value, p.new_value
)
INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, metadata)
SELECT md5(random()::text || clock_timestamp()::text || id::text)::uuid,
    NULL, 'cloud_tags_normalized', 'catalog_asset', id,
    json_build_object('previous_cloud_provider', old_value,
        'cloud_provider', new_value, 'source', 'one-time SQL normalization')
FROM changed;

WITH changed AS (
    UPDATE submissions a
    SET cloud_provider = p.new_value, updated_at = now()
    FROM cloud_normalization_plan p
    WHERE p.entity_type = 'submission' AND p.recognized
      AND a.id = p.id AND a.cloud_provider = p.old_value
      AND p.old_value IS DISTINCT FROM p.new_value
    RETURNING a.id, p.old_value, p.new_value
)
INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, metadata)
SELECT md5(random()::text || clock_timestamp()::text || id::text)::uuid,
    NULL, 'cloud_tags_normalized', 'submission', id,
    json_build_object('previous_cloud_provider', old_value,
        'cloud_provider', new_value, 'source', 'one-time SQL normalization')
FROM changed;

-- Preview mode: changes and audit rows above are rolled back together.
ROLLBACK;
