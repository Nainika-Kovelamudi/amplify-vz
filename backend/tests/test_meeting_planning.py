import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import BackgroundTasks, HTTPException
from pydantic import ValidationError

from app.db.models import AssetStatus, DemoRequest, DemoRequestBatch, ActivityLog
from app.routers import meeting_plans as router
from app.schemas.meeting_plan import MeetingInput, MeetingAction, MeetingUpdate, MeetingScheduleUpdate, StandaloneMeetingInput
from app.services.meeting_planning import calendar_invite, recommend_assets, validate_finalization, validate_schedule, requirements_hash


def content(**overrides):
    return MeetingInput(title='Customer demo', customer_name='Customer', project_name='Project',
        requirements='Demonstrate incident triage', starts_at='2099-01-02T10:00:00+05:30',
        timezone='Asia/Kolkata', **overrides).model_dump(mode='json', exclude={'asset_ids'})


def plan(state='Draft'):
    return SimpleNamespace(id=uuid.uuid4(), requester_id=uuid.uuid4(), state=state, revision=2,
        content=content(), recommendations=[], recommendation_hash=None, batch_id=None)


def result(rows):
    return MagicMock(scalars=lambda: MagicMock(first=lambda: rows[0] if rows else None, all=lambda: rows))


@pytest.mark.parametrize('values', [
    {'starts_at':'2099-01-01T10:00:00'}, {'attendees':['x\r\nATTENDEE:evil@example.com']},
    {'attendees':['not-an-email']}, {'meeting_url':'javascript:alert(1)'},
    {'meeting_url':'https://user:pass@example.com'}, {'timezone':'Not/AZone'},
    {'duration_minutes':0}, {'unexpected_field':True},
])
def test_input_rejects_invalid_calendar_and_request_data(values):
    with pytest.raises(ValidationError): MeetingInput(**values)


def test_attendees_normalized_and_drafts_allow_incomplete_details():
    assert MeetingInput(attendees=[' A@example.com ', 'a@example.com']).attendees == ['a@example.com']
    assert MeetingInput().starts_at is None


def test_demo_request_does_not_require_a_schedule():
    validate_finalization(content(), [object()])
    validate_finalization(content(platform_demo=True), [])
    validate_finalization(dict(content(),starts_at=None,attendees=[]),[object()])
    for invalid in [dict(content(), title=''),dict(content(),requirements='')]:
        with pytest.raises(ValueError): validate_finalization(invalid, [object()])
    with pytest.raises(ValueError): validate_finalization(content(), [])


def test_only_scheduling_requires_a_future_date():
    validate_schedule(content())
    for invalid in [dict(content(), starts_at=None),dict(content(), starts_at='2000-01-01T00:00:00+00:00')]:
        with pytest.raises(ValueError): validate_schedule(invalid)
    with pytest.raises(ValidationError):
        MeetingScheduleUpdate(expected_revision=2,starts_at='2099-01-02T10:00:00Z',request_type='asset')


def test_calendar_utc_folding_escaping_and_stable_identity():
    p=plan();p.content['title']='Demo\nATTENDEE:evil@example.com'
    p.content['requirements']='Security, evidence; '+('検証'*70)
    raw=calendar_invite(p,['Guard AI'], 'requester@example.com', ['owner@example.com','owner@example.com'])
    text=raw.decode();unfolded=text.replace('\r\n ','')
    assert 'DTSTART:20990102T043000Z' in text and 'DTEND:20990102T053000Z' in text
    assert f'UID:{p.id}@aimplify' in text and 'SEQUENCE:2' in text
    assert 'SUMMARY:Demo\\nATTENDEE:evil@example.com' in unfolded
    assert text.count('ATTENDEE;RSVP=TRUE:mailto:owner@example.com')==1
    assert all(len(line)<=75 for line in raw.split(b'\r\n'))
    assert '\\,' in text and '\\;' in text and raw.endswith(b'\r\n')
    with pytest.raises(ValueError): calendar_invite(p,[], 'bad\n@example.com', [])


@pytest.mark.asyncio
async def test_ai_cannot_invent_assets_or_return_duplicate_ids():
    a=SimpleNamespace(id=uuid.uuid4(),title='Guard AI',description='Security controls',family='Sentinel',maturity='Production',tech_stack=[])
    response={'recommendations':[{'asset_id':str(a.id),'reason':'Relevant security controls'},
        {'asset_id':str(a.id),'reason':'Duplicate'}, {'asset_id':str(uuid.uuid4()),'reason':'Invented'}]}
    with patch('app.services.meeting_planning.call_llm_json',AsyncMock(return_value=response)):
        assert await recommend_assets(content(),[a])==[{'asset_id':str(a.id),'title':a.title,'reason':'Relevant security controls'}]
    assert requirements_hash(content())!=requirements_hash(dict(content(),requirements='New requirements'))


