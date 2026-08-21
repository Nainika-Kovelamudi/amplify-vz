import asyncio
import logging
from typing import Dict, List, Set

from fastapi import WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.deps.jwt import decode_app_jwt

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = {}  # user_id -> sockets
        self._role_index: Dict[str, Set[str]] = {}           # role -> set of user_ids
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str, role: str) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(user_id, []).append(websocket)
            self._role_index.setdefault(role, set()).add(user_id)
        logger.debug("WS connected: user_id=%s role=%s", user_id, role)

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        sockets = self._connections.get(user_id, [])
        if websocket in sockets:
            sockets.remove(websocket)
        if not sockets:
            self._connections.pop(user_id, None)
            for role_set in self._role_index.values():
                role_set.discard(user_id)
        logger.debug("WS disconnected: user_id=%s", user_id)

    async def send_to_user(self, user_id: str, message: dict) -> None:
        sockets = list(self._connections.get(user_id, []))
        stale = []
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws, user_id)

    async def broadcast_to_role(self, role: str, message: dict) -> None:
        async with self._lock:
            user_ids = set(self._role_index.get(role, set()))
        for uid in user_ids:
            await self.send_to_user(uid, message)

    async def broadcast_to_admins(self, message: dict) -> None:
        await self.broadcast_to_role("Aimplify.Admin", message)
        await self.broadcast_to_role("Aimplify.Owner", message)


ws_manager = ConnectionManager()


async def websocket_notifications_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> None:
    """WebSocket endpoint — admin/super_admin only."""
    try:
        claims = await decode_app_jwt(token)
    except Exception:
        await websocket.close(code=1008)
        return

    role: str = claims.get("role", "")
    user_id: str = claims.get("sub", "")

    if role not in ("Aimplify.Admin", "Aimplify.Owner"):
        await websocket.close(code=1008)
        return

    await ws_manager.connect(websocket, user_id, role)
    try:
        await websocket.send_json({"event": "connection_ack", "user_id": user_id, "role": role})
        while True:
            await websocket.receive_text()  # keep-alive; ignore client messages
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("WS error for user %s: %s", user_id, exc)
    finally:
        ws_manager.disconnect(websocket, user_id)
