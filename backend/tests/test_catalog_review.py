import uuid
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock,MagicMock
import pytest
from fastapi import HTTPException
from app.routers.catalog_review import catalog_review_history


def result(items):
    return MagicMock(scalars=lambda:MagicMock(first=lambda:items[0] if items else None,all=lambda:items))


@pytest.mark.asyncio
async def test_review_uses_approval_event_for_actual_published_revision():
    aid,sid,reviewer,publisher,other=[uuid.uuid4() for _ in range(5)]
    now=datetime.now(timezone.utc)
    asset=SimpleNamespace(id=aid,catalog_code='FRG-001',status='Published',owner_id=other)
    source=SimpleNamespace(id=sid,status='Published',reviewed_by=other,reviewed_at=now+timedelta(days=1))
    publication=SimpleNamespace(entity_id=sid,action='submission_published',actor_id=publisher,created_at=now)
    approval=SimpleNamespace(actor_id=reviewer,created_at=now-timedelta(days=1))
    profiles=[SimpleNamespace(id=reviewer,display_name='L1 Reviewer',email='l1@example.com'),SimpleNamespace(id=publisher,display_name='L2 Publisher',email='l2@example.com')]
    db=MagicMock(execute=AsyncMock(side_effect=[result([asset]),result([source]),result([publication]),result([approval]),result(profiles)]))
    response=await catalog_review_history(aid,db,SimpleNamespace(id=other,role='Aimplify.User'))
    assert response['l1']=={'name':'L1 Reviewer','at':approval.created_at}
    assert response['l2']=={'name':'L2 Publisher','at':now}
    assert 'notes' not in str(response)


@pytest.mark.asyncio
async def test_migrated_asset_without_review_history_does_not_invent_reviewers():
    aid=uuid.uuid4();asset=SimpleNamespace(id=aid,catalog_code='TTN-001',status='Published',owner_id=uuid.uuid4())
    db=MagicMock(execute=AsyncMock(side_effect=[result([asset]),result([]),result([])]))
    response=await catalog_review_history(aid,db,SimpleNamespace(id=uuid.uuid4(),role='Aimplify.User'))
    assert response['l1']=={'name':None,'at':None}
    assert response['l2']=={'name':None,'at':None}


@pytest.mark.asyncio
async def test_non_owner_cannot_read_archived_asset_review():
    aid=uuid.uuid4();asset=SimpleNamespace(id=aid,status='Archived',owner_id=uuid.uuid4())
    db=MagicMock(execute=AsyncMock(return_value=result([asset])))
    with pytest.raises(HTTPException) as error:
        await catalog_review_history(aid,db,SimpleNamespace(id=uuid.uuid4(),role='Aimplify.User'))
    assert error.value.status_code==404
    assert db.execute.await_count==1


@pytest.mark.asyncio
async def test_publication_audit_links_legacy_submission_without_catalog_code():
    aid,sid,uid=[uuid.uuid4() for _ in range(3)];now=datetime.now(timezone.utc)
    asset=SimpleNamespace(id=aid,catalog_code='FRG-001',status='Published',owner_id=uid)
    source=SimpleNamespace(id=sid,status='Published',reviewed_by=uid,reviewed_at=now-timedelta(days=1))
    publication=SimpleNamespace(entity_id=sid,action='submission_published',actor_id=uid,created_at=now)
    profile=SimpleNamespace(id=uid,display_name='Reviewer',email='reviewer@example.com')
    db=MagicMock(execute=AsyncMock(side_effect=[result([asset]),result([]),result([publication]),result([source]),result([]),result([profile])]))
    response=await catalog_review_history(aid,db,SimpleNamespace(id=uid,role='Aimplify.Owner'))
    assert response['l1']['name']=='Reviewer'
    assert response['l2']['at']==now
