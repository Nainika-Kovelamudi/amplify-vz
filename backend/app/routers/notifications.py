from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import Notification
from app.deps.rbac import require_role
from app.schemas.notification import NotificationListResponse, NotificationResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])


class MarkReadRequest(BaseModel):
    notification_ids: Optional[List[UUID]] = Field(default=None)
    mark_all: bool = Field(default=False)


class MarkReadResponse(BaseModel):
    updated: int


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> NotificationListResponse:
    unread_count = (
        await db.execute(
            select(func.count()).where(
                Notification.recipient_id == user.id,
                Notification.read.is_(False),
            )
        )
    ).scalar_one()

    stmt = select(Notification).where(Notification.recipient_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.read.is_(False))

    result = await db.execute(
        stmt.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    )
    items = [
        NotificationResponse(
            id=n.id, title=n.title, body=n.body, read=n.read,
            event_type=n.event_type, entity_id=n.entity_id, created_at=n.created_at,
        )
        for n in result.scalars().all()
    ]
    return NotificationListResponse(items=items, unread_count=unread_count)


@router.patch("/read", response_model=MarkReadResponse)
async def mark_read(
    body: MarkReadRequest,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> MarkReadResponse:
    if not body.mark_all and not body.notification_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either 'notification_ids' or set 'mark_all' to true.",
        )

    now = datetime.now(tz=timezone.utc)
    base_filter = [Notification.recipient_id == user.id, Notification.read.is_(False)]

    if body.mark_all:
        stmt = update(Notification).where(*base_filter).values(read=True, read_at=now)
    else:
        ids = body.notification_ids or []
        stmt = update(Notification).where(*base_filter, Notification.id.in_(ids)).values(read=True, read_at=now)

    result = await db.execute(stmt.execution_options(synchronize_session="fetch"))
    await db.commit()
    return MarkReadResponse(updated=result.rowcount or 0)
