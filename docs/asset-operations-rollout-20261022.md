# Asset operations implementation and verification

22 October 2026. Covers the 18 issues in `Aimplifytasks.csv`. Implementation is in the local checkout and deployment packages; no production database, Azure files, Jira statuses or live deployments were changed.

## Implemented behavior

| Area | Implemented | Where to use it |
|---|---|---|
| Evaluation inventory | Includes every catalog asset and lifecycle status. Separates missing, failed, incomplete, stale and complete results; a genuinely evaluated zero is not treated as a failure. | Pipeline → Asset Operations → Asset inventory; `/pipeline?tab=operations` |
| Evaluation recovery | Single/batch recovery (up to 100); explicit refresh for complete results. Catalog-only assets are supported. Approved/published/archived states are preserved. Matching published submission results are reconciled when their inputs match. | Asset inventory → Queue evaluation / select incomplete evaluations |
| Durable processing | PostgreSQL jobs with unique targets, expiring leases, heartbeat and restart recovery. Active jobs cannot be queued twice; three interrupted attempts require manual retry. Old leases and changed inputs cannot overwrite current results. Invalid agent scores and provider fallbacks are failures rather than completed evaluations. | Asset inventory → job state; backend logs; `evaluation_jobs` |
| Scoring transparency | All seven agent weights are displayed, with five-agent legacy support. New evaluations record raw score, applied completeness/checklist caps and missing fields. Before/after agent scores and outcomes are audited. | Asset details / Pipeline asset → AI Evaluation |
| Artifact finalization | Publishing queues eligible files for per-asset storage. Legacy files have a previewable plan and optional filename corrections. Only the configured Azure account's `artifacts` container is eligible. Copies are streamed, independently compared by SHA-256 and byte count, and linked only after verification. Existing destinations are never overwritten; original blobs are retained. | Asset inventory → Review storage plan → confirm file association → Queue verified copy |
| Metadata | Shared API validation for submissions, catalog creates and edits, including FAST families, maturity, email/manager checks, URL safety and corporate repository links. Cloud aliases normalize and deduplicate; cloud filters match individual tags in multi-cloud values. Unrelated legacy gaps do not prevent partial edits. | Submit / Edit asset; API validation; asset inventory repository/cloud filters |
| Report reconciliation | Review records match catalog UUIDs, legacy public codes or publication audit links. Repository validity and evaluation health are included. All catalog assets remain in the quality inventory. | Observability → Asset Quality Report |
| Persistent remediation | Separate `asset_remediations` table for asset-specific and platform-wide issues. Assignees, UTC deadlines, severity, evidence and review identity/date are persisted. Audit findings can generate owner-assigned tasks with a 14-day default deadline, without duplicating existing findings or reopening closed tasks. CSV export is available. | Pipeline → Asset Operations → Remediations |
| Remediation access | Admins/platform owners manage tasks; other users see and update only assigned tasks under My Remediations. Ready for Review requires evidence; Closed requires evidence and an admin/platform owner other than the assignee. | Pipeline → My Remediations / Asset Operations |
| Deployment parity | New modules and migration are included in both legacy ZIPs and the source-only CI ZIP. An offline verifier imports the exact packaged application and checks routes, models, shared validation and migration head. | `python build_backend_zip.py`; `python scripts/verify_backend_package.py` |

Storage relocation verifies byte integrity, not whether a video depicts the correct project. Security document analysis finds evidence leads; it does not certify controls or replace a security review. Repository checks validate the corporate URL pattern, not actual read access or repository contents.

## Deployment steps

Both frontend and backend must be deployed. The new tables are required.

1. Review the existing database revision and take the normal database backup. Validate in development/staging first.
2. Apply migration **036**, after its existing predecessors. Use `python -m alembic upgrade head` in the correctly activated backend runtime. Run migrations once as a deployment step, not separately in each web worker.
3. If the database is **exactly at 035**, the alternative is `scripts/036_evaluation_jobs_and_remediations.sql`. It checks the current revision, creates the tables and advances Alembic to 036 in one transaction. **Use either the migration or the SQL, not both.** Do not stamp a database without creating the tables.
4. Generate packages with `python build_backend_zip.py`. Both `backend.zip` and `backend_prod.zip` contain these changes. The CI alternative is `python scripts/build_ci_backend.py`.
5. Verify the selected package: `python scripts/verify_backend_package.py backend.zip backend_prod.zip`. Deploy the intended ZIP to the matching Azure app. ZIPs contain source, not installed Python dependencies; Azure build automation must install `requirements.txt` as in the existing deployment workflow.
6. Deploy the matching frontend build. Development/staging uses `npm run build:staging`; production uses `npm run build:prod` and `dist_prod`.
7. `EVALUATION_WORKER_ENABLED=true` enables processing (default true). To stage code before schema migration, temporarily set it false, apply the migration, then re-enable and restart. Requests still need the new tables. No new secret is required: evaluation uses the existing Gemini/Groq settings; storage uses the existing blob connection/account credentials. Storage finalization requires an account key for private download references.
8. Verify the new operations routes and migration 036 in the deployed runtime before running batches. Queue one asset first, inspect its results and audit history, then process the remaining inventory.

