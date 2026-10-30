-- PostgreSQL alternative to: python -m alembic upgrade 039
-- Run on the SAME database used by the deployed backend, after migrations through 038.
BEGIN;
DO $$
BEGIN
    IF (SELECT count(*) FROM alembic_version) <> 1 OR
       NOT EXISTS (SELECT 1 FROM alembic_version WHERE version_num = '038') THEN
        RAISE EXCEPTION 'Expected a single Alembic revision 038. Apply/verify earlier migrations first.';
    END IF;
END $$;

CREATE TABLE meeting_plans (
    id UUID PRIMARY KEY,
    requester_id UUID NOT NULL REFERENCES user_profiles(id),
    state VARCHAR(20) NOT NULL,
    revision INTEGER NOT NULL,
    content JSON NOT NULL,
    recommendations JSON NOT NULL,
    recommendation_hash VARCHAR(64),
    batch_id UUID UNIQUE REFERENCES demo_request_batches(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_meeting_plans_requester_id ON meeting_plans(requester_id);
CREATE TABLE meeting_plan_assets (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES meeting_plans(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES catalog_assets(id) ON DELETE SET NULL,
    asset_title VARCHAR NOT NULL,
    selected_via VARCHAR(20) NOT NULL,
    CONSTRAINT uq_meeting_plan_asset UNIQUE(plan_id, asset_id)
);
CREATE INDEX ix_meeting_plan_assets_plan_id ON meeting_plan_assets(plan_id);
UPDATE alembic_version SET version_num = '039' WHERE version_num = '038';
COMMIT;

SELECT version_num FROM alembic_version;
SELECT to_regclass('meeting_plans'), to_regclass('meeting_plan_assets');
