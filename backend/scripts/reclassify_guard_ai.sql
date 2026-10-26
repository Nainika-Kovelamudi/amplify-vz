-- Review the identity first. This script deliberately refuses title-only matches.
SELECT id, catalog_code, title, family, status
FROM catalog_assets
WHERE catalog_code IN ('TTN-010', 'TIT-010')
   OR regexp_replace(lower(title), '[^a-z0-9]', '', 'g') = 'guardai';

BEGIN;
DO $$
DECLARE
    target catalog_assets%ROWTYPE;
    matches integer;
BEGIN
    SELECT count(*) INTO matches FROM catalog_assets
    WHERE catalog_code = 'TTN-010'
      AND regexp_replace(lower(title), '[^a-z0-9]', '', 'g') = 'guardai';
    IF matches <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one Guard AI with code TTN-010; found %. Review the SELECT output and use its verified code.', matches;
    END IF;
    SELECT * INTO target FROM catalog_assets WHERE catalog_code = 'TTN-010' FOR UPDATE;
    IF lower(target.family) = 'sentinel' THEN
        RAISE NOTICE 'Guard AI is already Sentinel; no change made.';
        RETURN;
    END IF;
    IF lower(target.family) <> 'titan' THEN
        RAISE EXCEPTION 'Unexpected existing family: %', target.family;
    END IF;
    UPDATE catalog_assets SET family = 'Sentinel', updated_at = now() WHERE id = target.id;
    UPDATE submissions SET family = 'Sentinel', updated_at = now()
    WHERE catalog_code IN (target.id::text, target.catalog_code)
      AND status::text NOT IN ('Archived', 'Rejected');
    INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, metadata)
    VALUES ('62503c3f-d2df-4e11-a9cc-a47ea9ee02ee', NULL, 'asset_family_changed', 'catalog_asset', target.id,
        json_build_object('previous_family',target.family,'family','Sentinel','source','manual SQL correction'));
END $$;
COMMIT;
-- Codes, slugs, document links, approval status and scores are retained.
-- The application family-save route also schedules knowledge-base reindexing.
