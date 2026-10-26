# Aimplify Platform

Monorepo for the Aimplify asset catalog, approval pipeline, AI scoring, reporting, and media workflows.

## Structure

- `frontend/` — React, TypeScript, and Vite application.
- `backend/` — FastAPI, SQLAlchemy, Alembic, and Azure integrations.

## Local development

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
python -m venv .venv
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Copy each `.env.example` to a local `.env` and provide environment-specific values. Never commit environment files or credentials.

## Deployment

- Frontend: Azure Static Web Apps.
- Backend: Azure App Service.
- Database: Azure Database for PostgreSQL with Alembic migrations.
- Media: Azure Blob Storage.

All secrets, model names, API endpoints, and connection strings are configured through Azure application settings or Key Vault.

## Updated governance workflows

- Pipeline asset operations: evaluation recovery, verified artifact finalization, and metadata standardization.
- Catalog asset details: Owner & Review with L1 approver and L2 publisher history.
- Per-asset AI evaluation rerun for the AImplify Owner role.
- Set VITE_ASSET_OPERATIONS_ENABLED=true in the frontend build environment to show Asset Operations; unset defaults to hidden.
- Backend processing requires migration 036 or later and EVALUATION_WORKER_ENABLED=true.

Build a backend package from source with: cd backend, then python scripts/build_ci_backend.py.
Verify it with python scripts/verify_backend_package.py ci_artifacts/backend.zip.
See docs/ for migration and rollout details. Environment files and build artifacts are excluded from Git.

