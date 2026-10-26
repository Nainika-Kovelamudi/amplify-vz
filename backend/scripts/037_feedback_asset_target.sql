-- Apply only to the AImplify database at revision 036, or use Alembic (not both).
BEGIN;
DO $$ BEGIN
 IF (SELECT count(*) FROM alembic_version) <> 1 OR NOT EXISTS (SELECT 1 FROM alembic_version WHERE version_num='036') THEN
  RAISE EXCEPTION 'Expected exactly one Alembic revision: 036. Check the database revision first.';
 END IF;
END $$;
ALTER TABLE platform_feedback ADD COLUMN asset_id UUID;

ALTER TABLE platform_feedback ADD COLUMN asset_title VARCHAR;

ALTER TABLE platform_feedback ADD CONSTRAINT fk_platform_feedback_asset_id FOREIGN KEY(asset_id) REFERENCES catalog_assets (id) ON DELETE SET NULL;

CREATE INDEX ix_platform_feedback_asset_id ON platform_feedback (asset_id);


UPDATE alembic_version SET version_num='037' WHERE version_num='036';
COMMIT;
