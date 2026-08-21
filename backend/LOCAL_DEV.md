# Local Development Guide

## Prerequisites
- Python 3.11+
- PostgreSQL running locally (default port 5432)
- A Groq API key — free at https://console.groq.com

---

## 1. Database setup

```bash
psql -h 192.168.74.12 -U postgres -c "CREATE DATABASE amplify;"
psql -h 192.168.74.12 -U postgres -d amplify -f schema.sql
```

Then run Alembic migrations (required — renames enum values and creates tables added after schema.sql):

```bash
cd amplify-backend
alembic upgrade head
```

> **If you skip migrations**, the `user_role_enum` PostgreSQL type keeps old values
> (`'guest'`, `'admin'`, `'super_admin'`). The Python code expects
> `'Aimplify.User'`, `'Aimplify.Admin'`, `'Amplify.Owner'`.
> The mismatch causes `/auth/me` to return the old string, so the Admin tab never shows
> and the Like button returns 401.
>
> **Already ran `schema.sql` without migrations?** Fix the enum in-place:
> ```sql
> ALTER TYPE user_role_enum RENAME VALUE 'guest'       TO 'Aimplify.User';
> ALTER TYPE user_role_enum RENAME VALUE 'admin'       TO 'Aimplify.Admin';
> ALTER TYPE user_role_enum RENAME VALUE 'super_admin' TO 'Amplify.Owner';
> ```
> This automatically updates all existing rows — no separate `UPDATE` needed.

---

## 2. Environment

```bash
cp .env.local .env
```

Edit `.env` and set your real Groq key:
```
GROQ_API_KEY=<your-groq-api-key>
```

---

## 3. Install dependencies

```bash
pip install -e ".[dev]"
```

---

## 4. Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

Swagger UI is available at: http://localhost:8000/docs  
(only when `DEBUG=true`)

---

## 5. Dev login (bypasses Azure AD)

```bash
curl -s -X POST http://localhost:8000/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@amplify.local"}' | python -m json.tool
```

Copy the `access_token` and use it as `Authorization: Bearer <token>` on all other requests.

To log in as a different user, insert a row in `user_profiles` first:
```sql
INSERT INTO user_profiles (azure_oid, email, display_name, role, department)
VALUES ('local-user-002', 'user@amplify.local', 'Test User', 'guest', 'Delivery');
```

---

## 6. Groq scoring

The 5-agent pipeline (relevance, tech_quality, description, demo_readiness, duplicate_check)
now calls Groq instead of Gemini. Each agent makes one chat completion call.

Default model: `llama-3.1-70b-versatile`  
Change via `GROQ_MODEL` in `.env`. Other options:
- `llama-3.1-8b-instant` — faster and cheaper, slightly lower quality
- `mixtral-8x7b-32768` — larger context window

---

## 7. Switching back to production (Azure)

Set in `.env`:
```
DEV_AUTH_BYPASS=false
DEBUG=false
AZURE_TENANT_ID=<real-tenant-id>
AZURE_CLIENT_ID=<real-client-id>
AZURE_KEYVAULT_URL=https://<vault-name>.vault.azure.net/
```

Key Vault will overlay `GROQ_API_KEY`, `DATABASE_URL`, etc. at startup.
