from __future__ import annotations

import csv
import io
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, UserProfile
from app.deps.rbac import require_role
from app.schemas.audit import ActivityLogListResponse, ActivityLogResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/audit", tags=["Audit"])


def _build_query(
    action: Optional[str],
    entity_type: Optional[str],
    actor_email: Optional[str],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
):
    stmt = (
        select(ActivityLog, UserProfile.email, UserProfile.display_name)
        .outerjoin(UserProfile, ActivityLog.actor_id == UserProfile.id)
    )
    if action:
        stmt = stmt.where(ActivityLog.action.ilike(f"%{action}%"))
    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
    if actor_email:
        stmt = stmt.where(UserProfile.email.ilike(f"%{actor_email}%"))
    if date_from:
        stmt = stmt.where(ActivityLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(ActivityLog.created_at <= date_to)
    return stmt


@router.get("", response_model=ActivityLogListResponse)
async def get_audit_log(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    actor_email: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
) -> ActivityLogListResponse:
    base = _build_query(action, entity_type, actor_email, date_from, date_to)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    result = await db.execute(
        base.order_by(ActivityLog.created_at.desc()).offset(skip).limit(limit)
    )
    rows = result.all()
    page = (skip // limit) + 1

    items = [
        ActivityLogResponse(
            id=log.id,
            actor_email=email,
            actor_display_name=display_name,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            metadata=log.log_metadata,
            created_at=log.created_at,
        )
        for log, email, display_name in rows
    ]
    return ActivityLogListResponse(items=items, total=total, page=page, page_size=limit)


@router.post("/export")
async def export_audit_log(
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    actor_email: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
) -> StreamingResponse:
    base = _build_query(action, entity_type, actor_email, date_from, date_to)
    result = await db.execute(base.order_by(ActivityLog.created_at.desc()))
    rows = result.all()

    def generate_csv():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["id", "action", "entity_type", "entity_id", "actor_email", "metadata", "created_at"])
        for log, email, _ in rows:
            writer.writerow([
                str(log.id), log.action, log.entity_type,
                str(log.entity_id) if log.entity_id else "",
                email or "", str(log.log_metadata or ""),
                log.created_at.isoformat(),
            ])
            yield buf.getvalue()
            buf.truncate(0)
            buf.seek(0)

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_log_{ts}.csv"},
    )
