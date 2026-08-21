from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification
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
            recipient_id=recipient_id,
            title=title,
            body=body,
            event_type=event_type,
            entity_id=entity_id,
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
