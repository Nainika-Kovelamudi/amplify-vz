#!/bin/bash
set -euo pipefail

cd /home/site/wwwroot
pip install -r requirements.txt --quiet
echo "Running alembic migrations..."
echo "Current database revision:"
python -m alembic current
python -m alembic upgrade head
echo "Database revision after upgrade:"
python -m alembic current
echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
