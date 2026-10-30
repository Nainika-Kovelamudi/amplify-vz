from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, CatalogAsset, Submission, SubmissionStatus, UserProfile, UserRole
from app.deps.rbac import get_current_user, require_role
from app.schemas.submission import (
    SubmissionCreate,
    SubmissionListResponse,
    SubmissionResponse,
    SubmissionUpdate,
)
from app.services.blob_service import refresh_sas_url
from app.services.catalog_code_service import next_catalog_code

from app.services.family_assignment import FamilyUpdate, change_family
from uuid import UUID

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/submissions", tags=["Submissions"])


def _to_response(s: Submission, catalog_asset_id: str | None = None) -> SubmissionResponse:
    if getattr(s.status, 'value', s.status) in ('Deprecated','Decommissioned'):
        return SubmissionResponse(id=s.id, title=s.title, status=getattr(s.status,'value',s.status),
            restricted=True, description='', family='', department='', maturity='', demo_ready=False,
            created_at=datetime(1970,1,1,tzinfo=timezone.utc))
    return SubmissionResponse(
        id=s.id,
        catalog_asset_id=catalog_asset_id or s.catalog_code,
        title=s.title,
        description=s.description,
        family=s.family,
        department=s.department,
        tech_stack=s.tech_stack or [],
        cloud_provider=s.cloud_provider,
        maturity=s.maturity,
        demo_ready=s.demo_ready,
        repo_url=s.repo_url,
        video_url=refresh_sas_url(s.video_url),
        video_urls=[refresh_sas_url(u) for u in dict.fromkeys(s.video_urls or ([s.video_url] if s.video_url else [])) if u],
        demo_url=s.demo_url,
        status=s.status.value if hasattr(s.status, "value") else s.status,
        ai_score=s.ai_score,
        ai_feedback=s.ai_feedback,
        admin_notes=s.admin_notes,
        submitter_id=s.submitter_id,
        created_at=s.created_at,
        updated_at=s.updated_at,
        reviewed_by=s.reviewed_by,
        reviewed_at=s.reviewed_at,
        assigned_reviewer_id=s.assigned_reviewer_id,
        assigned_at=s.assigned_at,
        # Section 1 — submitter info
        owner_name=s.owner_name,
        owner_email=s.owner_email,
        manager_name=s.manager_name,
        manager_email=s.manager_email,
        designation=s.designation,
        category=s.category,
        architecture_file_url=s.architecture_file_url,
        collaborators=s.collaborators,
        dependencies=s.dependencies,
        commands=s.commands,
        aiv_ideation_id=s.aiv_ideation_id,
        aiv_ideation_title=s.aiv_ideation_title,
    )


async def _with_review_details(db: AsyncSession, sub: Submission) -> SubmissionResponse:
    response = _to_response(sub)
    if response.restricted: return response
    profile_ids = [profile_id for profile_id in (sub.submitter_id, sub.reviewed_by, sub.assigned_reviewer_id) if profile_id]
    profiles = (await db.execute(select(UserProfile).where(UserProfile.id.in_(profile_ids)))).scalars().all() if profile_ids else []
    by_id = {profile.id: profile for profile in profiles}
    reviewer = by_id.get(sub.reviewed_by)
    assigned = by_id.get(sub.assigned_reviewer_id)
    submitter = by_id.get(sub.submitter_id)
    if submitter:
        response.owner_name = response.owner_name or submitter.display_name
        response.owner_email = response.owner_email or submitter.email
    if reviewer:
        response.reviewed_by_name = reviewer.display_name
        response.reviewed_by_email = reviewer.email
    if assigned:
        response.assigned_reviewer_name = assigned.display_name
        response.assigned_reviewer_email = assigned.email
    publication = (await db.execute(
        select(ActivityLog).where(
            ActivityLog.action == "submission_published",
            ActivityLog.entity_id == sub.id,
        ).order_by(ActivityLog.created_at.desc()).limit(1)
    )).scalars().first()
    if publication:
        response.published_by = publication.actor_id
        response.published_at = publication.created_at
        if publication.actor_id:
            publisher = (await db.execute(select(UserProfile).where(UserProfile.id == publication.actor_id))).scalars().first()
            if publisher:
                response.published_by_name = publisher.display_name
                response.published_by_email = publisher.email
    return response


