#!/bin/bash
cd /home/site/wwwroot
pip install -r requirements.txt --quiet
echo "Running alembic migrations..."
alembic upgrade head || echo "WARNING: alembic migration failed — backend will still start"
echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
