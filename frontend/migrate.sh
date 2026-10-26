#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
# ZIP deployments can leave obsolete migration files in place.
rm -f app/db/migrations/versions/032_add_submission_comment_channels.py
python -m alembic upgrade head
