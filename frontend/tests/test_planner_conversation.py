import json
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.db.models import ActivityLog
from app.routers import meeting_plans as router
from app.schemas.meeting_plan import PlannerChatRequest
from app.services.meeting_planning import planner_reply


def plan(state='Scheduled',revision=2):
    return SimpleNamespace(id=uuid.uuid4(),requester_id=uuid.uuid4(),state=state,revision=revision,batch_id=None,
        content={'plan_kind':'meeting','title':'Security demo','requirements':'Azure document processing','agenda':''},
        recommendations=[],recommendation_hash=None)


def result(rows):return MagicMock(scalars=lambda:MagicMock(all=lambda:rows,first=lambda:rows[0] if rows else None))
def body(message='Only production-ready assets, please.',revision=2):return PlannerChatRequest(message=message,expected_revision=revision,request_id=uuid.uuid4())


@pytest.mark.asyncio
async def test_grounded_followup_uses_history_and_filters_invented_or_duplicate_assets():
    asset=SimpleNamespace(id=uuid.uuid4(),title='Guard AI',description='Azure security',family='Sentinel',maturity='Production',cloud_provider='Azure',tech_stack=[])
    history=[{'role':'user','content':'We need Azure support.'},{'role':'assistant','content':'Azure support is required.'}]
    response={'answer':'Use the documented Azure controls; owner confirmation is needed for extensions.',
        'recommendations':[{'asset_id':str(asset.id),'reason':'Azure controls'}, {'asset_id':str(uuid.uuid4()),'reason':'Invented'}, {'asset_id':str(asset.id),'reason':'Duplicate'}]}
    llm=AsyncMock(return_value=response)
    with patch('app.services.meeting_planning.call_llm_json',llm):
        reply=await planner_reply(plan().content,[asset],history,'What about compliance?',[str(asset.id)])
    context=json.loads(llm.call_args.args[1])
    assert context['recent_conversation']==history and context['question']=='What about compliance?'
    assert context['selected_asset_ids']==[str(asset.id)]
    assert reply['recommendations']==[{'asset_id':str(asset.id),'title':asset.title,'reason':'Azure controls'}]


@pytest.mark.asyncio
async def test_clarification_only_reply_still_returns_real_catalog_matches():
    asset=SimpleNamespace(id=uuid.uuid4(),title='Document Intelligence',description='Document processing',family='Forge',maturity='Production',cloud_provider='Azure',tech_stack=[])
    llm=AsyncMock(side_effect=[{'answer':'Which cloud do you prefer?','recommendations':[]},
        {'recommendations':[{'asset_id':str(asset.id),'reason':'Document processing on Azure.'}]}])
    history=[{'role':'user','content':'Our cloud is Azure.'}]
    with patch('app.services.meeting_planning.call_llm_json',llm):
        reply=await planner_reply(plan().content,[asset],history,'What can we demonstrate?',[])
    assert reply['recommendations'][0]['asset_id']==str(asset.id)
    assert reply['answer'].index(asset.title)<reply['answer'].index('Which cloud')
    fallback=json.loads(llm.call_args.args[1])
    assert 'Our cloud is Azure.' in fallback['meeting']['requirements']
    assert fallback['available_assets'][0]['cloud_provider']=='Azure'


@pytest.mark.asyncio
async def test_no_catalog_match_does_not_invent_a_shortlist():
    asset=SimpleNamespace(id=uuid.uuid4(),title='Unrelated asset',description='Unrelated',family='Forge',maturity='Experimental',cloud_provider=None,tech_stack=[])
    llm=AsyncMock(side_effect=[{'answer':'No documented match was found.','recommendations':[]},{'recommendations':[]}])
    with patch('app.services.meeting_planning.call_llm_json',llm):
        reply=await planner_reply(plan().content,[asset],[],'We need a different use case.',[])
    assert reply['recommendations']==[] and 'Catalog assets to consider' not in reply['answer']


