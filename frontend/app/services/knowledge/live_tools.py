from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func, select

logger = logging.getLogger(__name__)

# Mirrors the exact same logic the Home page dashboard already uses (catalog.py's
# FAMILIES list + client-side maturity/demo_ready counts in Home.tsx) — this queries
# Postgres directly, live, at question-time. Unlike everything else the knowledge bot
# answers from (the Mongo mirror), these numbers can never be stale.
_FAMILIES = ["Atlas", "Forge", "Titan", "Sentinel"]
_MATURITIES = ["Experimental", "Battle-Tested", "Production"]


async def get_platform_stats() -> dict[str, Any]:
    """Live aggregate counts over Published catalog assets. Safe, public data —
    no RBAC needed, these are the same numbers already shown on the Home dashboard
    to every authenticated user regardless of role. Opens its own DB session (same
    self-contained pattern as ingestion_service.reindex_catalog_asset_by_id) so the
    assistant router doesn't need a DB dependency just for this one tool."""
    from app.db.base import get_session_factory
    from app.db.models import AssetStatus, CatalogAsset

    async with get_session_factory()() as db:
        total_result = await db.execute(
            select(func.count()).where(CatalogAsset.status == AssetStatus.Published)
        )
        total = total_result.scalar_one()

        demo_ready_result = await db.execute(
            select(func.count()).where(
                CatalogAsset.status == AssetStatus.Published,
                CatalogAsset.demo_ready.is_(True),
            )
        )
        demo_ready = demo_ready_result.scalar_one()

        by_family: dict[str, int] = {}
        for family in _FAMILIES:
            result = await db.execute(
                select(func.count()).where(
                    CatalogAsset.family == family,
                    CatalogAsset.status == AssetStatus.Published,
                )
            )
            by_family[family] = result.scalar_one()

        by_maturity: dict[str, int] = {}
        for maturity in _MATURITIES:
            result = await db.execute(
                select(func.count()).where(
                    CatalogAsset.maturity == maturity,
                    CatalogAsset.status == AssetStatus.Published,
                )
            )
            by_maturity[maturity] = result.scalar_one()

    return {
        "total_published": total,
        "demo_ready": demo_ready,
        "by_family": by_family,
        "by_maturity": by_maturity,
    }


async def get_my_submissions(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """RBAC-safe BY CONSTRUCTION, not by a runtime check: user_id must always be the
    caller's own id taken from the verified JWT (assistant.py's `require_role`
    dependency), never anything client-supplied — so this query can only ever return
    the caller's own submissions. See docs/knowledge-bot-plan.md §3/§4.5. Opens its
    own DB session, same self-contained pattern as get_platform_stats above."""
    from sqlalchemy import select

    from app.db.base import get_session_factory
    from app.db.models import Submission

    async with get_session_factory()() as db:
        result = await db.execute(
            select(Submission)
            .where(Submission.submitter_id == user_id)
            .order_by(Submission.created_at.desc())
            .limit(limit)
        )
        submissions = result.scalars().all()

    items: list[dict[str, Any]] = []
    for s in submissions:
        status_val = s.status.value if hasattr(s.status, "value") else s.status
        feedback = s.ai_feedback if isinstance(s.ai_feedback, dict) else {}
        items.append(
            {
                "id": str(s.id),
                "title": s.title,
                "status": status_val,
                "ai_score": s.ai_score,
                "feedback_summary": feedback.get("summary"),
                "link": f"/pipeline/{s.id}",
            }
        )
    return items
