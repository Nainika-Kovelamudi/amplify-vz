import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import BackgroundTasks, HTTPException
from pydantic import ValidationError
from starlette.requests import Request
from app.db.models import AssetStatus, SubmissionStatus
from app.routers.asset_lifecycle import LifecycleChange, change_lifecycle, lifecycle_inventory
from app.services.asset_lifecycle import enforce_request_lifecycle, filter_live_catalog_results
from app.routers.submissions import _to_response


def result(items):
    return MagicMock(scalars=lambda:MagicMock(first=lambda:items[0] if items else None,all=lambda:items))


def asset(status='Published'):
    return SimpleNamespace(id=uuid.uuid4(),title='Guard AI',slug='guard-ai',catalog_code='TTN-010',status=AssetStatus(status),
        owner_id=uuid.uuid4(),family='Sentinel',updated_at=datetime.now(timezone.utc),video_url='https://store.blob.core.windows.net/artifacts/sentinel/drafts/video/guard.mp4',video_urls=[],architecture_file_url=None,demo_url=None)


def user(role='Aimplify.User',uid=None):return SimpleNamespace(id=uid or uuid.uuid4(),role=role)


def source(assigned,status='Published'):
    return SimpleNamespace(id=uuid.uuid4(),assigned_reviewer_id=assigned,status=SubmissionStatus(status))


@pytest.mark.parametrize('status',['Deprecated','Decommissioned'])
@pytest.mark.parametrize('role',['Aimplify.Admin','Aimplify.Owner'])
@pytest.mark.asyncio
async def test_authorized_retirement_syncs_status_audits_and_cancels_jobs(status,role):
    a=asset();actor=user(role);s=source(actor.id)
    db=MagicMock(execute=AsyncMock(side_effect=[result([a]),result([]),MagicMock()]),commit=AsyncMock())
    body=LifecycleChange(status=status,expected_status='Published',reason='Retiring reviewed asset')
    with patch('app.routers.asset_lifecycle.related_sources',AsyncMock(return_value=[s])):
        response=await change_lifecycle(a.id,body,BackgroundTasks(),db,actor)
    assert response['status']==status and a.status.value==status and s.status.value==status
    log=db.add.call_args.args[0]
    assert log.actor_id==actor.id and log.log_metadata['reason']=='Retiring reviewed asset'
    assert log.log_metadata['original_source_statuses']=={str(s.id):'Published'}
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_unassigned_user_cannot_retire_or_restore_and_assignee_cannot_restore():
    for role,assigned,target,old in [('Aimplify.User',False,'Deprecated','Published'),('Aimplify.User',True,'Deprecated','Published'),('Aimplify.User',True,'Published','Deprecated')]:
        actor=user(role);a=asset(old);s=source(actor.id if assigned else uuid.uuid4(),old)
        db=MagicMock(execute=AsyncMock(return_value=result([a])),commit=AsyncMock())
        with patch('app.routers.asset_lifecycle.related_sources',AsyncMock(return_value=[s])):
            with pytest.raises(HTTPException) as error:
                await change_lifecycle(a.id,LifecycleChange(status=target,expected_status=old,reason='Status review'),BackgroundTasks(),db,actor)
        assert error.value.status_code==403
        assert a.status.value==old
        db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_restore_preserves_original_revision_states():
    a=asset('Decommissioned');actor=user('Aimplify.Owner');s1=source(None,'Decommissioned');s2=source(None,'Decommissioned')
    prior=SimpleNamespace(log_metadata={'original_source_statuses':{str(s1.id):'Published',str(s2.id):'Archived'}})
    db=MagicMock(execute=AsyncMock(side_effect=[result([a]),result([prior]),MagicMock()]),commit=AsyncMock())
    with patch('app.routers.asset_lifecycle.related_sources',AsyncMock(return_value=[s1,s2])):
        await change_lifecycle(a.id,LifecycleChange(status='Published',expected_status='Decommissioned',reason='Approved for reuse'),BackgroundTasks(),db,actor)
    assert a.status==AssetStatus.Published
    assert s1.status==SubmissionStatus.Published and s2.status==SubmissionStatus.Archived


def test_reason_and_status_validation():
    for payload in ({'reason':'   '},{'status':'Archived'},{'extra':'injection'}):
        body={'status':'Deprecated','expected_status':'Published','reason':'Being retired'};body.update(payload)
        with pytest.raises(ValidationError):LifecycleChange(**body)


