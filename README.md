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
