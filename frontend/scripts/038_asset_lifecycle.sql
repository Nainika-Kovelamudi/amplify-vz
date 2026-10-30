-- PostgreSQL: apply only when all migrations through 037 are completed.
BEGIN;
LOCK TABLE alembic_version IN EXCLUSIVE MODE;
DO $$ BEGIN
  IF (SELECT count(*) FROM alembic_version) <> 1 OR NOT EXISTS
    (SELECT 1 FROM alembic_version WHERE version_num = '037') THEN
    RAISE EXCEPTION 'Expected database revision 037. No changes applied.';
  END IF;
END $$;
ALTER TYPE asset_status_enum ADD VALUE IF NOT EXISTS 'Deprecated';
ALTER TYPE asset_status_enum ADD VALUE IF NOT EXISTS 'Decommissioned';
ALTER TYPE submission_status_enum ADD VALUE IF NOT EXISTS 'Deprecated';
ALTER TYPE submission_status_enum ADD VALUE IF NOT EXISTS 'Decommissioned';
UPDATE alembic_version SET version_num='038' WHERE version_num='037';
COMMIT;
