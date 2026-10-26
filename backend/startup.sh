#!/bin/bash
set -euo pipefail

# Oryx may unpack the built application into /tmp at runtime. Resolve imports
# from this script's directory instead of stale loose files in wwwroot.
cd "$(dirname "$0")"
echo "Booting AImplify backend..."
# Dependencies must be installed during ZIP deployment by Oryx
# (SCM_DO_BUILD_DURING_DEPLOYMENT=true). Installing them here delays every
# container restart beyond App Service's startup-probe deadline.
if ! python -c 'import alembic, fastapi, uvicorn, azure.storage.blob'; then
  echo "Python dependencies are missing from this deployment. Confirm remote build ran and installed requirements.txt, then redeploy the ZIP." >&2
  exit 1
fi
# Migrations run once as a deployment step (migrate.sh), not in each worker.
echo "Starting uvicorn..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
