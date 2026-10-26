from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from io import BytesIO
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, AssetStatus, CatalogAsset, CloneRequest, CloneStatus, DemoRequest, Submission, SubmissionStatus, UserProfile, UserRole
from app.deps.rbac import get_current_user, require_role
from app.schemas.admin import (
    AdminStatsResponse,
    ApprovalAssignmentRequest,
    ApprovalActionRequest,
    ExecutiveEngagement,
    ExecutiveActiveUser,
    ExecutiveEventMetric,
    ExecutiveFamilyMetric,
    ExecutiveReportResponse,
    ExecutiveSummary,
    ExecutiveTrendingAsset,
    ReportBreakdown,
    ReportTrendPoint,
)
from app.schemas.submission import SubmissionListResponse, SubmissionResponse
from app.services.notification_service import push_notification, push_notifications_to_roles

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
        video_url=s.video_url,
        video_urls=s.video_urls or ([s.video_url] if s.video_url else []),
        status=s.status.value if hasattr(s.status, "value") else s.status,
        ai_score=s.ai_score,
        ai_feedback=s.ai_feedback,
        admin_notes=s.admin_notes,
        submitter_id=s.submitter_id,
        created_at=s.created_at,
        updated_at=s.updated_at,
        aiv_ideation_id=s.aiv_ideation_id,
        aiv_ideation_title=s.aiv_ideation_title,
        assigned_reviewer_id=s.assigned_reviewer_id,
        assigned_at=s.assigned_at,
    )


