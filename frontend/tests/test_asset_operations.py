import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from contextlib import ExitStack

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql

from app.db.base import get_db
from app.deps.rbac import get_current_user
from app.routers.platform_operations import router, update_remediation, RemediationUpdate
from app.schemas.submission import SubmissionUpdate
from app.schemas.metadata_rules import corporate_repo, validate_patch_pair, cloud_filter
from app.db.models import CatalogAsset
from app.services.artifact_migration import storage_plan
from app.services.evaluation_jobs import EXPECTED, evaluation_health, evaluation_fingerprint, enqueue_evaluation, claim_job


def result(value):
    return MagicMock(scalars=lambda: MagicMock(first=lambda: value))


def entity(**changes):
    return SimpleNamespace(**(dict(id=uuid.uuid4(),title='Test asset',family='forge',
        status='Published',updated_at=datetime.now(timezone.utc),ai_score=None,ai_feedback=None,
        architecture_file_url=None,video_url=None,video_urls=[],demo_url=None,owner_name=None,owner_email=None) | changes))


def test_health_distinguishes_zero_missing_failed_and_stale():
    target=entity()
    assert evaluation_health(target)=='Missing'
    target.ai_score=0
    assert evaluation_health(target)=='Incomplete'
    target.ai_feedback={'agent_scores':dict.fromkeys(EXPECTED,0)}
    assert evaluation_health(target)=='Complete'  # A real evaluated zero is not a job failure.
    target.ai_feedback['input_fingerprint']=evaluation_fingerprint(target)
    target.video_urls=['https://example.com/new.mp4']
    assert evaluation_health(target)=='Stale'
    target.ai_feedback['error']='provider unavailable'
    assert evaluation_health(target)=='Failed'


def test_metadata_rejects_invalid_inputs_and_normalizes_clouds():
    assert SubmissionUpdate(cloud_provider='azure, AWS, azure').cloud_provider=='Azure, AWS'
    for values in ({'repo_url':None},{'tech_stack':[]},{'title':None},{'family':'invalid'},{'cloud_provider':'Mars'},
                   {'repo_url':'https://github.com/personal/repo'},
                   {'owner_email':'same@infovision.com','manager_email':'SAME@infovision.com'},
                   {'video_url':'javascript:alert(1)'},
                   {'architecture_file_url':json.dumps({'sales_pitch':{'url':42}})}):
        with pytest.raises(ValidationError): SubmissionUpdate(**values)
    assert corporate_repo('https://github.com/infovision-ai/amplify')
    with pytest.raises(ValueError): corporate_repo('https://github.com.evil.test/infovision-ai/a')
    assert SubmissionUpdate(description='Updated details').model_dump(exclude_unset=True)=={'description':'Updated details'}


def test_patch_checks_saved_manager_and_cloud_filter_matches_tokens():
    with pytest.raises(HTTPException) as exc:
        validate_patch_pair(SimpleNamespace(manager_email='boss@infovision.com'),{'owner_email':'BOSS@infovision.com'})
    assert exc.value.status_code==422
    expression=cloud_filter(CatalogAsset.cloud_provider,'AWS')
    sql=str(expression.compile(dialect=postgresql.dialect(),compile_kwargs={'literal_binds':True}))
    assert ',aws,' in sql and 'concat' in sql


def test_storage_plan_restricts_accounts_keeps_sources_and_supports_safe_rename():
    target=entity(video_url='https://approved.blob.core.windows.net/artifacts/draft/old.mp4?sig=secret',
                  demo_url='https://external.example/live',
                  video_urls=['https://another.blob.core.windows.net/artifacts/draft/no.mp4'])
    plan=storage_plan(target,'approved')
    assert len(plan['files'])==1 and plan['originals_retained']
    assert plan['files'][0]['destination']==f'forge/{target.id}/video/old.mp4'
    assert 'secret' not in json.dumps(plan)
    renamed=storage_plan(target,'approved',{'draft/old.mp4':'PromptEval.mp4'})
    assert renamed['fingerprint']!=plan['fingerprint']
    assert renamed['files'][0]['destination'].endswith('/PromptEval.mp4')
    with pytest.raises(ValueError): storage_plan(target,'approved',{'draft/old.mp4':'../bad.mp4'})
    with pytest.raises(ValueError): storage_plan(target,'approved',{'draft/old.mp4':'bad.html'})
    target.video_url='https://approved.blob.core.windows.net/artifacts/'+plan['files'][0]['destination']
    assert storage_plan(target,'approved')['files']==[]


