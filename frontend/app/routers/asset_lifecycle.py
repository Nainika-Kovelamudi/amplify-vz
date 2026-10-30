import uuid
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.db.models import ActivityLog, AssetStatus, CatalogAsset, SubmissionStatus
from app.deps.rbac import get_current_user
from app.services.asset_lifecycle import RETIRED, privileged, related_sources, value

router=APIRouter(prefix='/asset-lifecycle',tags=['Asset lifecycle'])


class LifecycleChange(BaseModel):
    model_config=ConfigDict(extra='forbid')
    status: Literal['Published','Deprecated','Decommissioned']
    expected_status: Literal['Published','Deprecated','Decommissioned']
    reason: str=Field(min_length=5,max_length=2000)

    @field_validator('reason')
    @classmethod
    def meaningful(cls,v):
        if len(v.strip())<5:raise ValueError('Provide a reason of at least five characters.')
        return v.strip()


@router.get('')
async def lifecycle_inventory(status:Literal['Active','Deprecated','Decommissioned','All']='Active',
    search:str=Query('',max_length=200),db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    statuses=['Published',*RETIRED] if status=='All' else ['Published' if status=='Active' else status]
    if not privileged(user):statuses=[s for s in statuses if s!='Decommissioned']
    rows=(await db.execute(select(CatalogAsset).where(CatalogAsset.status.in_(statuses),CatalogAsset.title.ilike('%'+search+'%'))
                          .order_by(CatalogAsset.title))).scalars().all()
    result=[]
    for asset in rows:
        can_change=privileged(user)
        item={'id':str(asset.id),'title':asset.title,'status':value(asset.status),
            'restricted':value(asset.status) in RETIRED and not privileged(user),
            'can_change':can_change,'can_restore':privileged(user)}
        if value(asset.status)=='Deprecated':
            # Explicit public card projection; no files, repositories, people,
            # evaluation feedback, comments or lifecycle reasons are included.
            item['preview']={key:getattr(asset,key,None) for key in (
                'catalog_code','slug','description','family','department','cloud_provider','maturity','demo_ready','like_count')}
            item['preview']['maturity']=value(item['preview']['maturity'])
        result.append(item)
    return {'items':result,'total':len(result)}


@router.patch('/{asset_id}')
async def change_lifecycle(asset_id:uuid.UUID,body:LifecycleChange,background_tasks:BackgroundTasks,
    db:AsyncSession=Depends(get_db),user=Depends(get_current_user)):
    asset=(await db.execute(select(CatalogAsset).where(CatalogAsset.id==asset_id).with_for_update())).scalars().first()
    if not asset:raise HTTPException(404,'Asset not found.')
    admin=privileged(user)
    if not admin:raise HTTPException(403,'Only Admins and platform Owners can change lifecycle status.')
    sources=await related_sources(db,asset,lock=True)
    if body.status=='Published' and not admin:raise HTTPException(403,'Only Admins and platform Owners can restore an asset.')
    old=value(asset.status)
    if old not in ('Published',*RETIRED):raise HTTPException(409,'Only published or retired assets can use this lifecycle action.')
    if old!=body.expected_status:raise HTTPException(409,'Asset status changed. Refresh and review again.')
    if old==body.status:raise HTTPException(409,'The asset already has this status.')
    prior=(await db.execute(select(ActivityLog).where(ActivityLog.action=='asset_lifecycle_changed',ActivityLog.entity_id==asset.id)
                           .order_by(ActivityLog.created_at.desc(),ActivityLog.id.desc()).limit(1))).scalars().first()
    original=(prior.log_metadata or {}).get('original_source_statuses',{}) if prior and old in RETIRED else {str(s.id):value(s.status) for s in sources}
    now=datetime.now(timezone.utc)
    asset.status=AssetStatus(body.status);asset.updated_at=now
    for source in sources:
        source.status=SubmissionStatus(original.get(str(source.id),'Submitted') if body.status=='Published' else body.status)
        source.updated_at=now
    from app.db.operations_models import EvaluationJob
    await db.execute(update(EvaluationJob).where(EvaluationJob.state.in_(['Queued','Running']),or_(
        (EvaluationJob.entity_type.in_(['catalog_asset','artifact_migration'])) & (EvaluationJob.entity_id==asset.id),
        (EvaluationJob.entity_type=='submission') & EvaluationJob.entity_id.in_([s.id for s in sources])))
        .values(state='Failed',error='Asset lifecycle changed. Review before retrying.',lease_token=None,lease_until=None,updated_at=now))
    db.add(ActivityLog(actor_id=user.id,action='asset_lifecycle_changed',entity_type='catalog_asset',entity_id=asset.id,
        log_metadata={'previous_status':old,'status':body.status,'reason':body.reason,'original_source_statuses':original}))
    await db.commit()
    from app.services.executive_report_data import clear_report_cache
    clear_report_cache()
    from app.services.knowledge.ingestion_service import reindex_catalog_asset_by_id
    background_tasks.add_task(reindex_catalog_asset_by_id,str(asset.id))
    return {'id':str(asset.id),'title':asset.title,'status':body.status}
