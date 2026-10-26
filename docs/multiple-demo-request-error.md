# Multiple-demo request error

The browser's `POST /demo-requests/multiple` 500 does not identify the production exception. No production traceback or database access was available for this change.

## Confirmed code failure path and correction

The endpoint previously committed the batch and child requests, then performed recipient lookups, owner lookups and bell notifications in the HTTP request's database session. A failure after the first commit could return an error for an already-saved batch. Notification helpers can swallow flush errors, leaving the session unable to commit.

The endpoint now:

- Saves the batch, children, counters and creation audit together; selected assets are locked in stable order to avoid lost counter increments.
- Returns success after saving; notification dispatch uses its own background database session. Platform-only requests still go to platform owners; asset requests retain nominated-owner routing and requester/platform-owner emails.
- Logs notification failures separately, retains saved requests, and attempts email even when bell creation fails.
- Rolls back database creation failures and returns a readable error with a request reference. Missing table/column or incompatible target constraints include a reminder to verify migrations 034 and 035. Unexpected creation failures are also logged with the reference.

Notification delivery remains in-process background work. It is not a durable delivery guarantee across application restarts. Failures are logged; request records remain available in Pipeline.

## Production checks

1. Check **aimplify-backend-prod**, not the development App Service, and the database configured for that app.
2. Run `scripts/check_demo_request_schema.sql` (read-only). Required: `demo_request_batches`, `demo_requests.batch_id`, `demo_requests.request_type`, nullable `demo_requests.asset_id` and the platform/asset target constraint. Check recent batches before resubmitting a failed browser attempt.
3. Apply missing migrations through the established migration workflow. Do not stamp revisions or rerun the standalone SQL blindly. A revision number alone does not establish that the corresponding schema exists.
4. Deploy the regenerated backend ZIP. No frontend change is required for this endpoint fix.
5. Open the production App Service log stream, submit once, and search for `MULTI_DEMO_CREATE`, `MULTI_DEMO_CREATED`, `MULTI_DEMO_CREATE_FAILED` or `MULTI_DEMO_NOTIFY`. The creation error includes a request UUID for correlation.
6. Verify two published assets, platform-only, and a mixed selection. Confirm one batch, one child per unique selected asset, a separate platform child if selected, correct owner routing, Pipeline visibility and emails.

CLI log stream: `az webapp log tail --resource-group rg-dt-cloud-ai-dev --name aimplify-backend-prod`. If application logging is disabled, enable application logging in that app's App Service logs settings and reproduce once.