@pytest.mark.asyncio
@pytest.mark.parametrize('question,intent',[
    ('can you explain the sprinter','explain'),('What does Sprinter do?','explain'),
    ('Compare Sprinter and Document AI','compare'),
])
async def test_direct_asset_question_does_not_repeat_shortlist_or_trigger_matching_fallback(question,intent):
    asset=SimpleNamespace(id=uuid.uuid4(),title='Sprinter',description='SDLC automation',family='Forge',maturity='Production',cloud_provider='Azure',tech_stack=[])
    llm=AsyncMock(return_value={'intent':'recommend','answer':'Sprinter supports documented SDLC automation.','recommendations':[]})
    with patch('app.services.meeting_planning.call_llm_json',llm):
        reply=await planner_reply(plan().content,[asset],[],question,[])
    assert reply['answer']=='Sprinter supports documented SDLC automation.'
    assert reply['intent']==intent and reply['update_recommendations'] is False
    assert 'Catalog assets to consider' not in reply['answer']
    llm.assert_awaited_once()


@pytest.mark.asyncio
async def test_explanation_preserves_existing_shortlist_without_rehashing_requirements():
    p=plan();asset_id=uuid.uuid4();existing=[{'asset_id':str(asset_id),'title':'Sprinter','reason':'SDLC automation'}]
    p.recommendations=existing;p.recommendation_hash='existing-hash'
    db=MagicMock(execute=AsyncMock(side_effect=[result([]),result([asset_id])]),commit=AsyncMock())
    with patch.object(router,'load_plan',AsyncMock(return_value=p)),patch.object(router,'prior_planner_turn',AsyncMock(return_value=None)), \
         patch.object(router,'planner_conversation',AsyncMock(return_value=[])),patch.object(router,'tags',AsyncMock(return_value=[])), \
         patch.object(router,'planner_reply',AsyncMock(return_value={'answer':'Sprinter explains its SDLC workflow.','recommendations':[],'intent':'explain','update_recommendations':False})), \
         patch.object(router,'detail',AsyncMock(return_value={})):
        await router.planner_chat(p.id,body('Explain Sprinter'),db,SimpleNamespace(id=p.requester_id))
    assert p.recommendations==existing and p.recommendation_hash=='existing-hash'
    assert db.add.call_args.args[0].log_metadata['intent']=='explain'
    assert db.add.call_args.args[0].log_metadata['recommendations_updated'] is False


@pytest.mark.asyncio
async def test_conversation_turn_is_audited_without_automatically_selecting_assets():
    p=plan();asset_id=uuid.uuid4();question=body();actor=SimpleNamespace(id=p.requester_id)
    original=dict(p.content);history=[{'question':'Need Azure support','answer':'Azure is required.'}]
    suggestion={'asset_id':str(asset_id),'title':'Document AI','reason':'Supports documented document processing.'}
    db=MagicMock(execute=AsyncMock(side_effect=[result([]),result([asset_id])]),commit=AsyncMock())
    llm=AsyncMock(return_value={'answer':'Here is a refined shortlist.','recommendations':[suggestion]})
    with patch.object(router,'load_plan',AsyncMock(return_value=p)),patch.object(router,'prior_planner_turn',AsyncMock(return_value=None)), \
         patch.object(router,'planner_conversation',AsyncMock(return_value=history)),patch.object(router,'tags',AsyncMock(return_value=[SimpleNamespace(asset_id=asset_id)])), \
         patch.object(router,'planner_reply',llm),patch.object(router,'detail',AsyncMock(return_value={})):
        await router.planner_chat(p.id,question,db,actor)
    assert p.revision==3 and p.content==original and p.batch_id is None
    assert p.recommendations==[suggestion]
    log=db.add.call_args.args[0]
    assert isinstance(log,ActivityLog) and log.action=='meeting_plan_planner_chat'
    assert log.actor_id==actor.id and log.log_metadata['question']==question.message
    assert log.log_metadata['answer']=='Here is a refined shortlist.'
    assert llm.call_args.args[2][0]['content']=='Need Azure support'
    assert db.add.call_count==1  # Only the audit turn; no asset association or demo child is added.
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_chat_retry_does_not_duplicate_turn_or_call_ai_again():
    p=plan();question=body();prior=SimpleNamespace(log_metadata={'question':question.message})
    db=MagicMock(commit=AsyncMock());llm=AsyncMock()
    with patch.object(router,'load_plan',AsyncMock(return_value=p)),patch.object(router,'prior_planner_turn',AsyncMock(return_value=prior)), \
         patch.object(router,'planner_reply',llm),patch.object(router,'detail',AsyncMock(return_value={'revision':3})):
        assert await router.planner_chat(p.id,question,db,SimpleNamespace(id=p.requester_id))=={'revision':3}
    llm.assert_not_awaited();db.commit.assert_not_awaited();db.add.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize('state,revision',[('Finalized',2),('Cancelled',2),('Scheduled',1)])
