-- PostgreSQL. Run once after migration 034, before deploying the new backend.
BEGIN;
DO $guard$
BEGIN
  IF (SELECT count(*) FROM alembic_version) <> 1 OR NOT EXISTS
    (SELECT 1 FROM alembic_version WHERE version_num = '034') THEN
    RAISE EXCEPTION 'Expected revision 034. Check alembic_version before running this script.';
  END IF;
END;
$guard$;
ALTER TABLE demo_requests ADD COLUMN request_type VARCHAR(20) NOT NULL DEFAULT 'asset';
ALTER TABLE demo_requests ALTER COLUMN asset_id DROP NOT NULL;
ALTER TABLE demo_requests ADD CONSTRAINT ck_demo_request_target CHECK (
  (request_type = 'asset' AND asset_id IS NOT NULL) OR
  (request_type = 'platform' AND asset_id IS NULL)
);
UPDATE alembic_version SET version_num = '035' WHERE version_num = '034';
COMMIT;
