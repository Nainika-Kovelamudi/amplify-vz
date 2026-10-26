from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, AssetStatus, CatalogAsset, CloneRequest, CloneStatus, Submission, SubmissionStatus, UserProfile, UserRole
from app.deps.rbac import require_role
from app.schemas.admin import AdminStatsResponse, ApprovalActionRequest
from app.schemas.submission import SubmissionListResponse, SubmissionResponse
from app.services.blob_service import refresh_sas_url
from app.services.notification_service import push_notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])


def _sub_to_response(s: Submission) -> SubmissionResponse:
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
        video_url=refresh_sas_url(s.video_url),
        status=s.status.value if hasattr(s.status, "value") else s.status,
        ai_score=s.ai_score,
        ai_feedback=s.ai_feedback,
        admin_notes=s.admin_notes,
        submitter_id=s.submitter_id,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@router.get("/approvals", response_model=SubmissionListResponse)
async def list_approvals(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionListResponse:
    stmt = select(Submission).where(Submission.status == SubmissionStatus.Manual_Approval)
    if department:
        stmt = stmt.where(Submission.department == department)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(Submission.created_at.asc()).offset(skip).limit(limit))
    return SubmissionListResponse(items=[_sub_to_response(s) for s in result.scalars().all()], total=total)


@router.get("/publish-queue", response_model=SubmissionListResponse)
async def list_publish_queue(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
) -> SubmissionListResponse:
    """Owner-only: submissions approved by admin, waiting to be published."""
    stmt = select(Submission).where(Submission.status == SubmissionStatus.Approved)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(Submission.created_at.asc()).offset(skip).limit(limit))
    return SubmissionListResponse(items=[_sub_to_response(s) for s in result.scalars().all()], total=total)


