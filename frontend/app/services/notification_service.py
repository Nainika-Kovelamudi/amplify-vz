from __future__ import annotations

import logging
import uuid
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification, UserProfile
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


async def push_notification(
    db: AsyncSession,
    recipient_id: str,
    title: str,
    body: str,
    event_type: str,
    entity_id: Optional[str] = None,
) -> None:
    """
    Persist a notification row and push it via WebSocket if the user is connected.
    All errors are swallowed so callers are never affected.
    """
    try:
        notif = Notification(
            id=uuid.uuid4(),
            recipient_id=uuid.UUID(str(recipient_id)),
            title=title,
            body=body,
            event_type=event_type,
            entity_id=uuid.UUID(str(entity_id)) if entity_id else None,
            read=False,
        )
        db.add(notif)
        await db.flush()

        await ws_manager.send_to_user(str(recipient_id), {
            "event": event_type,
            "title": title,
            "body": body,
            "entity_id": str(entity_id) if entity_id else None,
        })
    except Exception as exc:
        logger.warning("push_notification failed (non-fatal): %s", exc)


async def push_notifications_to_roles(
    db: AsyncSession,
    roles: Sequence[object],
    title: str,
    body: str,
    event_type: str,
    entity_id: Optional[str] = None,
    exclude_user_id: Optional[str] = None,
) -> int:
    """Persist the same bell notification for every user in the selected roles."""
    try:
        result = await db.execute(select(UserProfile.id).where(UserProfile.role.in_(roles)))
        recipient_ids = [str(row[0]) for row in result.all() if str(row[0]) != str(exclude_user_id)]
        for recipient_id in recipient_ids:
            await push_notification(db, recipient_id, title, body, event_type, entity_id)
        logger.info("Created %d %s notification(s).", len(recipient_ids), event_type)
        return len(recipient_ids)
    except Exception as exc:
        logger.warning("push_notifications_to_roles failed (non-fatal): %s", exc)
        return 0
