# AImplify review and deployment

## Flow

Feature branch → pull request → Frontend checks + Backend checks → reviewer approval
→ merge into `aimplify-dev` → development deployment.

Production is a separate, manual Actions → Deploy AImplify run. Select the approved
production branch and the `production` environment. Production branch selection is
not assumed: configure its `DEPLOY_BRANCH` before running the workflow.

The workflows are implemented in this checkout. Repository rules, environment
reviewers, Azure identity permissions and secrets must be configured by an admin;
workflow YAML alone does not enable those account settings.

## 1. Configure GitHub review rules

In Settings → Rules → Rulesets (or Branch protection), protect `aimplify-dev`
and your production branch:

- Require a pull request with at least one approval; dismiss stale approvals.
- Require conversation resolution and an approval of the latest push.
- Require status checks `Frontend checks` and `Backend checks`. Run a PR once
  so GitHub can discover these names.
- Block force pushes and deletion. Restrict bypass privileges.

Add the real reviewer team using GitHub review requests or CODEOWNERS once its
GitHub team handle is known. Do not use placeholder accounts as required reviewers.

## 2. Configure environments

Create Settings → Environments → `development` and `production`.
Restrict each to its deployment branch. Require deployment approval for production
and prevent self-approval where your GitHub plan supports these controls.
If environment approvals are unavailable for this private repository's plan,
use protected production-branch PR approvals and restrict Actions write access;
manual dispatch alone is not an approval gate.

Add these environment **variables**, with different values per environment:

| Variable | Value |
| --- | --- |
| `DEPLOY_BRANCH` | `aimplify-dev` for development; confirmed release branch for production |
| `AZURE_RESOURCE_GROUP` | `rg-dt-cloud-ai-dev` (confirm for production) |
| `AZURE_BACKEND_APP` | `aimplify-backend` / `aimplify-backend-prod` |
| `VITE_API_URL` | Corresponding backend HTTPS origin, without a trailing path |
| `VITE_AZURE_TENANT_ID` | Frontend Microsoft Entra tenant ID |
| `VITE_AZURE_CLIENT_ID` | Frontend Microsoft Entra application ID |
| `AZURE_CLIENT_ID` | Deployment identity application ID; separate from frontend SSO |
| `AZURE_TENANT_ID` | Deployment identity tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `FRONTEND_HOST` | `static-web-app` or `app-service` |
| `AZURE_FRONTEND_APP` | Frontend App Service name, only for `app-service` |

Add environment **secrets**:

- `DATABASE_URL`: corresponding PostgreSQL `postgresql+asyncpg://...` DSN.
- `AZURE_STATIC_WEB_APPS_API_TOKEN`: only for Static Web Apps hosting.

Keep application runtime secrets in Azure App Service configuration. Do not put
API keys, JWT secrets or database credentials in Vite variables; Vite values are public.

## 3. Configure Azure federation

Create an Entra application/deployment identity with least-privilege access to the
target App Services. Configure GitHub OIDC federated credentials with audience
`api://AzureADTokenExchange` and subjects:

```
repo:infovision-ai/amplify:environment:development
repo:infovision-ai/amplify:environment:production
```

If workflows are hosted in another repository, use its exact owner/name instead.
No Azure publish profile or long-lived deployment password is needed for App Service.
The frontend App Service option assumes it already serves static SPA content with
an index.html fallback. Static Web Apps uses the existing staticwebapp.config.json.

## 4. Database and release behavior

The deployment validates the selected branch, builds the frontend with environment
variables, downloads the exact checked backend artifact, runs Alembic **once**,
deploys the backend with Oryx dependency installation, checks health and API routes,
then deploys the frontend. Failures stop subsequent steps. PR jobs cannot deploy
and do not receive deployment secrets.

GitHub runners must be able to reach PostgreSQL. For a private database, use an
approved runner with network access and change the deployment job's `runs-on`.
Do not open the database to all Internet clients. Back up before the initial rollout.
Existing databases must have an accurate Alembic revision; do not stamp a revision
just to bypass a failed migration. Existing schema drift requires a one-time repair.

The CI packager uses `app/` in this repository, not a sibling backend checkout or
old base ZIP. It includes migrations 027–031 recovered from the active backend.
The historical standalone `a1b2c3d4e5f6` migration is excluded from this artifact:
its fields are already covered in the numbered chain and it is an independent head.
If a database is stamped with that standalone revision, reconcile it before rollout.

Commit all required application files, migrations, tests and workflow helpers
together. Files currently untracked locally do not appear on GitHub until committed.
Review the first source-only deployment in development before production because
it replaces the previous ZIP-overlay packaging strategy.

Deployments are serialized per environment. A failed release does not automatically
reverse database migrations or redeploy an earlier frontend. Prefer backward-compatible
schema migrations and forward fixes; an application rollback must remain compatible
with the migrated schema. The health probe verifies health/routes, not every user flow.

## References

- https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions
- https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