@router.post("", response_model=SubmissionResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_submission(
    body: SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    from app.services.email_service import send_submission_received_email, send_submission_admin_notification_email
    from app.services.orchestrator import run_scoring_pipeline
    from app.services.aiv_ideation_service import require_approved_ideation

    ideation_id = body.aiv_ideation_id.strip() if body.aiv_ideation_id else ""
    ideation: dict | None = None
    if body.catalog_asset_id:
        existing_asset = (await db.execute(
            select(CatalogAsset).where(CatalogAsset.id == body.catalog_asset_id)
        )).scalars().first()
        if not existing_asset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The asset being edited was not found.")
        if existing_asset.aiv_ideation_id:
            ideation = {
                "id": existing_asset.aiv_ideation_id,
                "title": existing_asset.aiv_ideation_title,
            }
        elif ideation_id:
            ideation = await require_approved_ideation(ideation_id)
    elif ideation_id:
        ideation = await require_approved_ideation(ideation_id)
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="AIV Ideation is required for a new asset.")

    submission = Submission(
        title=body.title,
        description=body.description,
        family=body.family,
        department=body.department,
        tech_stack=body.tech_stack,
        cloud_provider=body.cloud_provider,
        maturity=body.maturity,
        demo_ready=body.demo_ready,
        video_url=body.video_url,
        video_urls=list(dict.fromkeys(body.video_urls or ([body.video_url] if body.video_url else []))),
        demo_url=getattr(body, 'demo_url', None),
        repo_url=body.repo_url,
        owner_name=body.owner_name,
        owner_email=body.owner_email,
        manager_name=body.manager_name,
        manager_email=body.manager_email,
        designation=body.designation,
        category=body.category,
        architecture_file_url=body.architecture_file_url,
        collaborators=body.collaborators or [],
        dependencies=body.dependencies,
        commands=body.commands or [],
        catalog_code=body.catalog_asset_id,
        aiv_ideation_id=ideation["id"] if ideation else None,
        aiv_ideation_title=ideation["title"] if ideation else None,
        status=SubmissionStatus.Submitted,
        submitter_id=user.id,
    )
    db.add(submission)
    db.add(ActivityLog(
        actor_id=user.id,
        action="submission_created",
        entity_type="submission",
    ))
    await db.flush()
    await db.refresh(submission)

    # Bell notification for the L1 review audience.
    from app.services.notification_service import push_notifications_to_roles
    await push_notifications_to_roles(
        db,
        [UserRole.admin, UserRole.owner],
        "New Asset Submission",
        f'"{submission.title}" was submitted by {user.display_name or user.email} and is entering AI evaluation.',
        "submission_created",
        str(submission.id),
        exclude_user_id=str(user.id),
    )

    submission_data = {
        "id": str(submission.id),
        "title": submission.title,
        "description": submission.description,
        "family": submission.family,
        "department": submission.department,
        "tech_stack": submission.tech_stack,
        "video_url": submission.video_url,
        "repo_url": submission.repo_url,
        "submitter_role": user.role.value if hasattr(user.role, "value") else user.role,
        "submitter_email": user.email,
        "entity": "submission",
    }
    from app.services.evaluation_jobs import enqueue_evaluation
    await enqueue_evaluation(db, submission.id, "submission", user.id)
    await db.commit()

    # Email requestor: submission received
    submitter_name = getattr(user, 'display_name', None) or user.email
    try:
        await send_submission_received_email(
            submitter_email=user.email,
            submitter_name=submitter_name,
            asset_title=submission.title,
        )
    except Exception as exc:
        logger.warning("Failed to send submission received email: %s", exc)

    # Email all admins/owners: new submission requires L1 approval
    try:
        notif_result = await db.execute(
            select(UserProfile.email).where(
                UserProfile.role.in_([UserRole.admin, UserRole.owner]),
                UserProfile.email.isnot(None),
                UserProfile.email != "",
            )
        )
        admin_emails = [r[0] for r in notif_result.fetchall() if r[0] and r[0] != user.email]
        logger.info("Submission admin notification — found %d recipient(s): %s", len(admin_emails), admin_emails)
        if admin_emails:
            await send_submission_admin_notification_email(
                admin_emails=admin_emails,
                submitter_name=submitter_name,
                submitter_email=user.email,
                asset_title=submission.title,
                description=submission.description or "",
            )
    except Exception as exc:
        logger.warning("Failed to send submission admin notification: %s", exc)

    return _to_response(submission)


@router.get("/for-catalog/{catalog_asset_id}", response_model=SubmissionResponse)
async def get_submission_for_catalog_asset(
    catalog_asset_id: str,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    """Return the original submission that was published as the given catalog asset."""
    result = await db.execute(
        select(ActivityLog)
        .where(
            ActivityLog.action == "submission_published",
            ActivityLog.actor_id == user.id,
        )
        .order_by(ActivityLog.created_at.desc())
    )
    logs = result.scalars().all()

    submission_id = None
    for log in logs:
        meta = log.log_metadata or {}
        if str(meta.get("catalog_asset_id", "")) == catalog_asset_id:
            submission_id = log.entity_id
            break

    if not submission_id:
        from app.db.models import CatalogAsset
        asset_result = await db.execute(
            select(CatalogAsset).where(CatalogAsset.id == catalog_asset_id)
        )
        asset = asset_result.scalars().first()
        if asset:
            sub_result = await db.execute(
                select(Submission)
                .where(
                    Submission.submitter_id == user.id,
                    Submission.title == asset.title,
                    Submission.status == SubmissionStatus.Published,
                )
                .order_by(Submission.created_at.desc())
            )
            sub = sub_result.scalars().first()
            if sub:
                return await _with_review_details(db, sub)

        raise HTTPException(status_code=404, detail="Original submission not found.")

    sub_result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = sub_result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission record not found.")

    return await _with_review_details(db, sub)


async def _latest_asset_submissions(db: AsyncSession, submitter_id=None) -> list[SubmissionResponse]:
    """Show the newest submission for each asset while retaining older rows for audit."""
    stmt = select(Submission)
    if submitter_id is not None:
        stmt = stmt.where(Submission.submitter_id == submitter_id)
    submissions = (await db.execute(
        stmt.order_by(Submission.created_at.desc(), Submission.id.desc())
    )).scalars().all()

    publication_logs = (await db.execute(
        select(ActivityLog).where(ActivityLog.action == "submission_published")
    )).scalars().all()
    published_asset_by_submission = {
        str(log.entity_id): str((log.log_metadata or {}).get("catalog_asset_id"))
        for log in publication_logs
        if log.entity_id and (log.log_metadata or {}).get("catalog_asset_id")
    }
    assets = (await db.execute(select(CatalogAsset))).scalars().all()
    asset_by_code = {asset.catalog_code: str(asset.id) for asset in assets if asset.catalog_code}
    asset_by_identity = {
        ((asset.title or "").strip().casefold(), str(asset.owner_id)): str(asset.id)
        for asset in assets
    }
    asset_by_ideation = {
        (str(asset.aiv_ideation_id), str(asset.owner_id)): str(asset.id)
        for asset in assets if asset.aiv_ideation_id
    }

    seen: set[str] = set()
    latest: list[SubmissionResponse] = []
    for submission in submissions:
        code = str(submission.catalog_code) if submission.catalog_code else None
        asset_id = (
            asset_by_code.get(code)
            or code
            or published_asset_by_submission.get(str(submission.id))
            or asset_by_ideation.get((str(submission.aiv_ideation_id), str(submission.submitter_id)))
            or asset_by_identity.get(((submission.title or "").strip().casefold(), str(submission.submitter_id)))
        )
        key = (
            f"asset:{asset_id}" if asset_id else
            f"ideation:{submission.submitter_id}:{submission.aiv_ideation_id}" if submission.aiv_ideation_id else
            f"title:{submission.submitter_id}:{(submission.title or '').strip().casefold()}"
        )
        if key in seen:
            continue
        seen.add(key)
        latest.append(_to_response(submission, asset_id))
    return latest


@router.get("/mine", response_model=SubmissionListResponse)
async def get_my_submissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionListResponse:
    latest = await _latest_asset_submissions(db, user.id)
    return SubmissionListResponse(items=latest[skip:skip + limit], total=len(latest))


@router.get("/all", response_model=SubmissionListResponse)
async def get_all_submissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
) -> SubmissionListResponse:
    """Owner (super_admin) sees every submission across all users."""
    latest = await _latest_asset_submissions(db)
    if status_filter:
        try:
            latest = [item for item in latest if item.status == SubmissionStatus[status_filter].value]
        except KeyError:
            pass
    return SubmissionListResponse(items=latest[skip:skip + limit], total=len(latest))


@router.get("/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    role_val = user.role.value if hasattr(user.role, "value") else user.role

    if role_val == "guest" and str(sub.submitter_id) != str(user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return await _with_review_details(db, sub)


@router.get("/{submission_id}/versions", response_model=list[SubmissionResponse])
async def get_submission_versions(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> list[SubmissionResponse]:
    """Return all recorded submissions for the same catalog asset, oldest first."""
    base = (await db.execute(select(Submission).where(Submission.id == submission_id))).scalars().first()
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    role = user.role.value if hasattr(user.role, "value") else user.role
    if role not in ("Aimplify.Admin", "Aimplify.Owner") and base.submitter_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    logs = (await db.execute(select(ActivityLog).where(
        ActivityLog.action == "submission_published",
        ActivityLog.entity_id == base.id,
    ))).scalars().all()
    asset_id = next((str(log.log_metadata.get("catalog_asset_id")) for log in logs
                     if log.log_metadata and log.log_metadata.get("catalog_asset_id")), None) or base.catalog_code
    if asset_id:
        asset = (await db.execute(select(CatalogAsset).where(CatalogAsset.catalog_code == asset_id))).scalars().first()
        if asset:
            asset_id = str(asset.id)

    if not asset_id:
        return [_to_response(base)]

    publication_logs = (await db.execute(select(ActivityLog).where(
        ActivityLog.action == "submission_published",
    ))).scalars().all()
    published_ids = [log.entity_id for log in publication_logs
                     if log.entity_id and str((log.log_metadata or {}).get("catalog_asset_id")) == asset_id]
    version_query = select(Submission).where(or_(Submission.catalog_code == asset_id, Submission.id.in_(published_ids)))
    if role not in ("Aimplify.Admin", "Aimplify.Owner"):
        version_query = version_query.where(Submission.submitter_id == user.id)
    versions = (await db.execute(version_query.order_by(Submission.created_at.asc(), Submission.id.asc()))).scalars().all()
    if all(version.id != base.id for version in versions):
        versions.append(base)
        versions.sort(key=lambda version: (version.created_at, str(version.id)))
    return [_to_response(version, asset_id) for version in versions]


@router.patch("/{submission_id}", response_model=SubmissionResponse)
async def update_submission(
    submission_id: str,
    body: SubmissionUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    from app.services.orchestrator import run_scoring_pipeline

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    if str(sub.submitter_id) != str(user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own submissions.")

    allowed_statuses = {SubmissionStatus.Needs_Changes, SubmissionStatus.Submitted, SubmissionStatus.Archived}
    if sub.status not in allowed_statuses:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot edit submission with status '{sub.status}'.")

    update_data = body.model_dump(exclude_unset=True)
    from app.schemas.metadata_rules import validate_patch_pair
    validate_patch_pair(sub, update_data)
    ideation_id = update_data.pop("aiv_ideation_id", None) or sub.aiv_ideation_id
    from app.services.aiv_ideation_service import require_approved_ideation
    if ideation_id:
        ideation = await require_approved_ideation(ideation_id)
        sub.aiv_ideation_id = ideation["id"]
        sub.aiv_ideation_title = ideation["title"]
    if "video_urls" in update_data:
        update_data["video_urls"] = list(dict.fromkeys(update_data["video_urls"] or []))
        update_data["video_url"] = update_data["video_urls"][0] if update_data["video_urls"] else None
    for field, value in update_data.items():
        setattr(sub, field, value)

    sub.status = SubmissionStatus.Submitted
    sub.ai_score = None
    sub.ai_feedback = None
    sub.updated_at = datetime.now(tz=timezone.utc)

    db.add(ActivityLog(actor_id=user.id, action="submission_revised", entity_type="submission", entity_id=sub.id))

    submission_data = {
        "id": str(sub.id), "title": sub.title, "description": sub.description,
        "family": sub.family, "department": sub.department, "tech_stack": sub.tech_stack,
        "video_url": sub.video_url, "repo_url": sub.repo_url,
        "submitter_role": user.role.value if hasattr(user.role, "value") else user.role,
        "submitter_email": user.email, "entity": "submission",
    }
    from app.services.evaluation_jobs import enqueue_evaluation
    await enqueue_evaluation(db, sub.id, "submission", user.id)
    await db.commit()
    return _to_response(sub)


@router.post("/{submission_id}/rescore", response_model=SubmissionResponse)
async def rescore_submission(
    submission_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    """Admin/Owner: recover missing, failed, incomplete or stale AI evaluation."""
    from app.services.orchestrator import run_scoring_pipeline

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    from app.services.evaluation_jobs import enqueue_evaluation
    job = await enqueue_evaluation(db, sub.id, 'submission', user.id)
    db.add(ActivityLog(actor_id=user.id, action='ai_scoring_retried', entity_type='submission',
                       entity_id=sub.id, log_metadata={'job_id': str(job.id)}))
    await db.commit()

    logger.info("Admin %s triggered rescore for submission %s", user.email, submission_id)
    return _to_response(sub)


@router.post("/{submission_id}/publish", response_model=SubmissionResponse)
async def publish_submission(
    submission_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
) -> SubmissionResponse:
    """Owner publishes their approved submission to the catalog."""
    import re
    import uuid as _uuid
    from app.db.models import AssetMaturity, AssetStatus, CatalogAsset
    from app.services.email_service import send_l2_published_requestor_email, send_l2_published_admin_notification_email
    from app.config import get_settings

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    role_val = user.role.value if hasattr(user.role, "value") else user.role
    if role_val != "Aimplify.Owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the Owner can publish submissions.")

    if sub.status != SubmissionStatus.Approved:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot publish — submission status is '{sub.status.value}'. Must be 'Approved'.",
        )

    def _slug(t: str) -> str:
        s = re.sub(r"[^\w\s-]", "", t.lower())
        return re.sub(r"[\s_-]+", "-", s).strip("-")

    slug = _slug(sub.title)
    existing = (await db.execute(
        select(CatalogAsset).where(CatalogAsset.slug == slug)
    )).scalars().first()
    if existing:
        slug = f"{slug}-{_uuid.uuid4().hex[:4]}"

    def _coerce_maturity(val) -> AssetMaturity:
        if isinstance(val, AssetMaturity):
            return val
        if val:
            _map = {
                'prototype': AssetMaturity.Experimental,
                'experimental': AssetMaturity.Experimental,
                'beta': AssetMaturity.BattleTested,
                'battle-tested': AssetMaturity.BattleTested,
                'battletested': AssetMaturity.BattleTested,
                'beta phase': AssetMaturity.BattleTested,
                'validated': AssetMaturity.Production,
                'production': AssetMaturity.Production,
            }
            normalised = _map.get(val.lower().strip())
            if normalised:
                return normalised
            try:
                return AssetMaturity(val)
            except ValueError:
                pass
        return AssetMaturity.Experimental

    existing_asset = None
    if sub.catalog_code:
        try:
            asset_uuid = _uuid.UUID(sub.catalog_code)
            existing_asset_result = await db.execute(
                select(CatalogAsset).where(CatalogAsset.id == asset_uuid)
            )
            existing_asset = existing_asset_result.scalars().first()
        except (ValueError, AttributeError):
            pass

    if existing_asset:
        existing_asset.title = sub.title
        existing_asset.description = sub.description or ""
        existing_asset.family = sub.family
        existing_asset.department = sub.department
        existing_asset.tech_stack = sub.tech_stack or []
        existing_asset.collaborators = sub.collaborators or []
        existing_asset.cloud_provider = sub.cloud_provider
        existing_asset.maturity = _coerce_maturity(sub.maturity)
        existing_asset.demo_ready = sub.demo_ready
        existing_asset.video_url = sub.video_url
        existing_asset.video_urls = list(dict.fromkeys(sub.video_urls or ([sub.video_url] if sub.video_url else [])))
        existing_asset.demo_url = sub.demo_url
        existing_asset.repo_url = sub.repo_url
        existing_asset.dependencies = sub.dependencies
        existing_asset.commands = sub.commands or []
        existing_asset.architecture_file_url = sub.architecture_file_url
        existing_asset.category = sub.category
        existing_asset.owner_name = sub.owner_name
        existing_asset.owner_email = sub.owner_email
        existing_asset.manager_name = sub.manager_name
        existing_asset.manager_email = sub.manager_email
        existing_asset.designation = sub.designation
        existing_asset.aiv_ideation_id = sub.aiv_ideation_id
        existing_asset.aiv_ideation_title = sub.aiv_ideation_title
        existing_asset.ai_score = sub.ai_score
        existing_asset.ai_feedback = sub.ai_feedback
        existing_asset.status = AssetStatus.Published
        asset = existing_asset
    else:
        catalog_code = await next_catalog_code(db, sub.family)
        asset = CatalogAsset(
            catalog_code=catalog_code,
            slug=slug,
            title=sub.title,
            description=sub.description or "",
            family=sub.family,
            department=sub.department,
            tech_stack=sub.tech_stack or [],
            collaborators=sub.collaborators or [],
            cloud_provider=sub.cloud_provider,
            maturity=_coerce_maturity(sub.maturity),
            demo_ready=sub.demo_ready,
            video_url=sub.video_url,
            video_urls=list(dict.fromkeys(sub.video_urls or ([sub.video_url] if sub.video_url else []))),
            demo_url=sub.demo_url,
            repo_url=sub.repo_url,
            dependencies=sub.dependencies,
            commands=sub.commands or [],
            architecture_file_url=sub.architecture_file_url,
            category=sub.category,
            owner_name=sub.owner_name,
            owner_email=sub.owner_email,
            manager_name=sub.manager_name,
            manager_email=sub.manager_email,
            designation=sub.designation,
            aiv_ideation_id=sub.aiv_ideation_id,
            aiv_ideation_title=sub.aiv_ideation_title,
            status=AssetStatus.Published,
            ai_score=sub.ai_score,
            ai_feedback=sub.ai_feedback,
            owner_id=sub.submitter_id,
        )
        db.add(asset)

    await db.flush()
    from app.services.artifact_migration import queue_artifact_finalization
    await queue_artifact_finalization(db, asset, user.id)
    sub.catalog_code = str(asset.id)
    sub.status = SubmissionStatus.Published
    db.add(ActivityLog(
        actor_id=user.id,
        action="submission_published",
        entity_type="submission",
        entity_id=sub.id,
        log_metadata={"catalog_asset_id": str(asset.id)},
    ))
    await db.commit()
    from app.services.knowledge.ingestion_service import reindex_catalog_asset_by_id
    background_tasks.add_task(reindex_catalog_asset_by_id, str(asset.id))
    await db.refresh(sub)

    catalog_url = f"{get_settings().frontend_url}/catalog"

    # Fetch submitter for email notifications
    submitter_result = await db.execute(select(UserProfile).where(UserProfile.id == sub.submitter_id))
    submitter = submitter_result.scalars().first()

    # Email requestor: asset is live
    if submitter:
        try:
            await send_l2_published_requestor_email(
                submitter_email=submitter.email,
                submitter_name=submitter.display_name or submitter.email,
                asset_title=sub.title,
                catalog_url=catalog_url,
            )
        except Exception as exc:
            logger.warning("Failed to send L2 publish email to requestor: %s", exc)

    # Email all admins: new asset published
    try:
        notif_result = await db.execute(
            select(UserProfile.email).where(
                UserProfile.role.in_([UserRole.admin, UserRole.owner]),
                UserProfile.email.isnot(None),
                UserProfile.email != "",
            )
        )
        admin_emails = [r[0] for r in notif_result.fetchall() if r[0]]
        logger.info("L2 publish admin notification — found %d recipient(s): %s", len(admin_emails), admin_emails)
        if submitter:
            admin_emails = [e for e in admin_emails if e != submitter.email]
        if admin_emails:
            await send_l2_published_admin_notification_email(
                admin_emails=admin_emails,
                asset_title=sub.title,
                submitter_name=submitter.display_name if submitter else "a team member",
                catalog_url=catalog_url,
            )
    except Exception as exc:
        logger.warning("Failed to send L2 publish admin notifications: %s", exc)

    return _to_response(sub)


@router.delete("/{submission_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_submission(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> Response:
    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    role_val = user.role.value if hasattr(user.role, "value") else user.role
    if role_val != "Aimplify.Owner" and str(sub.submitter_id) != str(user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own submissions.")

    if sub.status == SubmissionStatus.Published and role_val != "Aimplify.Owner":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Published submissions cannot be deleted.")

    db.add(ActivityLog(actor_id=user.id, action="submission_deleted", entity_type="submission", entity_id=sub.id))
    await db.delete(sub)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{submission_id}/family")
async def update_review_family(submission_id: UUID, body: FamilyUpdate, db: AsyncSession = Depends(get_db),
                               user=require_role("Aimplify.Admin", "Aimplify.Owner")):
    submission = await change_family(db, submission_id, body.family, user.id)
    await db.commit()
    return {"id":str(submission.id), "family":submission.family}