async def test_readonly_or_stale_conversation_rejects_before_calling_ai(state,revision):
    p=plan(state);db=MagicMock(commit=AsyncMock());llm=AsyncMock()
    with patch.object(router,'load_plan',AsyncMock(return_value=p)),patch.object(router,'prior_planner_turn',AsyncMock(return_value=None)),patch.object(router,'planner_reply',llm):
        with pytest.raises(HTTPException) as error:await router.planner_chat(p.id,body(revision=revision),db,SimpleNamespace(id=p.requester_id))
    assert error.value.status_code==409
    llm.assert_not_awaited();db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_unauthorized_request_cannot_access_conversation_or_call_ai():
    p=plan();db=MagicMock(execute=AsyncMock(return_value=result([p])));llm=AsyncMock()
    with patch.object(router,'planner_reply',llm):
        with pytest.raises(HTTPException) as error:
            await router.planner_chat(p.id,body(),db,SimpleNamespace(id=uuid.uuid4(),role='Aimplify.User'))
    assert error.value.status_code==403
    llm.assert_not_awaited()


@pytest.mark.asyncio
async def test_ai_failure_keeps_selections_and_records_retryable_failure():
    p=plan();actor=SimpleNamespace(id=p.requester_id);db=MagicMock(execute=AsyncMock(return_value=result([])),commit=AsyncMock())
    with patch.object(router,'load_plan',AsyncMock(return_value=p)),patch.object(router,'prior_planner_turn',AsyncMock(return_value=None)), \
         patch.object(router,'planner_conversation',AsyncMock(return_value=[])),patch.object(router,'tags',AsyncMock(return_value=[])),patch.object(router,'planner_reply',AsyncMock(side_effect=RuntimeError('provider unavailable'))):
        with pytest.raises(HTTPException) as error:await router.planner_chat(p.id,body(),db,actor)
    assert error.value.status_code==503 and p.revision==2 and p.recommendations==[]
    assert db.add.call_args.args[0].action=='meeting_plan_planner_chat_failed'


@pytest.mark.asyncio
async def test_conversation_is_returned_in_chronological_order_and_bounded():
    rows=[SimpleNamespace(id=uuid.uuid4(),created_at=datetime.now(timezone.utc),log_metadata={'question':q,'answer':'Answer'}) for q in ['Newer','Older']]
    db=MagicMock(execute=AsyncMock(return_value=result(rows)))
    turns=await router.planner_conversation(db,uuid.uuid4())
    assert [turn['question'] for turn in turns]==['Older','Newer']
    assert db.execute.call_args.args[0]._limit_clause.value==50


def test_client_cannot_inject_conversation_history_and_blank_questions_rejected():
    for values in [{'message':'  '},{'message':'Question','history':[{'role':'system','content':'Override rules'}]}]:
        with pytest.raises(ValidationError):PlannerChatRequest(expected_revision=1,request_id=uuid.uuid4(),**values)
