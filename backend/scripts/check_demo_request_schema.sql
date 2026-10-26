-- Read-only diagnostics. Run on the database used by aimplify-backend-prod.
SELECT current_database() AS database_name, version_num FROM alembic_version;

-- Migration 034 creates the parent table and demo_requests.batch_id.
SELECT to_regclass('public.demo_request_batches') AS batch_table;

-- Migration 035 adds request_type and permits platform requests without asset_id.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'demo_requests' AND column_name IN
       ('batch_id', 'request_type', 'asset_id', 'requester_id', 'requester_name', 'requester_email'))
       OR table_name = 'demo_request_batches')
ORDER BY table_name, ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = to_regclass('public.demo_requests')
  AND (conname = 'ck_demo_request_target' OR contype = 'f');

-- Check whether a failed browser attempt actually saved a batch before retrying.
SELECT id, customer_name, project_name, requested_at
FROM demo_request_batches
ORDER BY requested_at DESC
LIMIT 20;
