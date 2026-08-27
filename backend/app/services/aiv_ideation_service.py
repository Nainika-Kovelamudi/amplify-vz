from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError

from app.config import get_settings

logger = logging.getLogger(__name__)
_client: AsyncIOMotorClient | None = None
_client_uri: str | None = None


def _required(value: str, name: str) -> str:
    value = (value or "").strip()
    if not value:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI Intelligence Portal integration is not configured ({name}).",
        )
    return value


def _mongo_client(uri: str) -> AsyncIOMotorClient:
    global _client, _client_uri
    if _client is None or _client_uri != uri:
        if _client is not None:
            _client.close()
        _client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=10000, connectTimeoutMS=10000)
        _client_uri = uri
    return _client


async def list_approved_ideations() -> list[dict[str, Any]]:
    cfg = get_settings()
    uri = _required(cfg.aiv_mongodb_url, "AIV_MONGODB_URL")
    db_name = _required(cfg.aiv_mongodb_db_name, "AIV_MONGODB_DB_NAME")
    collection_name = _required(cfg.aiv_ideations_collection, "AIV_IDEATIONS_COLLECTION")
    try:
        collection = _mongo_client(uri)[db_name][collection_name]
        rows = await collection.find(
            {"current_stage": "l3_approved"},
            {"_id": 0, "idea_reference_no": 1, "idea_title": 1, "updated_at": 1},
        ).sort("updated_at", -1).to_list(length=1000)
    except PyMongoError as exc:
        logger.exception("Failed to query approved AIV ideations from MongoDB")
        raise HTTPException(status_code=503, detail="Could not load approved ideations from the AI Intelligence Portal database.") from exc

    return [
        {
            "id": str(row.get("idea_reference_no") or "").strip(),
            "title": str(row.get("idea_title") or row.get("idea_reference_no") or "").strip(),
        }
        for row in rows
        if row.get("idea_reference_no")
    ]


async def require_approved_ideation(idea_id: str) -> dict[str, str]:
    normalized = (idea_id or "").strip()
    if not normalized:
        raise HTTPException(status_code=422, detail="An approved AIV ideation is required.")
    for idea in await list_approved_ideations():
        if idea["id"] == normalized:
            return idea
    raise HTTPException(status_code=422, detail="The selected AIV ideation is not approved or no longer available.")
