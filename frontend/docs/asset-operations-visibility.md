# Asset Operations tab visibility

The Pipeline Asset Operations / My Remediations tab is hidden by default.
Its content is not mounted and `/pipeline?tab=operations` falls back to My Work while hidden.

Set the frontend build environment variable:

```dotenv
VITE_ASSET_OPERATIONS_ENABLED=false
```

Set it to `true` to show the tab again. An unset value also hides it.
Rebuild and deploy the frontend after changing this variable. Vite embeds this
setting during the build; changing Azure backend application settings alone
does not change an already-built frontend.

This setting controls tab visibility only. It does not disable evaluation
workers, existing jobs, backend authorization, or the Owner-only per-asset
Re-run AI evaluation button.
