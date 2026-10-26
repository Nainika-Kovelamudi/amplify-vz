"""Owner/admin remediation, evaluation recovery and non-destructive storage plans."""
import csv
import hashlib
import io
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.db.models import CatalogAsset, UserProfile, ActivityLog
from app.db.operations_models import EvaluationJob, RemediationItem
from app.deps.rbac import get_current_user, require_role
from app.services.evaluation_jobs import enqueue_evaluation, evaluation_health
from app.services.artifact_migration import storage_plan, configured_account
from app.services.security_report_service import safe_cell

router = APIRouter(prefix='/admin/platform-operations', tags=['Platform operations'])
from app.routers.metadata_operations import router as metadata_router
router.include_router(metadata_router)
STATES = ('Open','In Progress','Blocked','Ready for Review','Closed')


def privileged(user):
    return getattr(user.role, 'value', user.role) in ('Aimplify.Admin','Aimplify.Owner')


def job_response(job):
    return {'id':str(job.id),'entity_id':str(job.entity_id),'kind':job.entity_type,'state':job.state,
            'attempts':job.attempts,'error':job.error,'updated_at':job.updated_at}


def item_response(item):
    return {k: getattr(item,k) for k in ('id','asset_id','asset_title','category','title','action','severity','state',
                                       'assignee_id','due_at','evidence','reviewer_id','reviewed_at','created_at','updated_at')}


class QueueRequest(BaseModel):
    asset_ids: list[uuid.UUID] = Field(min_length=1,max_length=100)
    force: bool = False


@router.post('/assets/{asset_id}/rerun-evaluation', status_code=202)
async def rerun_asset_evaluation(asset_id: uuid.UUID, db: AsyncSession=Depends(get_db),
                                user=require_role('Aimplify.Owner')):
    from app.config import get_settings
    if not get_settings().evaluation_worker_enabled:
        raise HTTPException(409, 'AI evaluation processing is disabled. Enable the evaluation worker before rerunning.')
    asset=(await db.execute(select(CatalogAsset).where(CatalogAsset.id==asset_id).with_for_update())).scalars().first()
    if not asset:
        raise HTTPException(404, 'Asset not found.')
    job=await enqueue_evaluation(db,asset.id,'catalog_asset',user.id,force=True)
    db.add(ActivityLog(actor_id=user.id,action='asset_evaluation_rerun_requested',entity_type='catalog_asset',
                       entity_id=asset.id,log_metadata={'job_id':str(job.id)}))
    await db.commit()
    return {'job':job_response(job)}


@router.get('/inventory')
async def inventory(db: AsyncSession=Depends(get_db), user=require_role('Aimplify.Admin','Aimplify.Owner')):
    from app.config import get_settings
    from app.schemas.metadata_rules import corporate_repo, cloud_values
    account = configured_account(get_settings())
    assets = (await db.execute(select(CatalogAsset).order_by(CatalogAsset.title))).scalars().all()
    jobs = (await db.execute(select(EvaluationJob))).scalars().all()
    by_target = {(str(j.entity_id),j.entity_type): j for j in jobs}
    result = []
    for asset in assets:
        try: repo_valid = bool(asset.repo_url and corporate_repo(asset.repo_url))
        except ValueError: repo_valid = False
        try: cloud_valid = bool(cloud_values(asset.cloud_provider))
        except ValueError: cloud_valid = False
        storage_error=None
        try: plan=storage_plan(asset,account)
        except ValueError as exc:
            storage_error=str(exc);plan={'files':[]}
        job=by_target.get((str(asset.id),'catalog_asset'))
        storage_job=by_target.get((str(asset.id),'artifact_migration'))
        result.append({'id':str(asset.id),'catalog_code':asset.catalog_code,'title':asset.title,'slug':asset.slug,
                       'family':asset.family,'status':getattr(asset.status,'value',asset.status),
                       'owner_email':asset.owner_email,'evaluation_health':evaluation_health(asset),
                       'missing_repository':not repo_valid,'invalid_cloud_tags':not cloud_valid,
                       'storage_files_to_finalize':len(plan['files']), 'storage_error':storage_error, 'evaluation_job':job_response(job) if job else None,
                       'storage_job':job_response(storage_job) if storage_job else None})
    return {'assets':result,'worker_enabled':get_settings().evaluation_worker_enabled}


