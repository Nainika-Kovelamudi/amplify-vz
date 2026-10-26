from __future__ import annotations

import logging
from datetime import datetime, timezone
from app.services.blob_service import refresh_sas_url

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, Submission, SubmissionStatus, UserProfile, UserRole
from app.deps.rbac import get_current_user, require_role
from app.schemas.submission import (
    SubmissionCreate,
    SubmissionListResponse,
    SubmissionResponse,
    SubmissionUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/submissions", tags=["Submissions"])


def _to_response(s: Submission) -> SubmissionResponse:
    return SubmissionResponse(
        id=s.id,
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
        demo_url=s.demo_url,
        status=s.status.value if hasattr(s.status, "value") else s.status,
        ai_score=s.ai_score,
        ai_feedback=s.ai_feedback,
        admin_notes=s.admin_notes,
        submitter_id=s.submitter_id,
        created_at=s.created_at,
        updated_at=s.updated_at,
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
    )


@router.post("", response_model=SubmissionResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_submission(
    body: SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    from app.services.email_service import send_submission_received_email, send_submission_admin_notification_email
    from app.services.orchestrator import run_scoring_pipeline

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
    await db.commit()
    background_tasks.add_task(run_scoring_pipeline, str(submission.id), submission_data, "submission")

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
                return _to_response(sub)

        raise HTTPException(status_code=404, detail="Original submission not found.")

    sub_result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = sub_result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission record not found.")

    return _to_response(sub)


@router.get("/mine", response_model=SubmissionListResponse)
async def get_my_submissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionListResponse:
    stmt = select(Submission).where(Submission.submitter_id == user.id)
    count = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(Submission.created_at.desc()).offset(skip).limit(limit)
    )
    return SubmissionListResponse(items=[_to_response(s) for s in result.scalars().all()], total=count)


@router.get("/all", response_model=SubmissionListResponse)
async def get_all_submissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
) -> SubmissionListResponse:
    """Owner (super_admin) sees every submission across all users."""
    stmt = select(Submission)
    if status_filter:
        try:
            stmt = stmt.where(Submission.status == SubmissionStatus[status_filter])
        except KeyError:
            pass
    count = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    result = await db.execute(
        stmt.order_by(Submission.created_at.desc()).offset(skip).limit(limit)
    )
    return SubmissionListResponse(items=[_to_response(s) for s in result.scalars().all()], total=count)


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

    return _to_response(sub)


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

    for field, value in body.model_dump(exclude_unset=True).items():
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
    await db.commit()
    background_tasks.add_task(run_scoring_pipeline, str(sub.id), submission_data, "submission")
    return _to_response(sub)


@router.post("/{submission_id}/rescore", response_model=SubmissionResponse)
async def rescore_submission(
    submission_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    """Admin/Owner: force re-run AI scoring on a stuck submission."""
    from app.services.orchestrator import run_scoring_pipeline

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    sub.status = SubmissionStatus.Submitted
    sub.ai_score = None
    sub.ai_feedback = None
    await db.commit()

    background_tasks.add_task(run_scoring_pipeline, str(sub.id))
    logger.info("Admin %s triggered rescore for submission %s", user.email, submission_id)
    return _to_response(sub)


@router.post("/{submission_id}/publish", response_model=SubmissionResponse)
async def publish_submission(
    submission_id: str,
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
        existing_asset.ai_score = sub.ai_score
        existing_asset.ai_feedback = sub.ai_feedback
        existing_asset.status = AssetStatus.Published
        asset = existing_asset
    else:
        family_prefix = sub.family[:3].upper()
        asset = CatalogAsset(
            catalog_code=f"{family_prefix}-{_uuid.uuid4().hex[:6].upper()}",
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
            status=AssetStatus.Published,
            ai_score=sub.ai_score,
            ai_feedback=sub.ai_feedback,
            owner_id=sub.submitter_id,
        )
        db.add(asset)

    sub.status = SubmissionStatus.Published
    db.add(ActivityLog(
        actor_id=user.id,
        action="submission_published",
        entity_type="submission",
        entity_id=sub.id,
        log_metadata={"catalog_asset_id": str(asset.id)},
    ))
    await db.commit()
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