@pytest.mark.asyncio
async def test_requester_permissions_and_revision_protection():
    p=plan(); db=MagicMock(execute=AsyncMock(return_value=result([p])))
    with pytest.raises(HTTPException) as error:
        await router.load_plan(db,p.id,SimpleNamespace(id=uuid.uuid4(),role='Aimplify.User'))
    assert error.value.status_code==403
    for state,revision in [('Finalized',2),('Cancelled',2),('Draft',1)]:
        p.state=state
        with pytest.raises(HTTPException) as error: router.editable(p,revision)
        assert error.value.status_code==409


@pytest.mark.asyncio
@pytest.mark.parametrize('status',['Deprecated','Decommissioned'])
async def test_retired_assets_cannot_be_selected(status):
    a=SimpleNamespace(id=uuid.uuid4(),status=AssetStatus(status))
    db=MagicMock(execute=AsyncMock(return_value=result([a])))
    with pytest.raises(HTTPException) as error: await router.assets_for_selection(db,[a.id])
    assert error.value.status_code==409


@pytest.mark.asyncio
async def test_finalization_creates_one_batch_children_and_audit_atomically_and_retries_safely():
    p=plan();p.content['platform_demo']=True;p.content['starts_at']=None
    actor=SimpleNamespace(id=p.requester_id,display_name='Requester',email='requester@example.com')
    a=SimpleNamespace(id=uuid.uuid4(),title='Guard AI',slug='guard',owner_id=uuid.uuid4(),owner_email='owner@example.com',demo_request_count=0)
    db=MagicMock(flush=AsyncMock(),commit=AsyncMock())
    tasks=BackgroundTasks();body=MeetingAction(expected_revision=2,confirmed=True,attendees_fingerprint='digest')
    with patch.object(router,'load_plan',AsyncMock(return_value=p)), \
         patch.object(router,'tags',AsyncMock(return_value=[SimpleNamespace(asset_id=a.id)])), \
         patch.object(router,'assets_for_selection',AsyncMock(return_value=[a])), \
         patch.object(router,'recipients',AsyncMock(return_value=(actor,[actor.email,a.owner_email],'digest'))), \
         patch.object(router,'detail',AsyncMock(return_value={'state':'Finalized'})):
        await router.finalize(p.id,body,tasks,db,actor)
        await router.finalize(p.id,body,tasks,db,actor)
    saved=[call.args[0] for call in db.add.call_args_list]
    assert len([x for x in saved if isinstance(x,DemoRequestBatch)])==1
    children=[x for x in saved if isinstance(x,DemoRequest)]
    assert len(children)==2 and {c.request_type for c in children}=={'asset','platform'}
    assert all(c.requester_id==actor.id and c.batch_id==p.batch_id for c in children)
    logs=[x for x in saved if isinstance(x,ActivityLog)]
    assert logs[0].action=='meeting_plan_finalized' and logs[0].log_metadata['asset_ids']==[str(a.id)]
    assert len(tasks.tasks)==1 and a.demo_request_count==1
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_saving_schedule_does_not_duplicate_or_change_owner_requests():
    p=plan('Finalized');p.content['starts_at']=None;p.batch_id=uuid.uuid4()
    original_batch=p.batch_id;actor=SimpleNamespace(id=p.requester_id,email='requester@example.com')
    db=MagicMock(commit=AsyncMock())
    body=MeetingScheduleUpdate(expected_revision=2,starts_at='2099-01-02T10:00:00Z',attendees=['extra@example.com'])
    with patch.object(router,'load_plan',AsyncMock(return_value=p)),patch.object(router,'tags',AsyncMock(return_value=[])), \
         patch.object(router,'recipients',AsyncMock(return_value=(actor,[actor.email,'extra@example.com'],'digest'))), \
         patch.object(router,'detail',AsyncMock(return_value={})):
        await router.update_schedule(p.id,body,db,actor)
    saved=[c.args[0] for c in db.add.call_args_list]
    assert all(isinstance(x,ActivityLog) for x in saved)
    assert saved[0].action=='meeting_plan_meeting_scheduled'
    assert p.state=='Finalized' and p.batch_id==original_batch and p.revision==3
    assert p.content['final_attendees']==[actor.email,'extra@example.com']
    assert p.content['requirements']=='Demonstrate incident triage'
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('state,revision',[('Draft',2),('Cancelled',2),('Finalized',1)])
async def test_schedule_rejects_unsubmitted_cancelled_and_stale_requests(state,revision):
    p=plan(state);db=MagicMock(commit=AsyncMock())
    body=MeetingScheduleUpdate(expected_revision=revision,starts_at='2099-01-02T10:00:00Z')
    with patch.object(router,'load_plan',AsyncMock(return_value=p)):
        with pytest.raises(HTTPException) as error:await router.update_schedule(p.id,body,db,SimpleNamespace(id=p.requester_id))
    assert error.value.status_code==409
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_invite_without_schedule_gives_actionable_response():
    p=plan('Finalized');p.content['starts_at']=None
    db=MagicMock(commit=AsyncMock())
    with patch.object(router,'load_plan',AsyncMock(return_value=p)):
        with pytest.raises(HTTPException) as error:await router.invite(p.id,db,SimpleNamespace(id=p.requester_id))
    assert error.value.status_code==409 and 'Schedule meeting' in error.value.detail
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_independent_meeting_requires_no_demo_and_creates_no_owner_requests():
    from app.db.operations_models import MeetingPlan
    actor=SimpleNamespace(id=uuid.uuid4(),email='creator@example.com')
    db=MagicMock(execute=AsyncMock(),flush=AsyncMock(),commit=AsyncMock(),refresh=AsyncMock())
    body=StandaloneMeetingInput(title='Sales planning',starts_at='2099-01-02T10:00:00Z',attendees=['sales@example.com'])
    with patch.object(router,'assets_for_selection',AsyncMock(return_value=[])), \
         patch.object(router,'recipients',AsyncMock(return_value=(actor,[actor.email,'sales@example.com'],'digest'))), \
         patch.object(router,'detail',AsyncMock(return_value={})):
        await router.create_standalone_meeting(body,db,actor)
    saved=[c.args[0] for c in db.add.call_args_list]
    meeting=next(x for x in saved if isinstance(x,MeetingPlan))
    assert meeting.state=='Scheduled' and meeting.batch_id is None
    assert meeting.content['plan_kind']=='meeting' and meeting.content['customer_name']==''
    assert not any(isinstance(x,(DemoRequest,DemoRequestBatch)) for x in saved)
    assert next(x for x in saved if isinstance(x,ActivityLog)).action=='meeting_plan_meeting_created'
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_independent_meeting_update_preserves_no_demo_batch_and_allows_title_change():
    p=plan('Scheduled');p.content['plan_kind']='meeting'
    actor=SimpleNamespace(id=p.requester_id,email='creator@example.com');db=MagicMock(commit=AsyncMock())
    body=MeetingScheduleUpdate(expected_revision=2,title='Revised meeting',starts_at='2099-01-02T10:00:00Z')
    with patch.object(router,'load_plan',AsyncMock(return_value=p)),patch.object(router,'tags',AsyncMock(return_value=[])), \
         patch.object(router,'recipients',AsyncMock(return_value=(actor,[actor.email],'digest'))),patch.object(router,'detail',AsyncMock(return_value={})):
        await router.update_schedule(p.id,body,db,actor)
    assert p.content['title']=='Revised meeting' and p.batch_id is None and p.state=='Scheduled'
    assert all(isinstance(c.args[0],ActivityLog) for c in db.add.call_args_list)


