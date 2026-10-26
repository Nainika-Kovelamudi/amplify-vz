# Security evidence report

**Superseded UI:** use **Observability → Asset quality report → Security**.
The separate launcher has been removed. The unified report also supports uploaded
document evidence with optional verification and includes a Security Evidence Excel
sheet. The legacy endpoint described below remains for compatibility only.

Platform Owners can open **Observability → Security evidence report**. The report
includes every catalog record, including archived/draft records, without a page limit.
Search by asset, owner, email or family, select an asset, and inspect its ten findings.
**Download CSV (all assets)** exports one row per asset/control, suitable for Excel.
The search selection does not restrict the export. An empty catalog exports headers.

The inventory checks authentication, authorization, secrets management, input/AI
safety, data protection, privacy/data handling, audit logging, vulnerability management,
deployment hardening, and security verification. It reports exact source excerpts,
owner details, timestamps, catalog paths, the previous AI verdict if present, and
specific owner actions. It does not compute a security/compliance score.

Scope: stored descriptions, dependencies and setup commands only. Attachments,
repository code, live links and running systems are not inspected. Pattern matches
are candidate evidence that a human must verify; negated or planned statements
remain unverified. No match means **not documented in reviewed fields**, not
**control absent**. Documentation in attachments may still exist. Owners must review
those documents before deciding what is missing. Existing AI results are separate,
historical assessments, not independent verification by this report.

Owners should open the asset using its review link and use the existing authorized
asset update flow to add accurate security details or supporting documents. Refresh
the report after saving changes. Nothing is auto-written to descriptions, and no
scores or approval decisions are changed. User permissions to edit assets are not
expanded by this report. No email is sent by generating/downloading it.

Deploy the matching frontend and backend packages. This feature has no new database
tables or migration. Previously required platform migrations still need to be current.
Endpoint: `GET /admin/security-report` (JSON); `?format=csv` for export. Both require
the platform Owner role. A live production report can only be generated after the
feature is deployed and an authorized user requests it.
