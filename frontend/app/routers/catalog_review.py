"""Public-to-authorized-viewers review provenance, without private review notes."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.db.models import ActivityLog, CatalogAsset, Submission, UserProfile
from app.deps.rbac import get_current_user

router = APIRouter()


@router.get('/catalog/{asset_id}/review-history')
async def catalog_review_history(asset_id: uuid.UUID, db: AsyncSession=Depends(get_db), user=Depends(get_current_user)):
    asset=(await db.execute(select(CatalogAsset).where(CatalogAsset.id==asset_id))).scalars().first()
    if not asset: raise HTTPException(404,'Asset not found.')
    role=getattr(user.role,'value',user.role)
    status=getattr(asset.status,'value',asset.status)
    if status!='Published' and role not in ('Aimplify.Admin','Aimplify.Owner') and asset.owner_id!=user.id:
        raise HTTPException(404,'Asset not found.')
    sources=(await db.execute(select(Submission).where(
        Submission.catalog_code.in_([str(asset.id),asset.catalog_code])))).scalars().all()
    by_id={s.id:s for s in sources}
    publications=(await db.execute(select(ActivityLog).where(
        or_(
            (ActivityLog.action=='submission_published') & or_(ActivityLog.entity_id.in_(list(by_id)),
                ActivityLog.log_metadata['catalog_asset_id'].as_string()==str(asset.id)),
            (ActivityLog.action=='asset_published') & (ActivityLog.entity_id==asset.id)
        )).order_by(ActivityLog.created_at.desc(),ActivityLog.id.desc()).limit(1))).scalars().all()
    publication=publications[0] if publications else None
    source=by_id.get(publication.entity_id) if publication else None
    if publication and publication.action=='submission_published' and not source:
        source=(await db.execute(select(Submission).where(Submission.id==publication.entity_id))).scalars().first()
    if not publication:
        published=[s for s in sources if getattr(s.status,'value',s.status)=='Published']
        source=max(published,key=lambda s:(s.reviewed_at.isoformat() if s.reviewed_at else '',str(s.id)),default=None)
    approval=None
    if source:
        conditions=[ActivityLog.action=='submission_approved',ActivityLog.entity_id==source.id]
        if publication: conditions.append(ActivityLog.created_at<=publication.created_at)
        approval=(await db.execute(select(ActivityLog).where(*conditions)
            .order_by(ActivityLog.created_at.desc(),ActivityLog.id.desc()).limit(1))).scalars().first()
    # A hold/rejection can overwrite reviewed_by. Use it only on a published
    # source, with an actual timestamp and no later than the publication event.
    fallback=bool(not approval and source and getattr(source.status,'value',source.status)=='Published'
        and source.reviewed_by and source.reviewed_at and (not publication or source.reviewed_at<=publication.created_at))
    l1_id=approval.actor_id if approval else (source.reviewed_by if fallback else None)
    l1_at=approval.created_at if approval else (source.reviewed_at if fallback else None)
    l2_id=publication.actor_id if publication else None
    ids=[uid for uid in (l1_id,l2_id) if uid]
    profiles=(await db.execute(select(UserProfile).where(UserProfile.id.in_(ids)))).scalars().all() if ids else []
    by_profile={p.id:p for p in profiles}
    def person(uid,at):
        p=by_profile.get(uid)
        return {'name':p.display_name or p.email if p else ('Former user' if uid else None),'at':at}
    return {'asset_id':str(asset.id),'l1':person(l1_id,l1_at),'l2':person(l2_id,publication.created_at if publication else None)}