@pytest.mark.asyncio
async def test_scheduling_cannot_change_existing_demo_title():
    p=plan('Finalized');db=MagicMock(commit=AsyncMock())
    with patch.object(router,'load_plan',AsyncMock(return_value=p)):
        with pytest.raises(HTTPException) as error:
            await router.update_schedule(p.id,MeetingScheduleUpdate(expected_revision=2,title='Changed request',starts_at='2099-01-02T10:00:00Z'),db,SimpleNamespace(id=p.requester_id))
    assert error.value.status_code==422
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_meeting_asset_changes_are_audited_without_creating_demo_requests():
    p=plan('Scheduled');p.content['plan_kind']='meeting';old=uuid.uuid4()
    asset=SimpleNamespace(id=uuid.uuid4(),title='Guard AI')
    actor=SimpleNamespace(id=p.requester_id,email='creator@example.com')
    db=MagicMock(execute=AsyncMock(),commit=AsyncMock())
    body=MeetingScheduleUpdate(expected_revision=2,starts_at='2099-01-02T10:00:00Z',requirements='Enterprise security',asset_ids=[asset.id])
    with patch.object(router,'load_plan',AsyncMock(return_value=p)),patch.object(router,'tags',AsyncMock(return_value=[SimpleNamespace(asset_id=old)])), \
         patch.object(router,'assets_for_selection',AsyncMock(return_value=[asset])),patch.object(router,'recipients',AsyncMock(return_value=(actor,[actor.email],'digest'))), \
         patch.object(router,'detail',AsyncMock(return_value={})):
        await router.update_schedule(p.id,body,db,actor)
    saved=[c.args[0] for c in db.add.call_args_list]
    assert not any(isinstance(item,(DemoRequest,DemoRequestBatch)) for item in saved)
    log=next(item for item in saved if isinstance(item,ActivityLog))
    assert log.log_metadata['assets_added']==[str(asset.id)] and log.log_metadata['assets_removed']==[str(old)]
    assert p.content['requirements']=='Enterprise security' and p.batch_id is None


