-- =============================================================================
-- Amplify Platform — PostgreSQL Schema
-- Local development / testing
-- Run: psql -U postgres -d amplify -f schema.sql
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4()

-- =============================================================================
-- Enum Types
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('Aimplify.User', 'Aimplify.Admin', 'Amplify.Owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE asset_maturity_enum AS ENUM ('Prototype', 'Beta', 'Production');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE asset_status_enum AS ENUM (
        'Draft', 'AI_Review', 'Manual_Approval', 'Approved',
        'Published', 'Needs_Changes', 'Archived'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE submission_status_enum AS ENUM (
        'Submitted', 'AI_Review', 'Manual_Approval', 'Approved',
        'Published', 'Needs_Changes', 'Archived'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE clone_environment_enum AS ENUM (
        'Development', 'Staging', 'Production', 'Research'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE clone_status_enum AS ENUM ('Pending', 'Approved', 'Denied');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- Tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- user_profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    azure_oid       VARCHAR     NOT NULL UNIQUE,
    email           VARCHAR     NOT NULL UNIQUE,
    display_name    VARCHAR,
    role            user_role_enum NOT NULL DEFAULT 'guest',
    department      VARCHAR,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_azure_oid ON user_profiles (azure_oid);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email     ON user_profiles (email);

-- -----------------------------------------------------------------------------
-- catalog_assets
-- repo_url is stored but NEVER returned in API responses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_assets (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_code    VARCHAR     NOT NULL UNIQUE,
    title           VARCHAR     NOT NULL,
    slug            VARCHAR     NOT NULL UNIQUE,
    description     TEXT        NOT NULL,
    family          VARCHAR     NOT NULL,
    department      VARCHAR     NOT NULL,
    tech_stack      JSONB,
    cloud_provider  VARCHAR,
    maturity        asset_maturity_enum NOT NULL,
    demo_ready      BOOLEAN     NOT NULL DEFAULT FALSE,
    video_url       VARCHAR,
    thumbnail_url   VARCHAR,
    repo_url        VARCHAR,         -- NEVER exposed in API responses
    repo_blob_path  VARCHAR,
    status          asset_status_enum NOT NULL DEFAULT 'Draft',
    ai_score        INTEGER,
    ai_feedback     JSONB,
    owner_id        UUID        NOT NULL REFERENCES user_profiles (id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_assets_catalog_code ON catalog_assets (catalog_code);
CREATE INDEX IF NOT EXISTS idx_catalog_assets_slug         ON catalog_assets (slug);
CREATE INDEX IF NOT EXISTS idx_catalog_assets_owner_id     ON catalog_assets (owner_id);
CREATE INDEX IF NOT EXISTS idx_catalog_assets_status       ON catalog_assets (status);
CREATE INDEX IF NOT EXISTS idx_catalog_assets_family       ON catalog_assets (family);

-- -----------------------------------------------------------------------------
-- submissions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_code    VARCHAR,
    title           VARCHAR     NOT NULL,
    description     TEXT        NOT NULL,
    family          VARCHAR     NOT NULL,
    department      VARCHAR     NOT NULL,
    tech_stack      JSONB,
    cloud_provider  VARCHAR,
    maturity        VARCHAR     NOT NULL,
    demo_ready      BOOLEAN     NOT NULL DEFAULT FALSE,
    video_url       VARCHAR,
    repo_url        VARCHAR,
    status          submission_status_enum NOT NULL DEFAULT 'Submitted',
    ai_score        INTEGER,
    ai_feedback     JSONB,
    admin_notes     TEXT,
    submitter_id    UUID        NOT NULL REFERENCES user_profiles (id),
    reviewed_by     UUID        REFERENCES user_profiles (id),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_submitter_id  ON submissions (submitter_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status        ON submissions (status);
CREATE INDEX IF NOT EXISTS idx_submissions_catalog_code  ON submissions (catalog_code);

-- -----------------------------------------------------------------------------
-- clone_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clone_requests (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id            UUID        NOT NULL REFERENCES catalog_assets (id),
    requester_id        UUID        NOT NULL REFERENCES user_profiles (id),
    reason              TEXT        NOT NULL,
    environment         clone_environment_enum NOT NULL,
    status              clone_status_enum NOT NULL DEFAULT 'Pending',
    owner_notified_at   TIMESTAMPTZ,
    decided_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clone_requests_asset_id     ON clone_requests (asset_id);
CREATE INDEX IF NOT EXISTS idx_clone_requests_requester_id ON clone_requests (requester_id);

-- -----------------------------------------------------------------------------
-- clone_tokens  (single-use, 24 h expiry)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clone_tokens (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clone_request_id    UUID        NOT NULL UNIQUE REFERENCES clone_requests (id),
    token_uuid          UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    expires_at          TIMESTAMPTZ NOT NULL,
    redeemed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clone_tokens_token_uuid ON clone_tokens (token_uuid);

-- -----------------------------------------------------------------------------
-- activity_logs  — APPEND-ONLY, no UPDATE or DELETE ever
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID        REFERENCES user_profiles (id),
    action      VARCHAR     NOT NULL,
    entity_type VARCHAR     NOT NULL,
    entity_id   UUID,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id    ON activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action      ON activity_logs (action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs (entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_id   ON activity_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at  ON activity_logs (created_at DESC);

-- Enforce append-only at DB level
CREATE OR REPLACE RULE no_update_activity_logs AS
    ON UPDATE TO activity_logs DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_activity_logs AS
    ON DELETE TO activity_logs DO INSTEAD NOTHING;

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id    UUID        NOT NULL REFERENCES user_profiles (id),
    title           VARCHAR     NOT NULL,
    body            VARCHAR     NOT NULL,
    read            BOOLEAN     NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    event_type      VARCHAR     NOT NULL,
    entity_id       UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type   ON notifications (event_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read         ON notifications (recipient_id, read);

-- =============================================================================
-- updated_at auto-update trigger (replaces SQLAlchemy's onupdate in pure SQL)
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON user_profiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON catalog_assets;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON catalog_assets
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON submissions;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON clone_requests;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON clone_requests
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

-- =============================================================================
-- Seed: dev users for local testing (Standard User, Admin, Owner)
-- =============================================================================
INSERT INTO user_profiles (azure_oid, email, display_name, role, department)
VALUES
    ('local-dev-oid-001', 'standarduser@amplify.local', 'Standard User',  'Aimplify.User',  'Engineering'),
    ('local-dev-oid-002', 'admin@amplify.local',        'Local Admin',    'Aimplify.Admin', 'Engineering'),
    ('local-dev-oid-003', 'owner@amplify.local',        'Platform Owner', 'Amplify.Owner',  'Engineering')
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- Done
-- =============================================================================
-- psql output should show:
--   CREATE TABLE (x7), CREATE INDEX (x18), CREATE RULE (x2),
--   CREATE TRIGGER (x4), INSERT 0 1
