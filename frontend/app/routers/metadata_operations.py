"""Explicitly reviewed corrections for legacy catalog metadata."""
import hashlib
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.db.models import ActivityLog, CatalogAsset, UserProfile
from app.deps.rbac import require_role
from app.schemas.metadata_rules import MetadataRules, cloud_values, corporate_repo, validate_patch_pair
from app.services.family_assignment import change_family

router = APIRouter()
FIELDS = ('title','description','family','cloud_provider','owner_name','owner_email',
          'manager_name','manager_email','department','designation','category','tech_stack','repo_url','maturity')


def snapshot(asset):
    values = {key: getattr(asset, key, None) for key in FIELDS}
    values['owner_id'] = str(asset.owner_id) if asset.owner_id else None
    return values


def fingerprint(asset):
    return hashlib.sha256(json.dumps(snapshot(asset),sort_keys=True,default=str).encode()).hexdigest()


def metadata_row(asset, profile=None, review=None):
    values = snapshot(asset)
    try:
        suggested = cloud_values(asset.cloud_provider)
        cloud_error = None
    except ValueError:
        suggested = None
        cloud_error = 'Contains unrecognized cloud tags. Confirm supported platforms before replacing.'
    missing = [key for key in FIELDS if key != 'cloud_provider' and not values[key]]
    if not values['cloud_provider']: missing.append('cloud_provider')
    owner = {'id':str(profile.id),'name':profile.display_name or profile.email,'email':profile.email} if profile else None
    mismatch = bool(owner and values['owner_email'] and values['owner_email'].strip().casefold()!=owner['email'].strip().casefold())
    try: repo_valid = bool(asset.repo_url and corporate_repo(asset.repo_url))
    except ValueError: repo_valid = False
    return {'id':str(asset.id),'catalog_code':asset.catalog_code,'slug':asset.slug,
            'status':getattr(asset.status,'value',asset.status),'values':values,'fingerprint':fingerprint(asset),
            'suggested_cloud':suggested,'cloud_error':cloud_error,'missing_fields':missing,
            'linked_owner':owner,'owner_mismatch':mismatch,'repository_valid':repo_valid,
            'last_review':review}


class MetadataCorrection(MetadataRules):
    model_config = ConfigDict(extra='forbid')
    title: str | None = None
    description: str | None = None
    family: str | None = None
    cloud_provider: str | None = None
    owner_id: uuid.UUID | None = None
    manager_name: str | None = None
    manager_email: str | None = None
    department: str | None = None
    designation: str | None = None
    category: str | None = None
    tech_stack: list[str] | None = None
    repo_url: str | None = None
    maturity: str | None = None


class MetadataReview(MetadataRules):
    model_config = ConfigDict(extra='forbid')
    fingerprint: str = Field(min_length=64,max_length=64)
    confirmed: bool
    changes: MetadataCorrection


@router.get('/metadata')
async def metadata_inventory(db: AsyncSession=Depends(get_db),user=require_role('Aimplify.Admin','Aimplify.Owner')):
    assets=(await db.execute(select(CatalogAsset).order_by(CatalogAsset.title))).scalars().all()
    profiles=(await db.execute(select(UserProfile))).scalars().all()
    by_id={p.id:p for p in profiles}
    by_asset={a.id:a for a in assets}
    logs=(await db.execute(select(ActivityLog).where(ActivityLog.action=='asset_metadata_reviewed')
                          .order_by(ActivityLog.created_at.desc()))).scalars().all()
    reviews={}
    for log in logs:
        if log.entity_id not in reviews and log.entity_id in by_asset:
            actor=by_id.get(log.actor_id)
            reviews[log.entity_id]={'reviewer':actor.display_name or actor.email if actor else str(log.actor_id),
                                    'reviewed_at':log.created_at,
                                    'current':(log.log_metadata or {}).get('result_fingerprint')==fingerprint(by_asset[log.entity_id])}
    return {'assets':[metadata_row(a,by_id.get(a.owner_id),reviews.get(a.id)) for a in assets]}


@router.patch('/assets/{asset_id}/metadata')
async def save_metadata_review(asset_id: uuid.UUID, body: MetadataReview, background_tasks: BackgroundTasks,
                              db: AsyncSession=Depends(get_db),user=require_role('Aimplify.Admin','Aimplify.Owner')):
    if not body.confirmed: raise HTTPException(422,'Confirm that the proposed metadata has been reviewed.')
    asset=(await db.execute(select(CatalogAsset).where(CatalogAsset.id==asset_id).with_for_update())).scalars().first()
    if not asset: raise HTTPException(404,'Asset not found.')
    if fingerprint(asset)!=body.fingerprint: raise HTTPException(409,'Metadata changed since you opened it. Refresh and review again.')
    changes=body.changes.model_dump(exclude_unset=True)
    if 'owner_id' in changes:
        if not changes['owner_id']: raise HTTPException(422,'Select a valid owner account.')
        profile=(await db.execute(select(UserProfile).where(UserProfile.id==changes['owner_id']).with_for_update())).scalars().first()
        if not profile: raise HTTPException(422,'Selected owner account no longer exists.')
        changes.update(owner_name=profile.display_name or profile.email,owner_email=profile.email.lower())
    validate_patch_pair(asset,changes)
    before=snapshot(asset)
    if 'family' in changes:
        await change_family(db,asset.id,changes.pop('family'),user.id,catalog=True)
    for key,value in changes.items(): setattr(asset,key,value)
    after=snapshot(asset)
    changed={key:{'before':before[key],'after':after[key]} for key in before if before[key]!=after[key]}
    if changed: asset.updated_at=datetime.now(timezone.utc)
    db.add(ActivityLog(actor_id=user.id,action='asset_metadata_reviewed',entity_type='catalog_asset',entity_id=asset.id,
        log_metadata={'changes':changed,'result_fingerprint':fingerprint(asset),'confirmed':True}))
    await db.commit()
    if changed:
        from app.services.knowledge.ingestion_service import reindex_catalog_asset_by_id
        background_tasks.add_task(reindex_catalog_asset_by_id,str(asset.id))
    return {'id':str(asset.id),'changed_fields':list(changed),'notice':'Metadata saved and review recorded. Remaining gaps are still shown.'}
