-- PostgreSQL: run against the correct AImplify database.
-- Requires revision 033. Creates tables and preserves existing audit data.
BEGIN;

DO $guard$
BEGIN
  IF (SELECT count(*) FROM alembic_version) <> 1 OR NOT EXISTS (SELECT 1 FROM alembic_version WHERE version_num = '033') THEN
    RAISE EXCEPTION 'Expected Alembic revision 033. Check alembic_version before running this script.';
  END IF;
END;
$guard$;

CREATE TABLE platform_feedback (
    id UUID NOT NULL, 
    submitter_id UUID, 
    name VARCHAR, 
    email VARCHAR NOT NULL, 
    comment TEXT NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(submitter_id) REFERENCES user_profiles (id) ON DELETE SET NULL
);

CREATE INDEX ix_platform_feedback_submitter_id ON platform_feedback (submitter_id);

CREATE TABLE demo_request_batches (
    id UUID NOT NULL, 
    requester_id UUID NOT NULL, 
    customer_name VARCHAR NOT NULL, 
    project_name VARCHAR NOT NULL, 
    vertical VARCHAR, 
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(requester_id) REFERENCES user_profiles (id)
);

CREATE INDEX ix_demo_request_batches_requester_id ON demo_request_batches (requester_id);

ALTER TABLE demo_requests ADD COLUMN batch_id UUID;

ALTER TABLE demo_requests ADD CONSTRAINT fk_demo_requests_batch_id FOREIGN KEY(batch_id) REFERENCES demo_request_batches (id);

CREATE INDEX ix_demo_requests_batch_id ON demo_requests (batch_id);

INSERT INTO platform_feedback (id, submitter_id, name, email, comment, created_at)
        SELECT COALESCE(log.entity_id, log.id), profile.id,
               log.metadata::jsonb->>'name',
               COALESCE(log.metadata::jsonb->>'email', profile.email, ''),
               log.metadata::jsonb->>'comment', log.created_at
        FROM activity_logs log LEFT JOIN user_profiles profile ON profile.id = log.actor_id
        WHERE log.action = 'platform_feedback_created' AND log.metadata::jsonb->>'comment' IS NOT NULL
        ON CONFLICT (id) DO NOTHING;

INSERT INTO demo_request_batches (id, requester_id, customer_name, project_name, vertical, requested_at)
        SELECT DISTINCT ON (log.entity_id) log.entity_id, profile.id,
               COALESCE(log.metadata::jsonb->>'customer_name', request.customer_name),
               COALESCE(log.metadata::jsonb->>'project_name', request.project_name),
               request.vertical, log.created_at
        FROM activity_logs log
        JOIN user_profiles profile ON profile.id = log.actor_id
        JOIN demo_requests request ON log.metadata::jsonb->'demo_request_ids' ? request.id::text
        WHERE log.action = 'multi_demo_request_created' AND log.entity_id IS NOT NULL
        ORDER BY log.entity_id, log.created_at
        ON CONFLICT (id) DO NOTHING;

UPDATE demo_requests request SET batch_id = batch.id
        FROM activity_logs log JOIN demo_request_batches batch ON batch.id = log.entity_id
        WHERE log.action = 'multi_demo_request_created'
          AND log.metadata::jsonb->'demo_request_ids' ? request.id::text
          AND request.batch_id IS NULL;


UPDATE alembic_version SET version_num = '034' WHERE version_num = '033';

COMMIT;