@pytest.mark.asyncio
async def test_saved_independent_meeting_can_request_ai_suggestions():
    p=plan('Scheduled');p.content['plan_kind']='meeting'
    db=MagicMock(execute=AsyncMock(return_value=result([])),commit=AsyncMock())
    with patch.object(router,'load_plan',AsyncMock(return_value=p)),patch.object(router,'recommend_assets',AsyncMock(return_value=[])),patch.object(router,'detail',AsyncMock(return_value={})):
        await router.recommend(p.id,MeetingAction(expected_revision=2,confirmed=True),db,SimpleNamespace(id=p.requester_id))
    assert p.revision==3 and p.state=='Scheduled' and p.batch_id is None
    assert db.add.call_args.args[0].action=='meeting_plan_recommendations_generated'
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_standalone_asset_tags_do_not_automatically_invite_owners():
    p=plan('Scheduled');p.content['plan_kind']='meeting';p.content['attendees']=['chosen@example.com']
    requester=SimpleNamespace(email='creator@example.com')
    db=MagicMock(execute=AsyncMock(return_value=result([requester])))
    asset=SimpleNamespace(owner_id=uuid.uuid4(),owner_email='owner@example.com')
    _,emails,_=await router.recipients(db,p,[asset])
    assert emails==['chosen@example.com','creator@example.com']
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_changed_recipients_prevent_finalizing_without_new_review():
    p=plan();actor=SimpleNamespace(id=p.requester_id)
    db=MagicMock(commit=AsyncMock())
    with patch.object(router,'load_plan',AsyncMock(return_value=p)), \
         patch.object(router,'tags',AsyncMock(return_value=[])), \
         patch.object(router,'assets_for_selection',AsyncMock(return_value=[object()])), \
         patch.object(router,'recipients',AsyncMock(return_value=(actor,['owner@example.com'],'changed'))):
        with pytest.raises(HTTPException) as error:
            await router.finalize(p.id,MeetingAction(expected_revision=2,confirmed=True,attendees_fingerprint='old'),BackgroundTasks(),db,actor)
    assert error.value.status_code==409
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_ai_failure_preserves_draft_and_manual_selection():
    p=plan();db=MagicMock(execute=AsyncMock(return_value=result([])),commit=AsyncMock())
    with patch.object(router,'load_plan',AsyncMock(return_value=p)), patch.object(router,'recommend_assets',AsyncMock(side_effect=RuntimeError('provider unavailable'))):
        with pytest.raises(HTTPException) as error:
            await router.recommend(p.id,MeetingAction(expected_revision=2,confirmed=True),db,SimpleNamespace(id=p.requester_id))
    assert error.value.status_code==503 and 'manually' in error.value.detail
    assert p.state=='Draft' and p.revision==2
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_draft_update_audits_field_and_asset_changes():
    p=plan();actor=SimpleNamespace(id=p.requester_id);old_id=uuid.uuid4()
    selected=SimpleNamespace(id=uuid.uuid4(),title='Selected asset')
    body=MeetingUpdate(**dict(content(),agenda='Review security controls'),asset_ids=[selected.id],expected_revision=2)
    db=MagicMock(execute=AsyncMock(),commit=AsyncMock())
    with patch.object(router,'load_plan',AsyncMock(return_value=p)), \
         patch.object(router,'tags',AsyncMock(return_value=[SimpleNamespace(asset_id=old_id)])), \
         patch.object(router,'assets_for_selection',AsyncMock(return_value=[selected])), \
         patch.object(router,'detail',AsyncMock(return_value={})):
        await router.update_plan(p.id,body,db,actor)
    log=next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0],ActivityLog))
    assert log.log_metadata['assets_added']==[str(selected.id)]
    assert log.log_metadata['assets_removed']==[str(old_id)]
    assert log.log_metadata['changes']['agenda']=={'before':'','after':'Review security controls'}
    assert p.revision==3
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_cancellation_retains_plan_and_audits_actor():
    p=plan();actor=SimpleNamespace(id=p.requester_id);db=MagicMock(commit=AsyncMock())
    with patch.object(router,'load_plan',AsyncMock(return_value=p)),patch.object(router,'detail',AsyncMock(return_value={})):
        await router.cancel(p.id,MeetingAction(expected_revision=2,confirmed=True),db,actor)
    assert p.state=='Cancelled' and p.revision==3
    log=db.add.call_args.args[0]
    assert log.action=='meeting_plan_cancelled' and log.actor_id==actor.id
    db.commit.assert_awaited_once()