def _ensure_can_review(sub: Submission, user: UserProfile) -> None:
    role = user.role.value if hasattr(user.role, "value") else user.role
    if role not in ("Aimplify.Admin", "Aimplify.Owner") and str(sub.assigned_reviewer_id) != str(user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This approval is not assigned to you.")


@router.get("/my-review-queue", response_model=SubmissionListResponse)
async def my_review_queue(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> SubmissionListResponse:
    stmt = select(Submission).where(
        Submission.assigned_reviewer_id == user.id,
        Submission.status == SubmissionStatus.Manual_Approval,
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(Submission.assigned_at.asc()).offset(skip).limit(limit))).scalars().all()
    return SubmissionListResponse(items=[_sub_to_response(s) for s in rows], total=total)


@router.patch("/approvals/{submission_id}/assign", response_model=SubmissionResponse)
async def assign_approval(
    submission_id: str,
    body: ApprovalAssignmentRequest,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
    sub = (await db.execute(select(Submission).where(Submission.id == submission_id))).scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    if sub.status != SubmissionStatus.Manual_Approval:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only assets awaiting approval can be assigned.")
    reviewer = (await db.execute(
        select(UserProfile).where(func.lower(UserProfile.email) == body.email.lower())
    )).scalars().first()
    if not reviewer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No platform user exists with this email address.")
    sub.assigned_reviewer_id = reviewer.id
    sub.assigned_by = user.id
    sub.assigned_at = datetime.now(tz=timezone.utc)
    db.add(ActivityLog(actor_id=user.id, action="submission_review_assigned", entity_type="submission", entity_id=sub.id,
                       log_metadata={"reviewer_email": reviewer.email}))
    await db.commit()
    await db.refresh(sub)
    await push_notification(db, str(reviewer.id), "Asset Review Assigned",
                            f'"{sub.title}" was assigned to you for approval.',
                            "submission_review_assigned", str(sub.id))
    await db.commit()
    response = _sub_to_response(sub)
    response.assigned_reviewer_name = reviewer.display_name
    response.assigned_reviewer_email = reviewer.email
    return response


@router.get("/approvals", response_model=SubmissionListResponse)
async def list_approvals(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionListResponse:
    stmt = select(Submission).where(
        or_(
            Submission.status == SubmissionStatus.Manual_Approval,
            Submission.ai_score == 0,
        )
    )

    # All admins see all pending submissions — department is metadata, not an access boundary.
    # Optional department filter for super_admin to narrow results.
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
    user: UserProfile = Depends(get_current_user),
) -> SubmissionResponse:
    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    _ensure_can_review(sub, user)

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
    await push_notifications_to_roles(
        db,
        [UserRole.owner],
        "New L1 Approval",
        f'"{sub.title}" was approved and is waiting for final publish approval.',
        "submission_approved",
        str(sub.id),
        exclude_user_id=str(user.id),
    )
    await db.commit()
    return _sub_to_response(sub)


@router.patch("/approvals/{submission_id}/reject", response_model=SubmissionResponse)
async def reject_submission(
    submission_id: str,
    body: ApprovalActionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> SubmissionResponse:
    from app.services.email_service import send_rejection_email

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    _ensure_can_review(sub, user)

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
    await db.commit()
    await db.refresh(sub)
    await push_notification(
        db, str(sub.submitter_id),
        "Submission Needs Changes 🔄",
        f'Your submission "{sub.title}" requires changes: {body.notes or "See admin feedback."}',
        "submission_rejected", str(sub.id),
    )
    await db.commit()
    if submitter:
        background_tasks.add_task(send_rejection_email, submitter.email, sub.title, body.notes or "")
    return _sub_to_response(sub)


@router.patch("/approvals/{submission_id}/final-reject", response_model=SubmissionResponse)
async def final_reject_submission(
    submission_id: str,
    body: ApprovalActionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> SubmissionResponse:
    from app.services.email_service import send_final_rejection_email

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    _ensure_can_review(sub, user)

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
    await db.commit()
    await db.refresh(sub)
    if submitter:
        background_tasks.add_task(send_final_rejection_email, submitter.email, sub.title, body.notes or "")
    return _sub_to_response(sub)


@router.patch("/approvals/{submission_id}/hold", response_model=SubmissionResponse)
async def hold_submission(
    submission_id: str,
    background_tasks: BackgroundTasks,
    body: ApprovalActionRequest = ApprovalActionRequest(),
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> SubmissionResponse:
    from app.services.email_service import send_on_hold_email

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    _ensure_can_review(sub, user)

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
    await db.commit()
    await db.refresh(sub)
    if submitter:
        background_tasks.add_task(send_on_hold_email, submitter.email, sub.title, body.notes or "")
    return _sub_to_response(sub)


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> AdminStatsResponse:
    role_val = user.role.value if hasattr(user.role, "value") else user.role

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
    demo_requests = (await db.execute(
        select(func.count()).select_from(DemoRequest)
    )).scalar_one()
    total_users = (await db.execute(select(func.count()).select_from(UserProfile))).scalar_one()

    return AdminStatsResponse(
        pending_approvals=pending,
        awaiting_publish=awaiting_publish,
        published_assets=published,
        pending_clones=clone_requests,
        pending_demos=demo_requests,
        total_users=total_users,
    )


@router.get("/executive-report", response_model=ExecutiveReportResponse)
async def get_executive_report(
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
    refresh: bool = False,
) -> ExecutiveReportResponse:
    from app.services.executive_report_data import build_executive_report
    return await build_executive_report(days, db, user, refresh)


@router.get("/executive-report/download")
async def download_executive_report(
    days: int = Query(30, ge=7, le=365),
    format: str = Query("docx", pattern="^(docx|xlsx|pdf)$"),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
):
    from app.services.executive_report_service import (
        build_executive_report_docx,
        build_executive_report_pdf,
        build_executive_report_xlsx,
    )

    report = await get_executive_report(days=days, db=db, user=user)
    builders = {
        "docx": (build_executive_report_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        "xlsx": (build_executive_report_xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "pdf": (build_executive_report_pdf, "application/pdf"),
    }
    builder, media_type = builders[format]
    from starlette.concurrency import run_in_threadpool
    content = await run_in_threadpool(builder, report)
    filename = f"AIMPLIFY_Executive_Report_{report.period_end:%Y%m%d}.{format}"
    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/observability-report/download")
async def download_observability_report(
    format: str = Query("xlsx", pattern="^(docx|xlsx|pdf)$"),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
):
    from app.services.observability_report_service import (
        build_observability_docx, build_observability_pdf, build_observability_xlsx,
    )

    stats = await get_stats(db=db, user=user)
    event_rows = (await db.execute(
        select(ActivityLog, UserProfile.email, UserProfile.display_name)
        .outerjoin(UserProfile, ActivityLog.actor_id == UserProfile.id)
        .order_by(ActivityLog.created_at.desc())
    )).all()
    assets = (await db.execute(select(CatalogAsset))).scalars().all()
    clone_count_rows = (await db.execute(
        select(CloneRequest.asset_id, func.count(CloneRequest.id)).group_by(CloneRequest.asset_id)
    )).all()
    clone_counts = {asset_id: int(count) for asset_id, count in clone_count_rows}
    total_clone_requests = sum(clone_counts.values())
    event_counts = Counter(log.action for log, _, _ in event_rows)
    user_counts: dict[str, dict] = {}
    for log, email, name in event_rows:
        key = email or "System"
        item = user_counts.setdefault(key, {"name": name or key, "count": 0, "last": log.created_at})
        item["count"] += 1
        if log.created_at > item["last"]: item["last"] = log.created_at
    data = {
        "governance": [
            ("Published Assets", stats.published_assets), ("Awaiting Publish", stats.awaiting_publish),
            ("Pending Approvals", stats.pending_approvals), ("Pending Clones", stats.pending_clones),
            ("Pending Demos", stats.pending_demos),
        ],
        "activity": [
            ("Total Events", len(event_rows)), ("Active Users", len([x for x in user_counts.values() if x["count"] > 0])),
            ("Asset Views", sum(a.view_count or 0 for a in assets)),
            ("Clone Requests", total_clone_requests),
            ("Demo Requests", sum(a.demo_request_count or 0 for a in assets)),
            ("Submissions", event_counts.get("submission_created", 0)),
        ],
        "top_events": [((action.replace("_", " ")).title(), count) for action, count in event_counts.most_common(10)],
        "active_users": [[v["name"], email, v["count"], v["last"].isoformat()] for email, v in sorted(user_counts.items(), key=lambda x: x[1]["count"], reverse=True)],
        "assets": [[a.title, a.family, a.view_count or 0, clone_counts.get(a.id, 0), a.demo_request_count or 0] for a in sorted(assets, key=lambda a: (a.view_count or 0) + clone_counts.get(a.id, 0) + (a.demo_request_count or 0), reverse=True)],
        "recent_events": [[log.created_at.isoformat(), log.action, name or "System", email or "", log.entity_type, str(log.entity_id or "")] for log, email, name in event_rows[:500]],
    }
    builders = {
        "xlsx": (build_observability_xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "docx": (build_observability_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        "pdf": (build_observability_pdf, "application/pdf"),
    }
    builder, media_type = builders[format]
    filename = f"AIMPLIFY_Observability_Report_{datetime.now(tz=timezone.utc):%Y%m%d}.{format}"
    return StreamingResponse(BytesIO(builder(data)), media_type=media_type,
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.post("/executive-report/test-email")
async def send_executive_report_test_email(
    days: int = Query(30, ge=7, le=365),
    format: str = Query("docx", pattern="^(docx|xlsx|pdf)$"),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
) -> dict:
    from app.services.executive_report_service import email_executive_report

    report = await get_executive_report(days=days, db=db, user=user)
    await email_executive_report(user.email, report, format=format)
    logger.info("Executive report test email sent to owner %s", user.email)
    return {"status": "sent", "recipient": user.email, "format": format}


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