def test_queue_reuses_record_and_preserves_publication():
    async def run():
        target=entity()
        job=SimpleNamespace(state='Queued',lease_until=None)
        db=MagicMock(execute=AsyncMock(side_effect=[result(target),result(job)]),flush=AsyncMock())
        saved=await enqueue_evaluation(db,target.id,'catalog_asset')
        assert saved is job and job.state=='Queued' and job.attempts==0
        assert job.options['preserve_status']=='Published'
        assert job.options['expected_updated_at']==target.updated_at.isoformat()
        db.add.assert_not_called()
    asyncio.run(run())


def test_queue_refuses_an_active_lease():
    async def run():
        target=entity()
        job=SimpleNamespace(state='Running',lease_until=datetime.now(timezone.utc)+timedelta(seconds=90))
        db=MagicMock(execute=AsyncMock(side_effect=[result(target),result(job)]),flush=AsyncMock())
        with pytest.raises(HTTPException) as exc: await enqueue_evaluation(db,target.id,'catalog_asset')
        assert exc.value.status_code==409
    asyncio.run(run())


def test_interrupted_job_claim_gets_new_lease_and_locks_skip_locked():
    async def run():
        job=SimpleNamespace(state='Running',attempts=1,lease_token='old')
        db=MagicMock(execute=AsyncMock(return_value=result(job)),commit=AsyncMock())
        assert await claim_job(db) is job
        assert job.attempts==2 and job.lease_token!='old' and job.lease_until>datetime.now(timezone.utc)
        sql=str(db.execute.call_args.args[0].compile(dialect=postgresql.dialect()))
        assert 'SKIP LOCKED' in sql
        job.attempts=3
        assert await claim_job(db) is None and job.state=='Failed'
    asyncio.run(run())


def remediation(assignee):
    return SimpleNamespace(**dict.fromkeys(('asset_id','due_at','evidence','reviewer_id','reviewed_at','created_at','updated_at')),
        id=uuid.uuid4(),asset_title='Asset',category='Security',title='Control evidence',action='Provide proof',
        severity='Medium',state='Open',assignee_id=assignee)


def test_assignee_can_submit_evidence_but_cannot_self_close():
    async def run():
        uid=uuid.uuid4();item=remediation(uid)
        db=MagicMock(execute=AsyncMock(return_value=result(item)),commit=AsyncMock(),refresh=AsyncMock())
        user=SimpleNamespace(id=uid,role='Aimplify.User')
        with pytest.raises(HTTPException) as exc:
            await update_remediation(item.id,RemediationUpdate(state='Ready for Review'),db,user)
        assert exc.value.status_code==422
        saved=await update_remediation(item.id,RemediationUpdate(state='Ready for Review',evidence='Owner review and test results'),db,user)
        assert saved['state']=='Ready for Review'
        user.role='Aimplify.Owner'
        with pytest.raises(HTTPException) as exc:
            await update_remediation(item.id,RemediationUpdate(state='Closed'),db,user)
        assert exc.value.status_code==403
        with pytest.raises(HTTPException) as exc:
            await update_remediation(item.id,RemediationUpdate(state='Closed',assignee_id=uuid.uuid4()),db,user)
        assert exc.value.status_code==403  # Reassign-and-close cannot bypass independent review.
        user.id=uuid.uuid4()
        saved=await update_remediation(item.id,RemediationUpdate(state='Closed'),db,user)
        assert saved['reviewer_id']==user.id and saved['reviewed_at']
    asyncio.run(run())


def test_non_assignee_cannot_edit_and_null_severity_is_rejected():
    async def run():
        item=remediation(uuid.uuid4())
        db=MagicMock(execute=AsyncMock(return_value=result(item)))
        user=SimpleNamespace(id=uuid.uuid4(),role='Aimplify.User')
        with pytest.raises(HTTPException) as exc: await update_remediation(item.id,RemediationUpdate(evidence='Unauthorized'),db,user)
        assert exc.value.status_code==403
        user.role='Aimplify.Admin'
        with pytest.raises(HTTPException) as exc: await update_remediation(item.id,RemediationUpdate(severity=None),db,user)
        assert exc.value.status_code==422
    asyncio.run(run())


def test_operations_inventory_requires_governance_role():
    app=FastAPI();app.include_router(router)
    async def db(): yield MagicMock()
    app.dependency_overrides[get_db]=db
    app.dependency_overrides[get_current_user]=lambda: SimpleNamespace(id=uuid.uuid4(),role='Aimplify.User')
    with TestClient(app) as client:
        assert client.get('/admin/platform-operations/inventory').status_code==403
        assert client.post('/admin/platform-operations/evaluations',json={'asset_ids':[str(uuid.uuid4())]}).status_code==403


