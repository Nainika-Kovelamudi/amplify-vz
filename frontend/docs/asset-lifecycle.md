# Deprecated and decommissioned assets

Admins/platform Owners have Active, Deprecated, Decommissioned and All filters in Catalog and Pipeline → Asset Lifecycle.
Active means published and available for use. The default catalog displays Active assets plus Deprecated entries
using the same card layout. Normal users see the description and card metadata for Deprecated assets, but cannot
open their details. They have no lifecycle dropdown and cannot list Decommissioned assets. Retired assets remain excluded
from demo requests, repository requests and knowledge answers.

Only Admins and platform Owners may retire a published asset.
A reason is mandatory. Only Admins/platform Owners may restore it to Active. Lifecycle changes are audited.
Linked submission statuses are retained in the audit and restored to their original states on reactivation.
Queued/running jobs for the asset are invalidated so stale jobs cannot restore an earlier lifecycle state.

Admins/platform Owners can read full retired asset details. Other users, including a standard asset owner,
see only the explicitly allowed card preview for Deprecated assets. Files, repository links, review data and
other full-detail content remain protected. An assigned reviewer without an Admin/platform Owner role cannot change lifecycle status.
Submission, review, comment and authenticated media routes enforce this restriction on the server.

Apply migration 038 once before deploying the matching backend (predecessor 037).
Alternatively use scripts/038_asset_lifecycle.sql only if the database is fully at 037; do not apply both.
Deploy both frontend and backend. No new secret or environment variable is required.

Azure Blob URLs already shared outside the application are bearer capabilities: changing a database
status cannot revoke an existing SAS URL, public blob or previously downloaded file. The application blocks
new access through its APIs; storage-level revocation/private serving is needed to invalidate prior direct links.
No original artifact is deleted by lifecycle changes.