@pytest.mark.asyncio
async def test_inventory_exposes_only_card_preview_and_assignee_cannot_change_lifecycle():
    a=asset('Deprecated');actor=user();s=source(actor.id,'Deprecated')
    db=MagicMock(execute=AsyncMock(return_value=result([a])))
    data=await lifecycle_inventory('Deprecated','',db,actor)
    row=data['items'][0]
    assert set(row)=={'id','title','status','restricted','can_change','can_restore','preview'}
    assert 'description' in row['preview']
    assert not ({'repo_url','video_url','architecture_file_url','owner_email','ai_feedback'} & set(row['preview']))
    assert row['restricted'] and not row['can_change'] and not row['can_restore']


@pytest.mark.asyncio
async def test_standard_user_cannot_list_decommissioned_even_with_explicit_filter():
    db=MagicMock(execute=AsyncMock(return_value=result([])))
    response=await lifecycle_inventory('Decommissioned','',db,user())
    assert response['items']==[]
    query=db.execute.call_args.args[0]
    assert 'Decommissioned' not in str(query.compile().params)


@pytest.mark.asyncio
@pytest.mark.parametrize('path',['/catalog/id/review-history','/catalog/id/feedback','/catalog/id/download'])
async def test_retired_asset_subresources_deny_even_standard_asset_owner(path):
    a=asset('Deprecated');actor=user(uid=a.owner_id)
    request=Request({'type':'http','method':'GET','path':path.replace('/id/',f'/{a.id}/'),'headers':[],'query_string':b''})
    db=MagicMock(execute=AsyncMock(return_value=result([a])))
    with pytest.raises(HTTPException) as error:await enforce_request_lifecycle(request,actor,db)
    assert error.value.status_code==403


@pytest.mark.asyncio
async def test_media_draft_reference_is_protected_for_non_admin():
    a=asset('Decommissioned')
    request=Request({'type':'http','method':'GET','path':'/media/html-download-url','headers':[],
        'query_string':b'blob_path=artifacts%2Fsentinel%2Fdrafts%2Fvideo%2Fguard.mp4'})
    db=MagicMock(execute=AsyncMock(return_value=result([a])))
    with pytest.raises(HTTPException) as error:await enforce_request_lifecycle(request,user(),db)
    assert error.value.status_code==403


@pytest.mark.asyncio
async def test_admin_can_read_retired_details_and_stale_changes_are_rejected():
    a=asset('Deprecated');db=MagicMock(execute=AsyncMock(return_value=result([a])),commit=AsyncMock())
    request=Request({'type':'http','method':'GET','path':f'/catalog/{a.id}/review-history','headers':[],'query_string':b''})
    await enforce_request_lifecycle(request,user('Aimplify.Admin'),db)
    db.execute.assert_not_awaited()
    with patch('app.routers.asset_lifecycle.related_sources',AsyncMock(return_value=[])):
        with pytest.raises(HTTPException) as error:
            await change_lifecycle(a.id,LifecycleChange(status='Decommissioned',expected_status='Published',reason='Replaced by successor'),BackgroundTasks(),db,user('Aimplify.Owner'))
    assert error.value.status_code==409
    db.commit.assert_not_awaited()


def test_submission_serializer_excludes_private_details():
    s=SimpleNamespace(id=uuid.uuid4(),title='Retired asset',status=SubmissionStatus.Deprecated)
    response=_to_response(s)
    assert response.restricted and response.description=='' and response.owner_email is None
    assert response.ai_feedback is None and response.repo_url is None


@pytest.mark.asyncio
async def test_direct_catalog_url_returns_only_label_even_for_standard_asset_owner():
    import json
    from app.routers.catalog import get_asset
    a=asset('Deprecated')
    db=MagicMock(execute=AsyncMock(return_value=MagicMock(first=lambda:(a,'Hidden owner','hidden@example.com'))))
    response=await get_asset(str(a.id),db,user(uid=a.owner_id))
    assert json.loads(response.body)=={'id':str(a.id),'title':'Guard AI','status':'Deprecated','restricted':True}
    assert db.execute.await_count==1


@pytest.mark.asyncio
async def test_stale_knowledge_record_filtered_using_live_publication_status():
    active=SimpleNamespace(id=uuid.uuid4(),slug='active');retired=uuid.uuid4()
    db=MagicMock(execute=AsyncMock(return_value=MagicMock(all=lambda:[active])))
    context=MagicMock(__aenter__=AsyncMock(return_value=db),__aexit__=AsyncMock(return_value=False))
    records=[{'source_type':'catalog_asset','source_id':str(active.id),'text':'public'},
             {'source_type':'catalog_asset','source_id':str(retired),'text':'private'},
             {'source_type':'page','text':'workflow'}]
    with patch('app.db.base.get_session_factory',return_value=lambda:context):
        filtered=await filter_live_catalog_results(records)
    assert filtered==[records[0],records[2]]