@router.get('/assignees')
async def assignees(db:AsyncSession=Depends(get_db),user=require_role('Aimplify.Admin','Aimplify.Owner')):
    rows=(await db.execute(select(UserProfile.id,UserProfile.display_name,UserProfile.email).order_by(UserProfile.email))).all()
    return [{'id':str(uid),'name':name or email,'email':email} for uid,name,email in rows]


@router.post('/evaluations', status_code=202)
async def queue_evaluations(body: QueueRequest, db: AsyncSession=Depends(get_db), user=require_role('Aimplify.Admin','Aimplify.Owner')):
    # Validate the complete selection before any write. No partial batch success.
    ids = list(dict.fromkeys(body.asset_ids))
    assets=(await db.execute(select(CatalogAsset).where(CatalogAsset.id.in_(ids)).order_by(CatalogAsset.id).with_for_update())).scalars().all()
    if len(assets)!=len(ids): raise HTTPException(404,'One or more selected assets no longer exist.')
    result=[]
    for asset in assets:
        job=await enqueue_evaluation(db,asset.id,'catalog_asset',user.id,force=body.force)
        result.append(job_response(job))
    db.add(ActivityLog(actor_id=user.id,action='asset_evaluation_batch_queued',entity_type='catalog_asset',
                       log_metadata={'asset_ids':[str(v) for v in ids],'force':body.force}))
    await db.commit()
    return {'jobs':result}


@router.get('/assets/{asset_id}/storage-plan')
async def get_storage_plan(asset_id:uuid.UUID, db:AsyncSession=Depends(get_db), user=require_role('Aimplify.Admin','Aimplify.Owner')):
    from app.config import get_settings
    asset=await db.get(CatalogAsset,asset_id)
    if not asset: raise HTTPException(404,'Asset not found.')
    try: return storage_plan(asset,configured_account(get_settings()))
    except ValueError as exc: raise HTTPException(422,str(exc)) from exc


class StorageRequest(BaseModel):
    fingerprint: str = Field(min_length=64,max_length=64)
    confirmed_asset_association: bool
    renames: dict[str,str] = Field(default_factory=dict,max_length=100)


@router.post('/assets/{asset_id}/finalize-storage',status_code=202)
async def finalize_storage(asset_id:uuid.UUID,body:StorageRequest,db:AsyncSession=Depends(get_db),user=require_role('Aimplify.Admin','Aimplify.Owner')):
    from app.config import get_settings
    if not body.confirmed_asset_association: raise HTTPException(422,'Confirm that each recording/document belongs to this asset first.')
    asset=await db.get(CatalogAsset,asset_id)
    if not asset: raise HTTPException(404,'Asset not found.')
    account=configured_account(get_settings())
    if not account: raise HTTPException(409,'Configure Azure Blob storage before finalizing artifacts.')
    current=storage_plan(asset,account)
    if current['fingerprint']!=body.fingerprint: raise HTTPException(409,'Asset references changed. Refresh the storage plan.')
    if not current['files']: raise HTTPException(409,'No eligible files need finalization.')
    if set(body.renames)-{f['source'] for f in current['files']}: raise HTTPException(422,'Rename keys must belong to the current plan.')
    try: plan=storage_plan(asset,account,body.renames)
    except ValueError as exc: raise HTTPException(422,str(exc)) from exc
    job=await enqueue_evaluation(db,asset.id,'artifact_migration',user.id,force=True,
        options={'fingerprint':plan['fingerprint'],'actor_id':str(user.id),'renames':body.renames})
    db.add(ActivityLog(actor_id=user.id,action='artifact_finalization_queued',entity_type='catalog_asset',entity_id=asset.id,
                       log_metadata={'plan':plan,'job_id':str(job.id)}))
    await db.commit()
    return job_response(job)


