"""Shared lifecycle permissions and request-level protection for retired assets."""
import uuid
from urllib.parse import unquote, urlsplit
from fastapi import HTTPException
from sqlalchemy import or_, select
from app.db.models import CatalogAsset, Submission, ActivityLog

RETIRED = ('Deprecated','Decommissioned')


def value(status): return getattr(status,'value',status)


def privileged(user): return value(user.role) in ('Aimplify.Admin','Aimplify.Owner')


def label(asset):
    return {'id':str(asset.id),'title':asset.title,'status':value(asset.status),'restricted':True}


async def filter_live_catalog_results(results):
    catalog=[r for r in results if r.get('source_type')=='catalog_asset' or str(r.get('link','')).startswith('/catalog/')]
    if not catalog:return results
    from app.db.base import get_session_factory
    try:
        async with get_session_factory()() as db:
            rows=(await db.execute(select(CatalogAsset.id,CatalogAsset.slug).where(CatalogAsset.status=='Published'))).all()
        ids={str(r.id) for r in rows};slugs={r.slug for r in rows}
        def allowed(r):
            if r not in catalog:return True
            sid=r.get('source_id')
            if sid:return str(sid) in ids
            return str(r.get('link','')).removeprefix('/catalog/').split('?')[0] in slugs
        return [r for r in results if allowed(r)]
    except Exception:
        # Fail closed for catalog content when live status cannot be checked.
        return [r for r in results if r not in catalog]


async def related_sources(db,asset,lock=False):
    publications=(await db.execute(select(ActivityLog.entity_id).where(
        ActivityLog.action=='submission_published',ActivityLog.log_metadata['catalog_asset_id'].as_string()==str(asset.id)))).scalars().all()
    stmt=select(Submission).where(or_(Submission.catalog_code.in_([str(asset.id),asset.catalog_code]),
        Submission.id.in_(publications))).order_by(Submission.created_at.desc(),Submission.id.desc())
    if lock:stmt=stmt.with_for_update()
    return (await db.execute(stmt)).scalars().all()


async def assigned_asset_ids(db,assets,user_id):
    if not assets:return set()
    by_ref={ref:str(a.id) for a in assets for ref in (str(a.id),a.catalog_code)}
    events=(await db.execute(select(ActivityLog.entity_id,ActivityLog.log_metadata).where(
        ActivityLog.action=='submission_published',ActivityLog.log_metadata['catalog_asset_id'].as_string().in_([str(a.id) for a in assets])))).all()
    by_publication={e.entity_id:str((e.log_metadata or {}).get('catalog_asset_id')) for e in events}
    sources=(await db.execute(select(Submission.id,Submission.catalog_code,Submission.assigned_reviewer_id,Submission.created_at).where(
        or_(Submission.catalog_code.in_(list(by_ref)),Submission.id.in_(list(by_publication))))
        .order_by(Submission.created_at.desc(),Submission.id.desc()))).all()
    seen=set();assigned=set()
    for source in sources:
        aid=by_ref.get(source.catalog_code) or by_publication.get(source.id)
        if not aid or aid in seen:continue
        seen.add(aid)
        if source.assigned_reviewer_id==user_id:assigned.add(aid)
    return assigned


async def enforce_request_lifecycle(request,user,db):
    if request is None or privileged(user): return
    path=request.url.path.rstrip('/')
    if path.startswith('/asset-lifecycle'): return  # explicit per-action permission checks
    segments=path.strip('/').split('/')
    target=None
    if len(segments)>=2 and segments[0]=='catalog':
        try:condition=CatalogAsset.id==uuid.UUID(segments[1])
        except ValueError:condition=CatalogAsset.slug==segments[1]
        if segments[1] not in ('families','search'):
            target=(await db.execute(select(CatalogAsset).where(condition))).scalars().first()
        if target and value(target.status) in RETIRED and len(segments)==2 and request.method=='GET':
            return  # catalog detail returns an explicit minimal label
    elif len(segments)>=2 and segments[0]=='submissions':
        if segments[1]=='for-catalog' and len(segments)>2:
            try:target=(await db.execute(select(CatalogAsset).where(CatalogAsset.id==uuid.UUID(segments[2])))).scalars().first()
            except ValueError:return
        else:
            try:sid=uuid.UUID(segments[1])
            except ValueError:return
            source=(await db.execute(select(Submission).where(Submission.id==sid))).scalars().first()
            if source and value(source.status) in RETIRED:
                raise HTTPException(403,'Only Admins and platform Owners can access retired asset details.')
            if source and source.catalog_code:
                refs=[CatalogAsset.catalog_code==source.catalog_code]
                try:refs.append(CatalogAsset.id==uuid.UUID(source.catalog_code))
                except ValueError:pass
                target=(await db.execute(select(CatalogAsset).where(or_(*refs)))).scalars().first()
    elif len(segments)>=2 and segments[0] in ('clone-requests','demo-requests'):
        from app.db.models import CloneRequest, DemoRequest
        try:rid=uuid.UUID(segments[1])
        except ValueError:return
        model=CloneRequest if segments[0]=='clone-requests' else DemoRequest
        record=(await db.execute(select(model).where(model.id==rid))).scalars().first()
        if record and record.asset_id:
            target=(await db.execute(select(CatalogAsset).where(CatalogAsset.id==record.asset_id))).scalars().first()
    elif segments[0]=='media':
        # Legacy drafts need association checks as well as UUID-based paths.
        requested=request.query_params.get('blob_path') or request.query_params.get('entity_id') or '/'.join(segments[1:])
        requested=unquote(requested).removeprefix('artifacts/').lstrip('/')
        if requested and requested not in ('upload','upload-url'):
            from app.services.asset_quality_service import references
            retired=(await db.execute(select(CatalogAsset).where(CatalogAsset.status.in_(RETIRED)))).scalars().all()
            for asset in retired:
                if requested==str(asset.id):target=asset;break
                for ref in references(asset):
                    stored=unquote(urlsplit(ref['_url']).path).lstrip('/').removeprefix('artifacts/')
                    if stored==requested or (path.startswith('/media/local/') and stored.endswith(requested)):
                        target=asset;break
                if target:break
    if target and value(target.status) in RETIRED:
        raise HTTPException(403,'Only Admins and platform Owners can access retired asset details and files.')
