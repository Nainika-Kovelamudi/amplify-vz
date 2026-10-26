"""Offline ZIP validation: import the shipped application, routes and migration graph.

Usage: python scripts/verify_backend_package.py backend.zip backend_prod.zip
No database, Azure storage or AI provider is contacted.
"""
import ast
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

REQUIRED = {
    'app/routers/catalog_review.py',
    'app/routers/metadata_operations.py',
    "app/services/family_assignment.py",
    'app/services/executive_report_data.py',
    'app/routers/platform_operations.py', 'app/services/evaluation_jobs.py',
    'app/services/artifact_migration.py', 'app/db/operations_models.py',
    'app/schemas/metadata_rules.py',
    'app/db/migrations/versions/036_evaluation_jobs_and_remediations.py',
    'app/db/migrations/versions/037_feedback_asset_target.py',
}
CHECK = r'''
from app.main import app
from app.db.base import Base
from app.schemas.submission import SubmissionUpdate
from alembic.script import ScriptDirectory
from alembic.config import Config
paths = {(r.path,m) for r in app.routes for m in (getattr(r,'methods',None) or [])}
for path,method in [('/admin/platform-operations/inventory','GET'),
                    ('/catalog/{asset_id}/review-history','GET'),
                    ('/admin/platform-operations/metadata','GET'),
                    ('/admin/platform-operations/assets/{asset_id}/metadata','PATCH'),
                    ('/admin/platform-operations/evaluations','POST'),
                    ('/admin/platform-operations/remediations','GET'),
                    ('/admin/platform-operations/remediations/{item_id}','PATCH'),
                    ('/admin/platform-operations/assets/{asset_id}/finalize-storage','POST'),
                    ('/admin/asset-quality-report','GET'),
                    ('/catalog/{asset_id}/family','PATCH'),
                    ('/admin/platform-operations/assets/{asset_id}/rerun-evaluation','POST'),
                    ('/submissions/{submission_id}/family','PATCH')]:
    assert (path,method) in paths, (path,method)
from app.db.models import Base as ModelBase, UserProfile, CatalogAsset
from app.db.operations_models import EvaluationJob, RemediationItem
import inspect
from app.routers.admin import get_executive_report
assert 'build_executive_report' in inspect.getsource(get_executive_report)
assert 'refresh' in inspect.signature(get_executive_report).parameters
assert Base is ModelBase
assert {'evaluation_jobs','asset_remediations','user_profiles','catalog_assets','platform_feedback'} <= set(Base.metadata.tables)
assert {'asset_id','asset_title'} <= set(Base.metadata.tables['platform_feedback'].columns.keys())
for table in Base.metadata.tables.values():
    for foreign_key in table.foreign_keys:
        assert foreign_key.column.table.metadata is Base.metadata
for model in (EvaluationJob,RemediationItem):
    assert model.__mapper__._sorted_tables  # Exercises FK resolution used during ORM flush.

assert SubmissionUpdate(family='sEnTiNeL').family == 'Sentinel'
assert SubmissionUpdate(cloud_provider='azure, AWS').cloud_provider == 'Azure, AWS'
assert ScriptDirectory.from_config(Config('alembic.ini')).get_heads() == ['037']
print('Imported shipped application; operations/report routes, models, metadata and head 037 verified.')
'''


def verify(path):
    with zipfile.ZipFile(path) as archive:
        names=set(archive.namelist())
        assert REQUIRED <= names, f'Missing files: {REQUIRED-names}'
        assert not any(Path(n).name.startswith('.env') for n in names), 'Environment file in ZIP'
        for name in names:
            if name.endswith('.py'): ast.parse(archive.read(name),filename=name)
        with tempfile.TemporaryDirectory(prefix='aimplify-package-') as folder:
            for name in names:
                target=(Path(folder)/name).resolve()
                assert target.is_relative_to(Path(folder).resolve()), 'Unsafe ZIP path'
            archive.extractall(folder)
            env=os.environ.copy()
            env.update(DATABASE_URL='postgresql+asyncpg://offline:offline@localhost/offline',
                       JWT_SECRET='offline-package-check-only',AZURE_TENANT_ID='offline',AZURE_CLIENT_ID='offline',
                       CHATBOT_ENABLED='false',EVALUATION_WORKER_ENABLED='false',PYTHONPATH=folder,PYTHONUTF8='1')
            completed=subprocess.run([sys.executable,'-c',CHECK],cwd=folder,env=env,capture_output=True,text=True,timeout=60)
            if completed.returncode: raise RuntimeError(completed.stderr)
            print(f'{path}: {completed.stdout.strip()}')


if __name__=='__main__':
    for path in sys.argv[1:] or ['backend.zip','backend_prod.zip']: verify(path)