class RemediationCreate(BaseModel):
    asset_id: uuid.UUID | None = None
    category: str = Field(min_length=1,max_length=40)
    title: str = Field(min_length=3,max_length=180)
    action: str = Field(min_length=5,max_length=5000)
    severity: Literal['Low','Medium','High','Critical']='Medium'
    assignee_id: uuid.UUID | None=None
    due_at: datetime | None=None

    @field_validator('due_at')
    @classmethod
    def aware_due(cls,value):
        if value and value.tzinfo is None: raise ValueError('Due date must include a timezone.')
        return value


class RemediationUpdate(BaseModel):
    state: Literal['Open','In Progress','Blocked','Ready for Review','Closed'] | None=None
    assignee_id: uuid.UUID | None=None
    due_at: datetime | None=None
    evidence: str | None=Field(default=None,max_length=10000)
    severity: Literal['Low','Medium','High','Critical'] | None=None

    _due = field_validator('due_at')(RemediationCreate.aware_due.__func__)


async def validate_assignee(db,uid):
    if uid and not await db.get(UserProfile,uid): raise HTTPException(422,'Assignee account not found.')


@router.post('/remediations',status_code=201)
async def create_remediation(body:RemediationCreate,db:AsyncSession=Depends(get_db),user=require_role('Aimplify.Admin','Aimplify.Owner')):
    asset=await db.get(CatalogAsset,body.asset_id) if body.asset_id else None
    if body.asset_id and not asset: raise HTTPException(404,'Asset not found.')
    await validate_assignee(db,body.assignee_id)
    item=RemediationItem(**body.model_dump(),asset_title=asset.title if asset else 'AImplify platform',fingerprint='manual:'+str(uuid.uuid4()),created_by=user.id)
    db.add(item);await db.flush()
    db.add(ActivityLog(actor_id=user.id,action='remediation_created',entity_type='remediation',entity_id=item.id))
    await db.commit();await db.refresh(item)
    return item_response(item)


