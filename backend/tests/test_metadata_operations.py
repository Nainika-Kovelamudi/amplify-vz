import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.db.base import get_db
from app.deps.rbac import get_current_user
from app.routers.metadata_operations import (FIELDS, MetadataReview, MetadataCorrection, fingerprint,
    metadata_row, save_metadata_review, router)


def asset(**changes):
    values=dict.fromkeys(FIELDS,None)
    values.update(id=uuid.uuid4(),title='Legacy',family='Titan',slug='legacy',catalog_code='TTN-001',
                  status='Published',owner_id=uuid.uuid4(),cloud_provider='AZURE, Azure, GCP',ai_score=72)
    values.update(changes)
    return SimpleNamespace(**values)


def db_for(*values):
    return MagicMock(execute=AsyncMock(side_effect=[MagicMock(scalars=lambda v=v: MagicMock(first=lambda:v)) for v in values]),commit=AsyncMock())


def test_suggestions_and_linked_owner_do_not_guess_unknown_values():
    a=asset()
    profile=SimpleNamespace(id=a.owner_id,display_name='Owner',email='owner@infovision.com')
    result=metadata_row(a,profile)
    assert result['suggested_cloud']=='Azure, GCP'
    assert result['linked_owner']['name']=='Owner'
    assert 'owner_name' in result['missing_fields']
    a.cloud_provider='cloud-Agnostic, On-prem'
    assert metadata_row(a)['suggested_cloud'] is None
    assert metadata_row(a)['cloud_error']


def test_restrict_changes_and_validate_clouds():
    assert MetadataCorrection(cloud_provider='AZURE, Azure, GCP').cloud_provider=='Azure, GCP'
    for payload in ({'status':'Published'},{'owner_email':'override@example.com'},{'cloud_provider':'unknown-cloud'},
                    {'manager_email':'manager@gmail.com'},{'family':'Relay'}):
        with pytest.raises(ValidationError): MetadataCorrection(**payload)


@pytest.mark.asyncio
async def test_partial_cloud_fix_preserves_owner_status_and_score_with_audit():
    a=asset(); original_owner=a.owner_id
    body=MetadataReview(fingerprint=fingerprint(a),confirmed=True,changes={'cloud_provider':'AZURE, Azure, GCP'})
    db=db_for(a)
    result=await save_metadata_review(a.id,body,BackgroundTasks(),db,SimpleNamespace(id=uuid.uuid4()))
    assert a.cloud_provider=='Azure, GCP'
    assert (a.owner_id,a.status,a.ai_score)==(original_owner,'Published',72)
    assert result['changed_fields']==['cloud_provider']
    log=db.add.call_args.args[0]
    assert log.log_metadata['changes']['cloud_provider']=={'before':'AZURE, Azure, GCP','after':'Azure, GCP'}
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_owner_selection_resolves_name_email_and_keeps_history():
    a=asset(); new_id=uuid.uuid4()
    profile=SimpleNamespace(id=new_id,display_name='New Owner',email='New.Owner@infovision.com')
    body=MetadataReview(fingerprint=fingerprint(a),confirmed=True,changes={'owner_id':new_id})
    db=db_for(a,profile)
    await save_metadata_review(a.id,body,BackgroundTasks(),db,SimpleNamespace(id=uuid.uuid4()))
    assert (a.owner_id,a.owner_name,a.owner_email)==(new_id,'New Owner','new.owner@infovision.com')
    assert db.execute.await_count==2  # no submission-author rewriting


@pytest.mark.asyncio
async def test_conflict_and_confirmation_rejected_before_writes():
    a=asset()
    for confirmed,fp,code in ((False,fingerprint(a),422),(True,'0'*64,409)):
        db=db_for(a)
        with pytest.raises(HTTPException) as error:
            await save_metadata_review(a.id,MetadataReview(fingerprint=fp,confirmed=confirmed,changes={}),BackgroundTasks(),db,SimpleNamespace(id=uuid.uuid4()))
        assert error.value.status_code==code
        db.commit.assert_not_awaited();db.add.assert_not_called()


@pytest.mark.asyncio
async def test_owner_cannot_equal_saved_manager():
    a=asset(manager_name='Manager',manager_email='manager@infovision.com')
    profile=SimpleNamespace(id=uuid.uuid4(),display_name='Manager',email='manager@infovision.com')
    db=db_for(a,profile)
    with pytest.raises(HTTPException) as error:
        await save_metadata_review(a.id,MetadataReview(fingerprint=fingerprint(a),confirmed=True,changes={'owner_id':profile.id}),BackgroundTasks(),db,SimpleNamespace(id=uuid.uuid4()))
    assert error.value.status_code==422
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_review_without_changes_records_evidence_not_completion():
    a=asset();db=db_for(a)
    result=await save_metadata_review(a.id,MetadataReview(fingerprint=fingerprint(a),confirmed=True,changes={}),BackgroundTasks(),db,SimpleNamespace(id=uuid.uuid4()))
    assert result['changed_fields']==[]
    assert db.add.call_args.args[0].log_metadata['result_fingerprint']==fingerprint(a)
    assert metadata_row(a)['missing_fields']


def test_standard_user_denied_inventory_and_save():
    app=FastAPI();app.include_router(router)
    app.dependency_overrides[get_db]=lambda:MagicMock()
    app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id=uuid.uuid4(),role='Aimplify.User')
    with TestClient(app) as client:
        assert client.get('/metadata').status_code==403
        assert client.patch(f'/assets/{uuid.uuid4()}/metadata',json={'fingerprint':'0'*64,'confirmed':True,'changes':{}}).status_code==403