@router.patch("/approvals/{submission_id}/approve", response_model=SubmissionResponse)
async def approve_submission(
    submission_id: str,
    body: ApprovalActionRequest = ApprovalActionRequest(),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    from app.services.email_service import send_l1_approved_requestor_email, send_l1_approved_admin_notification_email

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    sub.status = SubmissionStatus.Approved
    sub.reviewed_by = user.id
    sub.reviewed_at = datetime.now(tz=timezone.utc)
    if body.notes:
        sub.admin_notes = body.notes

    db.add(ActivityLog(
        actor_id=user.id,
        action="submission_approved",
        entity_type="submission",
        entity_id=sub.id,
    ))
    await db.commit()
    await db.refresh(sub)

    await push_notification(
        db, str(sub.submitter_id),
        "Submission Approved ✅",
        f'Your submission "{sub.title}" has been approved and is ready to publish.',
        "submission_approved", str(sub.id),
    )
    await db.commit()

    # Fetch submitter for email notifications
    submitter_result = await db.execute(select(UserProfile).where(UserProfile.id == sub.submitter_id))
    submitter = submitter_result.scalars().first()

    # Email requestor: L1 approved, awaiting publish
    if submitter:
        try:
            await send_l1_approved_requestor_email(
                submitter_email=submitter.email,
                submitter_name=submitter.display_name or submitter.email,
                asset_title=sub.title,
            )
        except Exception as exc:
            logger.warning("Failed to send L1 approval email to requestor: %s", exc)

    # Email owners only: asset in publish queue awaiting L2 (only owners can publish)
    try:
        notif_result = await db.execute(
            select(UserProfile.email).where(
                UserProfile.role == UserRole.owner,
                UserProfile.email.isnot(None),
                UserProfile.email != "",
            )
        )
        notif_emails = [r[0] for r in notif_result.fetchall() if r[0]]
        logger.info("L1 approve owner notification — found %d recipient(s): %s", len(notif_emails), notif_emails)
        if submitter:
            notif_emails = [e for e in notif_emails if e != submitter.email]
        if notif_emails:
            await send_l1_approved_admin_notification_email(
                admin_emails=notif_emails,
                submitter_name=submitter.display_name if submitter else "a team member",
                asset_title=sub.title,
            )
    except Exception as exc:
        logger.warning("Failed to send L1 admin notifications: %s", exc)

    return _sub_to_response(sub)


@router.patch("/approvals/{submission_id}/reject", response_model=SubmissionResponse)
async def reject_submission(
    submission_id: str,
    body: ApprovalActionRequest,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    from app.services.email_service import send_rejection_email

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    sub.status = SubmissionStatus.Needs_Changes
    sub.admin_notes = body.notes or ""
    sub.reviewed_by = user.id
    sub.reviewed_at = datetime.now(tz=timezone.utc)

    db.add(ActivityLog(
        actor_id=user.id,
        action="submission_rejected",
        entity_type="submission",
        entity_id=sub.id,
        log_metadata={"notes": body.notes},
    ))
    submitter_result = await db.execute(select(UserProfile).where(UserProfile.id == sub.submitter_id))
    submitter = submitter_result.scalars().first()
    if submitter:
        try:
            await send_rejection_email(submitter.email, sub.title, body.notes or "")
        except Exception as exc:
            logger.warning("Failed to send rejection email: %s", exc)

    await db.commit()
    await db.refresh(sub)
    await push_notification(
        db, str(sub.submitter_id),
        "Submission Needs Changes 🔄",
        f'Your submission "{sub.title}" requires changes: {body.notes or "See admin feedback."}',
        "submission_rejected", str(sub.id),
    )
    await db.commit()
    return _sub_to_response(sub)


@router.patch("/approvals/{submission_id}/final-reject", response_model=SubmissionResponse)
async def final_reject_submission(
    submission_id: str,
    body: ApprovalActionRequest,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    from app.services.email_service import send_final_rejection_email

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    sub.status = SubmissionStatus.Rejected
    sub.admin_notes = body.notes or ""
    sub.reviewed_by = user.id
    sub.reviewed_at = datetime.now(tz=timezone.utc)

    db.add(ActivityLog(
        actor_id=user.id,
        action="submission_final_rejected",
        entity_type="submission",
        entity_id=sub.id,
        log_metadata={"notes": body.notes},
    ))
    await db.flush()

    submitter_result = await db.execute(select(UserProfile).where(UserProfile.id == sub.submitter_id))
    submitter = submitter_result.scalars().first()
    if submitter:
        try:
            await send_final_rejection_email(submitter.email, sub.title, body.notes or "")
        except Exception as exc:
            logger.warning("Failed to send final rejection email: %s", exc)

    await db.commit()
    await db.refresh(sub)
    return _sub_to_response(sub)


@router.patch("/approvals/{submission_id}/hold", response_model=SubmissionResponse)
async def hold_submission(
    submission_id: str,
    body: ApprovalActionRequest = ApprovalActionRequest(),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    from app.services.email_service import send_on_hold_email

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    sub.status = SubmissionStatus.On_Hold
    if body.notes:
        sub.admin_notes = body.notes
    sub.reviewed_by = user.id
    sub.reviewed_at = datetime.now(tz=timezone.utc)

    db.add(ActivityLog(
        actor_id=user.id,
        action="submission_on_hold",
        entity_type="submission",
        entity_id=sub.id,
        log_metadata={"notes": body.notes},
    ))
    await db.flush()

    submitter_result = await db.execute(select(UserProfile).where(UserProfile.id == sub.submitter_id))
    submitter = submitter_result.scalars().first()
    if submitter:
        try:
            await send_on_hold_email(submitter.email, sub.title, body.notes or "")
        except Exception as exc:
            logger.warning("Failed to send on-hold email: %s", exc)

    await db.commit()
    await db.refresh(sub)
    return _sub_to_response(sub)


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> AdminStatsResponse:
    pending = (await db.execute(
        select(func.count()).where(Submission.status == SubmissionStatus.Manual_Approval)
    )).scalar_one()

    awaiting_publish = (await db.execute(
        select(func.count()).where(Submission.status == SubmissionStatus.Approved)
    )).scalar_one()

    published = (await db.execute(
        select(func.count()).where(CatalogAsset.status == AssetStatus.Published)
    )).scalar_one()
    clone_requests = (await db.execute(
        select(func.count()).where(CloneRequest.status == CloneStatus.Pending)
    )).scalar_one()
    total_users = (await db.execute(select(func.count()).select_from(UserProfile))).scalar_one()

    return AdminStatsResponse(
        pending_approvals=pending,
        awaiting_publish=awaiting_publish,
        published_assets=published,
        pending_clones=clone_requests,
        total_users=total_users,
    )


@router.get("/activity")
async def get_activity(
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> list:
    result = await db.execute(
        select(ActivityLog, UserProfile.email, UserProfile.display_name)
        .outerjoin(UserProfile, ActivityLog.actor_id == UserProfile.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(8)
    )
    rows = result.all()
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id) if log.entity_id else None,
            "actor_email": email,
            "actor_name": display_name,
            "created_at": log.created_at.isoformat(),
        }
        for log, email, display_name in rows
    ]
