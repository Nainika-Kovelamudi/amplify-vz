# Compliance, collateral and metadata quality report

## Access and output

Platform Owner → **Observability → Asset quality report** (`/admin/observability`).
All catalog assets are included, regardless of lifecycle status, missing owner,
missing collateral or absent AI evaluation. Search affects only the UI display;
Excel export always includes all assets. This is now the single report entry in
Observability; the separate Security evidence report button has been removed.
Its legacy backend endpoint remains for compatibility with earlier clients.

The workbook contains:

1. **All Assets**: identification, owner, three separate 0–100 indices, missing
   items, links not verified reachable, asset path, update time and report time.
2. **Detailed Findings**: each criterion, awarded credit, status, evidence and owner action.
3. **Security Evidence**: all ten controls per asset, source fields/file names,
   supporting excerpts, recommended actions, document coverage and historical AI notes.
4. **Collateral Checks**: every named/miscellaneous attachment, video and demo
   link, redacted URL, accessibility, content/readability, relevance and check time.
5. **Owner Actions**: owner-level asset, missing-item and unverified-link totals.
6. **Methodology**: exact rubric and verification limitations.

UI tabs: **Security**, **Compliance readiness**, **Metadata**, **Collateral** and
**Link checks**. Security is displayed separately but still contributes to the
compliance readiness index. Its source-coverage panel shows how many uploaded
documents were read and each unread document's reason/status. Missing evidence
is scoped to the material successfully reviewed, not an assertion about unread files.

CSV is also available through the API and contains detailed findings. Excel is
the complete multi-sheet report. Downloads regenerate from current data; they can
differ from an earlier UI snapshot and have their own generation timestamp.

## What the indices mean

Indices are evidence/readiness indicators, not security certifications or factual
guarantees. There is deliberately no single combined score.

- **Metadata**: owner/manager details, title, family, department, tech stack,
  maturity, environment, dependencies, setup, description depth and text leads
  for use cases, intended users and benefits. Present valid fields earn 1;
  partial fields/text leads earn 0.5; missing/invalid earn 0. Word count and
  keyword matching are proxies that require human review.
- **Compliance readiness**: ten security areas plus licensing/IP, regulatory
  applicability, accountable ownership and review traceability. Unverified
  text mentions earn 0.5; missing evidence earns 0; owner/detailed review record
  presence earns 1. Statements of planned/absent controls remain unverified.
  Review records are matched by exact catalog code, never title similarity.
- **Collateral**: six equally weighted expected categories: architecture,
  sales pitch, marketing, technical guide, demo video and demo link. Each earns
  20% for a reference, reachability, readable/expected content, title-relevance
  signal and substantive content signal. Best single artifact per category is
  used. Miscellaneous files are listed without inflating category scores.
  Unsupported content or unrequested checks receive no verification credit;
  low scores can therefore mean unverified evidence rather than bad content.
  Video playback, interactive demo functionality and image/OCR quality are
  not verified; video categories cannot receive text-review credits automatically.

Absence of a category is a gap in this standard reporting rubric, not necessarily
a mandatory platform submission rule. Owners can explain applicability during review.

## Optional verification configuration

Default generation reads stored information and records links as **Not verified**.
Select **Include document evidence and approved link checks**, then **Apply & assess**.

Configure Azure backend setting `QUALITY_REPORT_ALLOWED_HOSTS` as comma-separated
exact public host names, for example:

```
aimplifyplatform.blob.core.windows.net,demo.example.com
```

Use only domains trusted by the platform owner; do not configure wildcard hosts.
The configured `FRONTEND_URL` host and `<BLOB_ACCOUNT_NAME>.blob.core.windows.net`
are included automatically when available. Private/reserved addresses, non-HTTP
URLs, embedded credentials and nonstandard ports are blocked. Redirects are not
followed. No cookies, browser sessions, Azure connection strings or authorization
headers are forwarded to these checks. Signed URL query strings can be used for
checks but are stripped from exports and UI URLs.

401/403 is **Authentication required**, not a broken link. 404/410 is reported as
a broken reference. Other errors/timeouts/redirects stay unverified. Text extraction
supports PDF, DOCX, PPTX, XLSX shared strings, HTML and plain text. HTML scripts
are never executed. Legacy Office, images/OCR, encrypted/corrupt documents and
files larger than 5 MB require manual review. Only a limited document portion is
inspected. Reachability is not functional demo validation. Supported extracted
document text contributes to compliance findings when verification is enabled.

Checks are limited to four concurrent tasks and a 45-second overall budget.
Any unfinished checks remain **Not verified**, and every asset still appears.
Report generation never changes asset content, existing AI scores or approvals.
The owner should use the existing authorized asset edit flow, then regenerate.

## Deployment and API

Deploy both backend and frontend. There are no new tables or migrations for this
feature; existing schema migrations still must be current. Updated config fields,
services and router registration are included in both ZIP packaging paths.

Owner-only API: `GET /admin/asset-quality-report?format=json|xlsx|csv&verify=false|true`.
Production data was not accessed or independently audited during implementation.
