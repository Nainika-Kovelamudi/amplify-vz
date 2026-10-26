from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_client_uri: Optional[str] = None

# Every document this client writes/reads carries this namespace so Aimplify's
# knowledge base never mixes with AIV's own ideation data, even if it turns out
# we're sharing a collection rather than getting a dedicated one (see
# docs/knowledge-bot-plan.md §7a #2).
NAMESPACE = "aimplify"


def _mongo_client(uri: str) -> AsyncIOMotorClient:
    global _client, _client_uri
    if _client is None or _client_uri != uri:
        if _client is not None:
            _client.close()
        _client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=10000, connectTimeoutMS=10000)
        _client_uri = uri
    return _client


def _collection():
    settings = get_settings()
    if not settings.aiv_mongodb_url or not settings.aiv_mongodb_db_name:
        raise RuntimeError(
            "Knowledge bot is not configured — AIV_MONGODB_URL / AIV_MONGODB_DB_NAME must be set "
            "(the knowledge base reuses the shared AIV vector DB, see docs/knowledge-bot-plan.md)."
        )
    client = _mongo_client(settings.aiv_mongodb_url)
    return client[settings.aiv_mongodb_db_name][settings.aimplify_knowledge_collection]


async def upsert_chunk(
    source_type: str,
    source_id: str,
    text: str,
    summary: str,
    tags: list[str],
    keywords: list[str],
    embedding: list[float],
    link: str,
    title: str,
) -> None:
    """Upsert one knowledge record, keyed on (namespace, source_type, source_id)."""
    collection = _collection()
    now = datetime.now(timezone.utc)
    await collection.update_one(
        {"namespace": NAMESPACE, "source_type": source_type, "source_id": source_id},
        {
            "$set": {
                "namespace": NAMESPACE,
                "source_type": source_type,
                "source_id": source_id,
                "title": title,
                "text": text,
                "summary": summary,
                "tags": tags,
                "keywords": keywords,
                "embedding": embedding,
                "link": link,
                "updated_at": now,
            }
        },
        upsert=True,
    )


async def delete_by_source(source_type: str, source_id: str) -> None:
    collection = _collection()
    await collection.delete_many(
        {"namespace": NAMESPACE, "source_type": source_type, "source_id": source_id}
    )


async def vector_search(embedding: list[float], top_k: int = 8) -> list[dict[str, Any]]:
    """Atlas Vector Search ($vectorSearch). ASSUMED-unconfirmed infra (see §7a #1/#3) —
    degrades to an empty result (never raises) so the rest of the hybrid pipeline still
    works off tag/keyword search alone until this is confirmed/created in Atlas."""
    collection = _collection()
    settings = get_settings()
    try:
        cursor = collection.aggregate(
            [
                {
                    "$vectorSearch": {
                        "index": settings.aimplify_vector_index_name,
                        "path": "embedding",
                        "queryVector": embedding,
                        "numCandidates": max(top_k * 10, 100),
                        "limit": top_k,
                        "filter": {"namespace": NAMESPACE},
                    }
                },
                {"$set": {"score": {"$meta": "vectorSearchScore"}}},
            ]
        )
        return await cursor.to_list(length=top_k)
    except PyMongoError as exc:
        logger.warning(
            "[knowledge-bot] vector_search unavailable (index '%s' may not exist yet — "
            "see docs/knowledge-bot-plan.md §7a #1/#3): %s",
            settings.aimplify_vector_index_name, exc,
        )
        return []


async def keyword_search(query: str, top_k: int = 8) -> list[dict[str, Any]]:
    """Atlas Search ($search) full-text match. ASSUMED-unconfirmed infra (see §7a #4) —
    degrades to an empty result (never raises)."""
    collection = _collection()
    settings = get_settings()
    try:
        cursor = collection.aggregate(
            [
                {
                    "$search": {
                        "index": settings.aimplify_search_index_name,
                        "compound": {
                            "must": [{"text": {"query": query, "path": ["text", "summary", "keywords", "title"]}}],
                            "filter": [{"equals": {"path": "namespace", "value": NAMESPACE}}],
                        },
                    }
                },
                {"$limit": top_k},
                {"$set": {"score": {"$meta": "searchScore"}}},
            ]
        )
        return await cursor.to_list(length=top_k)
    except PyMongoError as exc:
        logger.warning(
            "[knowledge-bot] keyword_search unavailable (index '%s' may not exist yet — "
            "see docs/knowledge-bot-plan.md §7a #4): %s",
            settings.aimplify_search_index_name, exc,
        )
        return []


async def tag_search(tags: list[str], top_k: int = 8) -> list[dict[str, Any]]:
    """Plain Mongo query on the `tags` array — no special index required, so this always
    works regardless of whether the Atlas Search/Vector Search assumptions hold."""
    if not tags:
        return []
    collection = _collection()
    try:
        cursor = collection.find(
            {"namespace": NAMESPACE, "tags": {"$in": tags}}
        ).limit(top_k)
        results = await cursor.to_list(length=top_k)
        for r in results:
            overlap = len(set(r.get("tags", [])) & set(tags))
            r["score"] = overlap / max(len(tags), 1)
        return results
    except PyMongoError as exc:
        logger.warning("[knowledge-bot] tag_search failed: %s", exc)
        return []


async def list_all(source_type: str, tags: list[str] | None = None, limit: int = 200) -> list[dict[str, Any]]:
    """Complete (non-ranked) fetch for genuine "list everything"/"how many" questions —
    deliberately bypasses vector/keyword ranking, which answers "what's most relevant,"
    not "give me all of them." Optional tags narrows to a category (e.g. one family)
    while still returning the *complete* matching set, not a top-K sample."""
    collection = _collection()
    query: dict[str, Any] = {"namespace": NAMESPACE, "source_type": source_type}
    if tags:
        query["tags"] = {"$in": tags}
    try:
        cursor = collection.find(query).sort("title", 1).limit(limit)
        results = await cursor.to_list(length=limit)
        for r in results:
            r["score"] = 1.0
        return results
    except PyMongoError as exc:
        logger.warning("[knowledge-bot] list_all failed: %s", exc)
        return []