def test_due_dates_require_timezones():
    with pytest.raises(ValidationError): RemediationUpdate(due_at='2026-10-22T12:00:00')
    assert RemediationUpdate(due_at='2026-10-22T12:00:00Z').due_at.tzinfo


def test_operational_foreign_keys_share_the_application_model_registry():
    from app.db.base import Base
    from app.db.models import Base as ModelBase, UserProfile, CatalogAsset
    from app.db.operations_models import EvaluationJob, RemediationItem
    assert Base is ModelBase
    assert EvaluationJob.__table__.metadata is UserProfile.__table__.metadata
    assert RemediationItem.__table__.metadata is CatalogAsset.__table__.metadata
    for table in Base.metadata.tables.values():
        for key in table.foreign_keys:
            assert key.column.table.metadata is Base.metadata
    # SQLAlchemy resolves these dependencies while preparing a flush. Merely
    # importing the application does not detect a split declarative registry.
    assert EvaluationJob.__mapper__._sorted_tables
    assert RemediationItem.__mapper__._sorted_tables


@pytest.mark.parametrize("failed", [False, True])
def test_published_catalog_evaluation_preserves_state_and_records_all_weights(failed):
    from app.db.models import AssetStatus
    from app.services import orchestrator as flow
    target=CatalogAsset(id=uuid.uuid4(),title='Test asset',description='Architecture security scalability '+('details '*55),
        family='forge',department='Engineering',tech_stack=['Python'],cloud_provider='Azure',maturity='Production',
        owner_name='Owner',owner_email='owner@infovision.com',manager_name='Manager',manager_email='manager@infovision.com',
        designation='Engineer',video_urls=[],commands=['docker compose up'],dependencies='Docker',
        status=AssetStatus.Published,catalog_code='FOR-999')
    async def run():
        db=MagicMock(execute=AsyncMock(side_effect=[result(target),MagicMock(scalars=lambda:MagicMock(all=lambda:[]))]),commit=AsyncMock())
        session=MagicMock(__aenter__=AsyncMock(return_value=db),__aexit__=AsyncMock(return_value=False))
        with ExitStack() as stack:
            stack.enter_context(patch('app.db.base.get_session_factory',return_value=lambda:session))
            stack.enter_context(patch.object(flow,'_fetch_existing_entries',new=AsyncMock(return_value=[])))
            for name in ('validate_video_url','validate_demo_url','validate_repo_url'):
                stack.enter_context(patch.object(flow,name,new=AsyncMock(return_value={'valid':True})))
            for cls in (flow.RelevanceAgent,flow.TechQualityAgent,flow.DescriptionAgent,flow.DemoReadinessAgent,
                        flow.DuplicateCheckAgent,flow.DocumentValidationAgent,flow.VideoValidationAgent):
                stack.enter_context(patch.object(cls,'run',new=AsyncMock(return_value={'score':90,'feedback':'Reviewed','confidence':.9})))
            if failed:
                stack.enter_context(patch.object(flow.TechQualityAgent,'run',new=AsyncMock(return_value={'score':900,'confidence':.9})))
            stack.enter_context(patch.object(flow.PreApprovalCheckAgent,'run',new=AsyncMock(return_value={'security':{'status':'pass'}})))
            await flow.run_scoring_pipeline(str(target.id),{'preserve_status':'Published'},'catalog_asset')
        assert target.status==AssetStatus.Published
        assert evaluation_health(target)==('Failed' if failed else 'Complete')
        assert sum(target.ai_feedback['weights'].values())==100
        if not failed: assert target.ai_feedback['raw_score']==90 and target.ai_score==90
    asyncio.run(run())


def test_report_uses_explicit_uuid_or_publication_link_for_review_trace():
    from app.services.asset_quality_service import build_quality_report
    async def run():
        target=entity(slug="test-asset",catalog_code="FOR-999")
        now=datetime.now(timezone.utc)
        sub=SimpleNamespace(id=uuid.uuid4(),catalog_code=str(target.id),created_at=now,reviewed_at=now,reviewed_by=uuid.uuid4())
        report=await build_quality_report([(target,None)],[sub])
        trace=next(f for f in report['assets'][0]['findings'] if f['criterion']=='Review traceability')
        assert trace['credit']==1
        sub.catalog_code=None
        report=await build_quality_report([(target,None)],[sub],publication_links={str(sub.id):str(target.id)})
        trace=next(f for f in report['assets'][0]['findings'] if f['criterion']=='Review traceability')
        assert trace['credit']==1
    asyncio.run(run())
