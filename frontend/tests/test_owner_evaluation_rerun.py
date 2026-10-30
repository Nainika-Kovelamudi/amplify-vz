import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from app.db.base import get_db
from app.deps.rbac import get_current_user
from app.routers.platform_operations import router, rerun_asset_evaluation


@pytest.mark.parametrize('role', ['Aimplify.User', 'Aimplify.Admin'])
def test_non_owner_cannot_use_asset_rerun(role):
    app=FastAPI(); app.include_router(router)
    app.dependency_overrides[get_current_user]=lambda: SimpleNamespace(id=uuid.uuid4(),role=role)
    app.dependency_overrides[get_db]=lambda: MagicMock()
    with TestClient(app) as client:
        response=client.post(f'/admin/platform-operations/assets/{uuid.uuid4()}/rerun-evaluation')
    assert response.status_code==403


@pytest.mark.asyncio
async def test_owner_forces_refresh_and_audits_without_mutating_asset():
    asset=SimpleNamespace(id=uuid.uuid4(),status='Published',ai_score=0)
    actor=SimpleNamespace(id=uuid.uuid4(),role='Aimplify.Owner')
    job=SimpleNamespace(id=uuid.uuid4(),entity_id=asset.id,entity_type='catalog_asset',state='Queued',attempts=0,error=None,updated_at=None)
    db=MagicMock(execute=AsyncMock(return_value=MagicMock(scalars=lambda:MagicMock(first=lambda:asset))),commit=AsyncMock())
    with patch('app.config.get_settings',return_value=SimpleNamespace(evaluation_worker_enabled=True)), patch('app.routers.platform_operations.enqueue_evaluation',AsyncMock(return_value=job)) as queue:
        response=await rerun_asset_evaluation(asset.id,db,actor)
    queue.assert_awaited_once_with(db,asset.id,'catalog_asset',actor.id,force=True)
    assert (asset.status,asset.ai_score)==('Published',0)
    assert response['job']['state']=='Queued'
    assert db.add.call_args.args[0].action=='asset_evaluation_rerun_requested'
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_disabled_worker_does_not_queue():
    db=MagicMock()
    with patch('app.config.get_settings',return_value=SimpleNamespace(evaluation_worker_enabled=False)):
        with pytest.raises(HTTPException) as error:
            await rerun_asset_evaluation(uuid.uuid4(),db,SimpleNamespace(id=uuid.uuid4()))
    assert error.value.status_code==409
    db.execute.assert_not_called()