@router.get('/remediations')
async def list_remediations(format:Literal['json','csv']='json',skip:int=Query(0,ge=0),limit:int=Query(100,ge=1,le=500),
                            db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    stmt=select(RemediationItem)
    if not privileged(user): stmt=stmt.where(RemediationItem.assignee_id==user.id)
    stmt=stmt.order_by(RemediationItem.created_at.desc(),RemediationItem.id)
    if format=='csv':
        items=(await db.execute(stmt)).scalars().all()
        out=io.StringIO(newline='');writer=csv.writer(out)
        writer.writerow(['ID','Asset','Category','Issue','Action','Severity','State','Assignee ID','Due UTC','Evidence','Reviewer ID','Reviewed UTC'])
        for i in items: writer.writerow([safe_cell(v) for v in (i.id,i.asset_title,i.category,i.title,i.action,i.severity,i.state,i.assignee_id,i.due_at,i.evidence,i.reviewer_id,i.reviewed_at)])
        return StreamingResponse(io.BytesIO(out.getvalue().encode('utf-8-sig')),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="AIMPLIFY_Remediations.csv"'})
    total=(await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    items=(await db.execute(stmt.offset(skip).limit(limit))).scalars().all()
    return {'items':[item_response(i) for i in items],'total':total}


@router.patch('/remediations/{item_id}')
async def update_remediation(item_id:uuid.UUID,body:RemediationUpdate,db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    item=(await db.execute(select(RemediationItem).where(RemediationItem.id==item_id).with_for_update())).scalars().first()
    if not item: raise HTTPException(404,'Remediation not found.')
    admin=privileged(user)
    if not admin and item.assignee_id!=user.id: raise HTTPException(403,'Only the assignee or governance team can update this item.')
    if item.state=='Closed' and not admin: raise HTTPException(403,'A closed item can only be reopened by governance.')
    changes=body.model_dump(exclude_unset=True)
    if not admin and set(changes)-{'state','evidence'}: raise HTTPException(403,'Assignment, severity and deadlines require governance access.')
    if 'state' in changes and changes['state'] is None: raise HTTPException(422,'State cannot be cleared.')
    if 'severity' in changes and changes['severity'] is None: raise HTTPException(422,'Severity cannot be cleared.')
    next_state=changes.get('state',item.state)
    evidence=changes.get('evidence',item.evidence)
    if next_state in ('Ready for Review','Closed') and not (evidence or '').strip(): raise HTTPException(422,'Provide resolution evidence before requesting review or closing.')
    if next_state=='Closed':
        if not admin or item.assignee_id==user.id or changes.get('assignee_id',item.assignee_id)==user.id: raise HTTPException(403,'Closure requires an independent admin/owner reviewer.')
        item.reviewer_id=user.id;item.reviewed_at=datetime.now(timezone.utc)
    elif 'state' in changes and next_state!=item.state:
        item.reviewer_id=None;item.reviewed_at=None
    if 'assignee_id' in changes: await validate_assignee(db,changes['assignee_id'])
    old=item.state
    for key,value in changes.items(): setattr(item,key,value)
    db.add(ActivityLog(actor_id=user.id,action='remediation_updated',entity_type='remediation',entity_id=item.id,
                       log_metadata={'old_state':old,'new_state':item.state,'changed_fields':list(changes)}))
    await db.commit();await db.refresh(item)
    return item_response(item)


@router.post('/remediations/from-audit',status_code=201)
async def seed_remediations(db:AsyncSession=Depends(get_db),user=require_role('Aimplify.Admin','Aimplify.Owner')):
    from app.services.asset_quality_service import build_quality_report
    rows=(await db.execute(select(CatalogAsset,UserProfile).outerjoin(UserProfile,CatalogAsset.owner_id==UserProfile.id))).all()
    users=(await db.execute(select(UserProfile))).scalars().all()
    by_email={u.email.strip().lower():u.id for u in users}
    report=await build_quality_report(rows)
    entities={str(a.id):a for a,_ in rows}
    created=0
    for asset in report['assets']:
        entity=entities[asset['id']]
        assignee=by_email.get((entity.owner_email or '').strip().lower(),entity.owner_id)
        candidates=[f for f in asset['findings'] if f['credit']==0 and f['criterion']!='Review traceability']
        if evaluation_health(entity)!='Complete':
            candidates.append({'area':'AI evaluation','criterion':'Missing or incomplete AI evaluation','action':'Queue evaluation, inspect agent results and reconcile catalog feedback.'})
        for f in candidates:
            fingerprint=hashlib.sha256((f['area']+':'+f['criterion']).encode()).hexdigest()
            stmt=insert(RemediationItem).values(id=uuid.uuid4(),asset_id=entity.id,asset_title=entity.title,
                fingerprint=fingerprint,category=f['area'],title=f['criterion'],action=f['action'],severity='Medium',state='Open',
                assignee_id=assignee,created_by=user.id,due_at=datetime.now(timezone.utc)+timedelta(days=14))
            result=await db.execute(stmt.on_conflict_do_nothing(constraint='uq_remediation_finding').returning(RemediationItem.id))
            if result.scalar_one_or_none(): created+=1
    db.add(ActivityLog(actor_id=user.id,action='remediations_generated',entity_type='catalog_asset',log_metadata={'created':created}))
    await db.commit()
    return {'created':created,'notice':'Existing and closed items were retained. Missing documentation is not a confirmed security defect.'}
