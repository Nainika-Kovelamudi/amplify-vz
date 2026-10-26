from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.deps.rbac import require_role
from app.schemas.assistant import ChatRequest, ChatResponse
from app.services.knowledge.assistant_agent import answer_question

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["Assistant"])

# Plain REST, not WebSocket: the production App Service plan does not support
# WebSockets (see the note in frontend/src/components/layout/MainLayout.tsx), so
# this deliberately does not reuse app/websocket/manager.py. Streaming can be
# revisited later via Server-Sent Events if needed — see docs/knowledge-bot-plan.md.


@router.get("/config")
async def chatbot_config() -> dict[str, bool]:
    """Expose the runtime chatbot visibility setting to the portal."""
    return {"enabled": get_settings().chatbot_enabled}


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> ChatResponse:
    if not get_settings().chatbot_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chatbot is disabled.")
    result = await answer_question(
        body.message,
        history=[turn.model_dump() for turn in body.history],
        user_id=str(user.id),
    )
    logger.info("[knowledge-bot] chat query from %s — confident=%s", user.email, result["is_confident"])
    return ChatResponse(**result)