Queued/running work is recorded in the database and resumes after restart when its lease expires. There is one concurrent job per application process; each scoring job makes parallel agent requests, so test provider quotas before large batches. Automatic retries recover interruptions, not incorrect credentials or invalid metadata. Fix configuration/data and explicitly retry failed jobs.

## Manual verification and production corrections

Do not close the Jira tasks solely because the code is deployed. Record the asset UUID, reviewer, date and evidence for these checks in Remediations.

| Jira | Manual action / completion evidence |
|---|---|
| AIMPLIFY-5 | Run the complete catalog inventory, recover the identified evaluations and confirm every expected asset has a valid result or an explicitly tracked exception. |
| AIMPLIFY-6 | Compare inventory counts to the production catalog; check NULL score, incomplete feedback, errors, and an evaluated-zero example. Confirm archived/non-published records are included for governance users. |
| AIMPLIFY-7 | On staging, interrupt a running job and restart the app. Verify reclaim after lease expiry, no duplicate processing commits, provider failure classification and a successful retry after recovery. Check Azure/provider credentials and logs. |
| AIMPLIFY-8 | Review before/after scores and the seven agent results; confirm caps are explained. Verify publication status is unchanged and matching source submissions/catalog agree. Resolve input mismatches individually. |
| AIMPLIFY-9 | Publish a representative submission, verify the finalization job, per-asset paths, unchanged content, retained originals and working links. |
| AIMPLIFY-10 | **Identify and have owners/reviewers approve the seven actual draft videos.** Then publish through the existing approval flow and record playback evidence for each. The task CSV does not identify these files. |
| AIMPLIFY-11 | Resolve legacy **STL-003** to its current asset UUID. Confirm the correct source files before approving its storage plan. Verify the resulting links and content. |
| AIMPLIFY-12 | Owner must watch **FRG-002**'s linked video and confirm it belongs to that asset. If incorrect, replace/reassociate it through Edit asset with the owner-approved recording; relocation alone cannot correct semantic association. |
| AIMPLIFY-13 | Resolve **TTN-005**, confirm the PromptEval video, and approve the correct destination filename in the storage plan. Verify the updated link and unchanged recording. |
| AIMPLIFY-14 | Review eligible legacy plans; migrate small batches, inspect job outcomes and compare access before/after. Files on other accounts/containers are intentionally excluded and need separate approved migration. Do not delete original blobs until retention/rollback requirements are met. |
| AIMPLIFY-15 | Test every published video as a normal user, including seek/range playback, desktop/mobile and private/SAS access. Confirm storage network/CORS policies and renewal behavior. Public reachability or a byte hash is insufficient. |
| AIMPLIFY-16 | Owners confirm metadata is factually correct, not merely complete, across the catalog. |
| AIMPLIFY-17 | **Owners provide the correct cloud tags for FRG-010 and ATL-004.** Resolve current UUIDs first; update with approved values and verify cloud filters/dashboard counts. No deployment platform is inferred from titles. |
| AIMPLIFY-18 | Exercise Submit, Edit and direct API validation; verify valid PDF/HTML documents and multi-file references still save. Check corporate repository organization rules against the approved corporate organizations. |
| AIMPLIFY-19 | Check nominated owner name/email, fallback owner profile, manager and contributors on each affected detail page. Confirm the displayed person is the actual nominated owner. |
| AIMPLIFY-20 | Reopen saved assets and compare UI/API/database values; verify family/cloud filters and quality-report findings reflect the corrections. |
| AIMPLIFY-39 | **Obtain the actual corporate repository URLs for the 16 assets.** Save them and test authorized read/clone access. The inventory detects gaps but cannot invent URLs or establish code quality from a URL. |
| AIMPLIFY-52 | Create audit-derived and platform-wide tasks; verify assignment/deadline persistence, assignee-only visibility, evidence submission, independent closure, audit records and CSV export. |

Legacy FAST codes were standardized by previous migrations. Do not assume FRG/STL/TTN codes still identify current rows; resolve the current catalog UUID and owner before making corrections.

Security validation additionally requires the asset owner and security/governance reviewer to confirm authentication, authorization, secret handling, data protection, AI/input safety, logging, dependency scanning and deployment controls against the actual implementation. Attach configuration/test/review evidence without credentials. An owner statement or keyword match is not independently verified compliance.

## Local verification evidence

- **54 backend tests passed.** Regression tests cover the existing flows plus evaluation classification, queue reuse/active leases/reclaim, shared metadata validation, multi-cloud matching, restricted storage plans, independent remediation review, role authorization, catalog scoring and report review linkage.
- Local browser checks use mocked API data and cover desktop/mobile operations, recovery request payloads, confirmation before storage rename, evidence submission, platform-wide tasks and standard-user controls. They do not establish Azure or production database behavior.
- ZIP imports and Alembic graph validation are offline checks. The new migration has generated PostgreSQL SQL but has not been applied to a live database here.
- Staging and production Vite builds passed; both legacy ZIPs and the CI ZIP passed offline import/route/head checks. CI now runs the pytest suite and checks the packaged operations routes.
- Scoped report/operations TypeScript checks (`tsconfig.operations.json`) pass. The full repository TypeScript check still reports pre-existing issues in catalog type mapping, graph profiles, unused declarations and other pages; Vite builds are checked separately. Those unrelated type errors are not represented as resolved by this task.
