-- Alternative to `python -m alembic upgrade head` ONLY when current revision is 035.
-- Do not run both approaches. Review/backup first; this script does not contact storage or AI.
BEGIN;
DO $$ BEGIN
  IF (SELECT count(*) FROM alembic_version) <> 1 OR NOT EXISTS (SELECT 1 FROM alembic_version WHERE version_num='035') THEN
    RAISE EXCEPTION 'Expected exactly one Alembic revision: 035. Use migrations for other versions.';
  END IF;
END $$;
CREATE TABLE evaluation_jobs (
    id UUID NOT NULL, 
    entity_type VARCHAR(20) NOT NULL, 
    entity_id UUID NOT NULL, 
    requested_by UUID, 
    state VARCHAR(20) DEFAULT 'Queued' NOT NULL, 
    attempts INTEGER DEFAULT '0' NOT NULL, 
    options JSON, 
    error TEXT, 
    lease_token VARCHAR(36), 
    lease_until TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_evaluation_target UNIQUE (entity_type, entity_id), 
    FOREIGN KEY(requested_by) REFERENCES user_profiles (id) ON DELETE SET NULL
);

CREATE INDEX ix_evaluation_jobs_state ON evaluation_jobs (state);

CREATE TABLE asset_remediations (
    id UUID NOT NULL, 
    asset_id UUID, 
    asset_title VARCHAR NOT NULL, 
    fingerprint VARCHAR(180) NOT NULL, 
    category VARCHAR(40) NOT NULL, 
    title VARCHAR NOT NULL, 
    action TEXT NOT NULL, 
    severity VARCHAR(20) DEFAULT 'Medium' NOT NULL, 
    state VARCHAR(25) DEFAULT 'Open' NOT NULL, 
    assignee_id UUID, 
    due_at TIMESTAMP WITH TIME ZONE, 
    evidence TEXT, 
    reviewer_id UUID, 
    reviewed_at TIMESTAMP WITH TIME ZONE, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_remediation_finding UNIQUE (asset_id, fingerprint), 
    FOREIGN KEY(asset_id) REFERENCES catalog_assets (id) ON DELETE SET NULL, 
    FOREIGN KEY(assignee_id) REFERENCES user_profiles (id) ON DELETE SET NULL, 
    FOREIGN KEY(reviewer_id) REFERENCES user_profiles (id) ON DELETE SET NULL, 
    FOREIGN KEY(created_by) REFERENCES user_profiles (id) ON DELETE SET NULL
);

CREATE INDEX ix_asset_remediations_asset_id ON asset_remediations (asset_id);

CREATE INDEX ix_asset_remediations_state ON asset_remediations (state);


UPDATE alembic_version SET version_num='036' WHERE version_num='035';
COMMIT;
