from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, AssetStatus, CatalogAsset, CloneRequest, CloneStatus, DemoRequest, Submission, SubmissionStatus, UserProfile
from app.deps.rbac import require_role
from app.schemas.admin import (
    AdminStatsResponse,
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
        video_url=s.video_url,
        video_urls=s.video_urls or ([s.video_url] if s.video_url else []),
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
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> SubmissionResponse:
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
    total_users = (await db.execute(select(func.count()).select_from(UserProfile))).scalar_one()

    return AdminStatsResponse(
        pending_approvals=pending,
        awaiting_publish=awaiting_publish,
        published_assets=published,
        pending_clones=clone_requests,
        total_users=total_users,
    )


@router.get("/executive-report", response_model=ExecutiveReportResponse)
async def get_executive_report(
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
) -> ExecutiveReportResponse:
    """Owner-only executive view of submission, approval, publishing, and adoption KPIs."""
    now = datetime.now(tz=timezone.utc)
    period_start = now - timedelta(days=days)

    period_submissions = list((await db.execute(
        select(Submission).where(Submission.created_at >= period_start)
    )).scalars().all())
    all_submissions = list((await db.execute(select(Submission))).scalars().all())
    assets = list((await db.execute(
        select(CatalogAsset).where(CatalogAsset.status == AssetStatus.Published)
    )).scalars().all())
    logs = list((await db.execute(
        select(ActivityLog).where(ActivityLog.created_at >= period_start)
    )).scalars().all())

    action_counts = Counter(log.action for log in logs)
    scored = [s for s in period_submissions if s.ai_score is not None]
    non_error_scores = [float(s.ai_score) for s in scored if s.ai_score and s.ai_score > 0]
    ai_passed = sum(1 for s in scored if s.ai_score is not None and s.ai_score >= 60)
    ai_failures = sum(1 for s in scored if s.ai_score == 0)
    ai_needs_changes = sum(1 for s in scored if s.ai_score is not None and 0 < s.ai_score < 60)
    approved = action_counts.get("submission_approved", 0)
    published = action_counts.get("submission_published", 0) + action_counts.get("asset_published", 0)
    rejected = action_counts.get("submission_final_rejected", 0)
    decisions = approved + rejected + action_counts.get("submission_rejected", 0)

    review_hours = [
        max(0.0, (s.reviewed_at - s.created_at).total_seconds() / 3600)
        for s in period_submissions
        if s.reviewed_at is not None
    ]
    pending = [s for s in all_submissions if s.status == SubmissionStatus.Manual_Approval]
    oldest_pending_hours = max(
        (max(0.0, (now - s.created_at).total_seconds() / 3600) for s in pending),
        default=0.0,
    )
    submission_count = len(period_submissions)

    status_funnel = Counter(
        s.status.value if hasattr(s.status, "value") else str(s.status)
        for s in all_submissions
    )

    daily: dict[str, dict[str, int]] = {
        (period_start.date() + timedelta(days=i)).isoformat(): {
            "submitted": 0, "approved": 0, "published": 0, "needs_changes": 0,
        }
        for i in range((now.date() - period_start.date()).days + 1)
    }
    for sub in period_submissions:
        key = sub.created_at.date().isoformat()
        if key in daily:
            daily[key]["submitted"] += 1
            if sub.ai_score is not None and 0 < sub.ai_score < 60:
                daily[key]["needs_changes"] += 1
    for log in logs:
        key = log.created_at.date().isoformat()
        if key not in daily:
            continue
        if log.action == "submission_approved":
            daily[key]["approved"] += 1
        elif log.action in ("submission_published", "asset_published"):
            daily[key]["published"] += 1

    def build_breakdown(field: str) -> list[ReportBreakdown]:
        groups: dict[str, list[Submission]] = defaultdict(list)
        for sub in period_submissions:
            groups[(getattr(sub, field, None) or "Unspecified")].append(sub)
        rows: list[ReportBreakdown] = []
        for name, submissions in groups.items():
            scores = [float(s.ai_score) for s in submissions if s.ai_score and s.ai_score > 0]
            rows.append(ReportBreakdown(
                name=name,
                submitted=len(submissions),
                approved=sum(1 for s in submissions if s.status in (SubmissionStatus.Approved, SubmissionStatus.Published)),
                published=sum(1 for s in submissions if s.status == SubmissionStatus.Published),
                average_ai_score=round(sum(scores) / len(scores), 1) if scores else 0.0,
            ))
        return sorted(rows, key=lambda row: row.submitted, reverse=True)

    clone_requests = (await db.execute(
        select(func.count()).select_from(CloneRequest).where(CloneRequest.created_at >= period_start)
    )).scalar_one()
    demo_requests = (await db.execute(
        select(func.count()).select_from(DemoRequest).where(DemoRequest.requested_at >= period_start)
    )).scalar_one()
    active_users = (await db.execute(
        select(func.count()).select_from(UserProfile).where(UserProfile.last_login >= period_start)
    )).scalar_one()

    l1_waiting = sum(1 for s in all_submissions if s.status == SubmissionStatus.Manual_Approval)
    l2_waiting = sum(1 for s in all_submissions if s.status == SubmissionStatus.Approved)
    published_assets = len(assets)

    family_counts = Counter((asset.family or "Unspecified") for asset in assets)
    family_assets = [
        ExecutiveFamilyMetric(
            name=name,
            asset_count=count,
            percentage=round(count * 100 / published_assets, 1) if published_assets else 0.0,
        )
        for name, count in family_counts.most_common()
    ]

    event_definitions = [
        ("asset_viewed", "Asset viewed", ("asset_viewed",)),
        ("user_login", "User login", ("user_login", "user_login_dev")),
        ("assets_revised", "Assets revised", ("submission_revised", "catalog_asset_updated")),
        ("new_submission", "New submission", ("submission_created",)),
        ("deployment", "Deployment", ("submission_published", "asset_published", "deployment")),
    ]
    top_events = [
        ExecutiveEventMetric(key=key, label=label, count=sum(action_counts.get(action, 0) for action in actions))
        for key, label, actions in event_definitions
    ]

    clone_by_asset = dict((await db.execute(
        select(CloneRequest.asset_id, func.count(CloneRequest.id))
        .where(CloneRequest.created_at >= period_start)
        .group_by(CloneRequest.asset_id)
    )).all())
    demo_by_asset = dict((await db.execute(
        select(DemoRequest.asset_id, func.count(DemoRequest.id))
        .where(DemoRequest.requested_at >= period_start)
        .group_by(DemoRequest.asset_id)
    )).all())
    ranked_assets = sorted(
        assets,
        key=lambda asset: (
            (asset.view_count or 0)
            + (asset.artifact_download_count or 0) * 2
            + clone_by_asset.get(asset.id, 0) * 4
            + demo_by_asset.get(asset.id, 0) * 4
        ),
        reverse=True,
    )[:5]
    trending_assets = [
        ExecutiveTrendingAsset(
            id=str(asset.id), slug=asset.slug, title=asset.title, family=asset.family,
            views=asset.view_count or 0,
            downloads=asset.artifact_download_count or 0,
            clone_requests=clone_by_asset.get(asset.id, 0),
            demo_requests=demo_by_asset.get(asset.id, 0),
            engagement_score=(asset.view_count or 0) + (asset.artifact_download_count or 0) * 2
            + clone_by_asset.get(asset.id, 0) * 4 + demo_by_asset.get(asset.id, 0) * 4,
        )
        for asset in ranked_assets
    ]

    user_event_counts = Counter(log.actor_id for log in logs if log.actor_id is not None)
    user_last_active: dict = {}
    for log in logs:
        if log.actor_id is not None and (
            log.actor_id not in user_last_active or log.created_at > user_last_active[log.actor_id]
        ):
            user_last_active[log.actor_id] = log.created_at
    top_user_ids = [user_id for user_id, _ in user_event_counts.most_common(5)]
    top_user_profiles = list((await db.execute(
        select(UserProfile).where(UserProfile.id.in_(top_user_ids))
    )).scalars().all()) if top_user_ids else []
    profiles_by_id = {profile.id: profile for profile in top_user_profiles}
    most_active_users = [
        ExecutiveActiveUser(
            user_id=str(user_id),
            name=profiles_by_id[user_id].display_name or profiles_by_id[user_id].email,
            email=profiles_by_id[user_id].email,
            events=count,
            last_active=user_last_active[user_id],
        )
        for user_id, count in user_event_counts.most_common(5)
        if user_id in profiles_by_id
    ]

    return ExecutiveReportResponse(
        generated_at=now,
        period_start=period_start,
        period_end=now,
        days=days,
        summary=ExecutiveSummary(
            total_assets=published_assets + l1_waiting + l2_waiting,
            published_assets=published_assets,
            awaiting_review=l1_waiting + l2_waiting,
            l1_waiting_approval=l1_waiting,
            l2_waiting_approval=l2_waiting,
            new_submissions=submission_count,
            ai_passed=ai_passed,
            ai_needs_changes=ai_needs_changes,
            ai_failures=ai_failures,
            approved=approved,
            published=published,
            rejected=rejected,
            pending_approvals=len(pending),
            awaiting_publish=sum(1 for s in all_submissions if s.status == SubmissionStatus.Approved),
            on_hold=sum(1 for s in all_submissions if s.status == SubmissionStatus.On_Hold),
            average_ai_score=round(sum(non_error_scores) / len(non_error_scores), 1) if non_error_scores else 0.0,
            ai_pass_rate=round(ai_passed * 100 / len(scored), 1) if scored else 0.0,
            approval_rate=round(approved * 100 / decisions, 1) if decisions else 0.0,
            publication_rate=round(published * 100 / approved, 1) if approved else 0.0,
            average_review_hours=round(sum(review_hours) / len(review_hours), 1) if review_hours else 0.0,
            oldest_pending_hours=round(oldest_pending_hours, 1),
        ),
        status_funnel=dict(status_funnel),
        daily_trend=[
            ReportTrendPoint(date=datetime.fromisoformat(key).date(), **values)
            for key, values in sorted(daily.items())
        ],
        departments=build_breakdown("department"),
        families=build_breakdown("family"),
        engagement=ExecutiveEngagement(
            catalog_views=sum(a.view_count or 0 for a in assets),
            artifact_downloads=sum(a.artifact_download_count or 0 for a in assets),
            demo_views=sum(a.demo_view_count or 0 for a in assets),
            clone_requests=clone_requests,
            demo_requests=demo_requests,
            active_users=active_users,
        ),
        family_assets=family_assets,
        top_events=top_events,
        trending_assets=trending_assets,
        active_users=most_active_users,
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
