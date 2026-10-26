from __future__ import annotations

import logging
import time
from collections import Counter, defaultdict, OrderedDict
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import ActivityLog, AssetStatus, CatalogAsset, CloneRequest, DemoRequest, Submission, SubmissionStatus, UserProfile
from app.schemas.admin import (ExecutiveReportResponse, ExecutiveSummary, ExecutiveEngagement,
    ExecutiveActiveUser, ExecutiveEventMetric, ExecutiveFamilyMetric, ExecutiveTrendingAsset,
    ReportBreakdown, ReportTrendPoint)

logger = logging.getLogger(__name__)
_CACHE = OrderedDict()
CACHE_SECONDS = 30
CACHE_LIMIT = 32


def clear_report_cache():
    _CACHE.clear()


async def build_executive_report(days: int, db: AsyncSession, user=None, refresh: bool = False) -> ExecutiveReportResponse:
    cache_key = (str(getattr(user, 'id', None)), days)
    started = time.monotonic()
    cached = _CACHE.get(cache_key)
    if not refresh and cached and started - cached[0] < CACHE_SECONDS:
        _CACHE.move_to_end(cache_key)
        return cached[1].model_copy(deep=True)
    now = datetime.now(tz=timezone.utc)
    period_start = now - timedelta(days=days)

    period_submissions = list((await db.execute(
        select(Submission.status, Submission.created_at, Submission.reviewed_at,
               Submission.department, Submission.family, Submission.ai_score)
        .where(Submission.created_at >= period_start)
    )).all())
    status_rows = (await db.execute(select(Submission.status, func.count().label('total'),
        func.min(Submission.created_at).label('oldest')).group_by(Submission.status))).all()
    status_funnel = Counter({getattr(row.status,'value',row.status): row.total for row in status_rows})
    assets = list((await db.execute(
        select(CatalogAsset.id, CatalogAsset.slug, CatalogAsset.title, CatalogAsset.family,
               CatalogAsset.view_count, CatalogAsset.artifact_download_count, CatalogAsset.demo_view_count)
        .where(CatalogAsset.status == AssetStatus.Published)
    )).all())
    event_date = func.date(func.timezone('UTC', ActivityLog.created_at))
    logs = (await db.execute(select(ActivityLog.action, ActivityLog.actor_id,
        event_date.label('event_date'), func.count().label('event_count'),
        func.max(ActivityLog.created_at).label('created_at'))
        .where(ActivityLog.created_at >= period_start)
        .group_by(ActivityLog.action, ActivityLog.actor_id, event_date))).all()
    action_counts = Counter()
    for log in logs: action_counts[log.action] += log.event_count
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
    pending_count = status_funnel.get('Manual_Approval',0)
    oldest_pending = next((row.oldest for row in status_rows if row.status == SubmissionStatus.Manual_Approval), None)
    oldest_pending_hours = max(0.0,(now-oldest_pending).total_seconds()/3600) if oldest_pending else 0.0
    submission_count = len(period_submissions)

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
        key = log.event_date.isoformat()
        if key not in daily:
            continue
        if log.action == "submission_approved":
            daily[key]["approved"] += log.event_count
        elif log.action in ("submission_published", "asset_published"):
            daily[key]["published"] += log.event_count

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

    active_users = (await db.execute(
        select(func.count()).select_from(UserProfile).where(UserProfile.last_login >= period_start)
    )).scalar_one()

    l1_waiting = status_funnel.get('Manual_Approval',0)
    l2_waiting = status_funnel.get('Approved',0)
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
        ("published_asset", "Assets published", ("submission_published", "asset_published")),
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
    clone_requests = sum(clone_by_asset.values())
    demo_requests = sum(demo_by_asset.values())
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

    user_event_counts = Counter()
    for log in logs:
        if log.actor_id is not None: user_event_counts[log.actor_id] += log.event_count
    user_last_active: dict = {}
    for log in logs:
        if log.actor_id is not None and (
            log.actor_id not in user_last_active or log.created_at > user_last_active[log.actor_id]
        ):
            user_last_active[log.actor_id] = log.created_at
    top_user_ids = [user_id for user_id, _ in user_event_counts.most_common(5)]
    top_user_profiles = list((await db.execute(
        select(UserProfile.id, UserProfile.display_name, UserProfile.email).where(UserProfile.id.in_(top_user_ids))
    )).all()) if top_user_ids else []
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

    report = ExecutiveReportResponse(
        generated_at=now,
        period_start=period_start,
        period_end=now,
        days=days,
        summary=ExecutiveSummary(
            # Total = published catalog assets + submissions not yet published.
            # Submissions with Published status are already counted as published assets,
            # so excluding them avoids double-counting.
            total_assets=published_assets + sum(count for state,count in status_funnel.items() if state != 'Published'),
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
            pending_approvals=pending_count,
            awaiting_publish=status_funnel.get('Approved',0),
            on_hold=status_funnel.get('On_Hold',0),
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
    _CACHE[cache_key] = (time.monotonic(),report.model_copy(deep=True))
    _CACHE.move_to_end(cache_key)
    while len(_CACHE)>CACHE_LIMIT: _CACHE.popitem(last=False)
    logger.info('Executive report generated: days=%s elapsed_seconds=%.3f',days,time.monotonic()-started)
    return report
