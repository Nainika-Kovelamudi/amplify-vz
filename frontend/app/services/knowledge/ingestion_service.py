from __future__ import annotations

import logging
from typing import Any

from app.db.models import CatalogAsset
from app.services.knowledge import aiv_vector_client
from app.services.knowledge.llm_helpers import call_llm_json, embed_text

logger = logging.getLogger(__name__)

_TAGGING_SYSTEM_MSG = (
    "You are a librarian indexing entries for InfoVision's Amplify AI accelerator catalog. "
    "Always respond with valid JSON only — no markdown, no explanation, just the raw JSON object."
)


def _structured_tags(asset: CatalogAsset) -> list[str]:
    """Tags pulled directly from existing fields — free, always accurate, no LLM call."""
    tags: list[str] = []
    if asset.family:
        tags.append(asset.family.strip().lower())
    if asset.department:
        tags.append(asset.department.strip().lower())
    if asset.cloud_provider:
        tags.append(asset.cloud_provider.strip().lower())
    if asset.maturity:
        maturity = asset.maturity.value if hasattr(asset.maturity, "value") else asset.maturity
        tags.append(str(maturity).strip().lower())
    if asset.category:
        tags.append(asset.category.strip().lower())
    for tech in asset.tech_stack or []:
        tags.append(str(tech).strip().lower())
    return sorted(set(t for t in tags if t))


def _asset_text(asset: CatalogAsset) -> str:
    parts = [
        f"Title: {asset.title}",
        f"Family: {asset.family}",
        f"Department: {asset.department}",
        f"Description: {asset.description or ''}",
    ]
    if asset.tech_stack:
        parts.append(f"Tech stack: {', '.join(str(t) for t in asset.tech_stack)}")
    if asset.cloud_provider:
        parts.append(f"Cloud provider: {asset.cloud_provider}")
    if asset.dependencies:
        parts.append(f"Dependencies: {asset.dependencies}")
    return "\n".join(parts)


async def _generate_summary_and_keywords(text: str) -> tuple[str, list[str]]:
    prompt = f"""Read the following catalog entry and produce a short summary and semantic keywords
that capture use cases and problem domains NOT already obvious from structured fields
(e.g. "compliance," "data migration," "cost optimization" — not the tech stack itself).

=== ENTRY ===
{text}

Return ONLY valid JSON:
{{
  "summary": "<1-2 sentence summary, plain language>",
  "keywords": ["<keyword or use-case phrase>", ...]
}}"""
    try:
        data = await call_llm_json(_TAGGING_SYSTEM_MSG, prompt)
        summary = str(data.get("summary") or "").strip()
        keywords = [str(k).strip().lower() for k in (data.get("keywords") or []) if str(k).strip()]
        return summary, keywords
    except Exception as exc:  # noqa: BLE001 - never let indexing fail the whole ingestion job
        logger.warning("[knowledge-bot] summary/keyword generation failed, indexing without them: %s", exc)
        return "", []


async def index_catalog_asset(asset: CatalogAsset) -> None:
    """Build and upsert the knowledge record for one Published catalog asset.
    NEVER indexes repo_url or any admin-only field — see docs/knowledge-bot-plan.md §3."""
    text = _asset_text(asset)
    summary, keywords = await _generate_summary_and_keywords(text)
    embedding = await embed_text(f"{asset.title}\n{summary}\n{text}")
    await aiv_vector_client.upsert_chunk(
        source_type="catalog_asset",
        source_id=str(asset.id),
        text=text,
        summary=summary,
        tags=_structured_tags(asset),
        keywords=keywords,
        embedding=embedding,
        link=f"/catalog/{asset.slug}",
        title=asset.title,
    )
    logger.info("[knowledge-bot] indexed catalog_asset %s (%s)", asset.id, asset.title)


async def remove_catalog_asset(asset_id: str) -> None:
    await aiv_vector_client.delete_by_source("catalog_asset", asset_id)
    logger.info("[knowledge-bot] removed catalog_asset %s from the knowledge base", asset_id)


async def reindex_catalog_asset_by_id(asset_id: str) -> None:
    """Background-task entry point: opens its own DB session (decoupled from the
    caller's request/commit lifecycle, same pattern as orchestrator.run_scoring_pipeline)
    and never raises — an indexing failure must not affect the publish/update flow."""
    from sqlalchemy import select
    from app.db.base import get_session_factory

    try:
        async with get_session_factory()() as db:
            result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == asset_id))
            asset = result.scalars().first()
            if not asset:
                logger.warning("[knowledge-bot] reindex requested for missing asset %s", asset_id)
                return
            from app.db.models import AssetStatus
            if asset.status != AssetStatus.Published:
                # Never index anything that isn't public — see docs/knowledge-bot-plan.md §3.
                await remove_catalog_asset(asset_id)
                return
            await index_catalog_asset(asset)
    except Exception as exc:  # noqa: BLE001
        logger.error("[knowledge-bot] reindex failed for asset %s: %s", asset_id, exc, exc_info=True)


# ---------------------------------------------------------------------------
# Static platform knowledge (family taxonomy, workflow explanations) — small,
# hand-authored source list. Extend this list as more platform docs need to be
# searchable; there is no dynamic doc-scanning in v1.
# ---------------------------------------------------------------------------

def _platform_docs() -> list[dict[str, Any]]:
    from app.routers.catalog import FAMILY_META  # local import avoids a routers<->services cycle

    docs: list[dict[str, Any]] = []
    for family_name, meta in FAMILY_META.items():
        docs.append(
            {
                "source_id": f"family:{family_name.lower()}",
                "title": f"{family_name} family",
                "text": (
                    f"{family_name} — {meta['tagline']}\n{meta['long_description']}\n"
                    f"Key assets: {', '.join(meta['key_assets'])}\n"
                    f"Use cases: {'; '.join(meta['use_cases'])}"
                ),
                "tags": ["family", family_name.lower(), meta["department"]],
                "link": f"/family/{family_name.lower()}",
            }
        )

    docs.append(
        {
            "source_id": "workflow:submit-asset",
            "title": "Submit a New Asset",
            "text": (
                "To submit a NEW asset to Aimplify, go to the Submit page (/submit) and fill out the "
                "submission form. Once submitted, it is scored automatically by AI agents (relevance, "
                "technical quality, description quality, demo readiness, duplicate check, document "
                "validation, video validation) plus a pre-approval checklist. A composite score of 60 or "
                "higher sends the submission to the admin review queue (Manual Approval); below 60 the "
                "submitter is asked to revise and resubmit (Needs Changes). Once an admin approves it, "
                "the platform Owner publishes it, at which point it becomes visible in the public Catalog."
            ),
            "tags": ["workflow", "submit", "new-submission"],
            "link": "/submit",
        }
    )
    docs.append(
        {
            "source_id": "workflow:track-submissions",
            "title": "Track Your Submissions (Pipeline)",
            "text": (
                "To check the STATUS of assets you have already submitted — how many you've submitted, "
                "where each one is in review (Submitted, AI Review, Manual Approval, Needs Changes, "
                "Approved, Published), or any AI feedback on them — go to the Pipeline page (/pipeline). "
                "This is different from the Submit page, which is only for creating a brand-new submission. "
                "The knowledge bot itself does not have access to any individual user's personal submission "
                "history (that is permission-scoped, per-user data — see Aimplify Knowledge Bot Plan §3), so "
                "for 'how many have I submitted' or 'what's the status of mine' questions, the Pipeline page "
                "is where the real answer lives, not this chat."
            ),
            "tags": ["workflow", "pipeline", "track", "status", "my submissions"],
            "link": "/pipeline",
        }
    )
    docs.append(
        {
            "source_id": "workflow:clone-request",
            "title": "How clone requests work",
            "text": (
                "A clone request lets a user ask to reuse a published asset's code/artifacts for a new "
                "project. The asset owner is notified and can approve or deny the request; an approved "
                "request issues a time-limited redemption token."
            ),
            "tags": ["workflow", "clone", "reuse"],
            "link": "/catalog",
        }
    )
    docs.append(
        {
            "source_id": "workflow:demo-request",
            "title": "How demo requests work",
            "text": (
                "A demo request lets a user ask for a live demo of a published asset for a customer or "
                "project. It goes through an approval workflow before being marked fulfilled."
            ),
            "tags": ["workflow", "demo"],
            "link": "/catalog",
        }
    )
    return docs


async def index_platform_docs() -> None:
    for doc in _platform_docs():
        summary, keywords = await _generate_summary_and_keywords(doc["text"])
        embedding = await embed_text(f"{doc['title']}\n{doc['text']}")
        await aiv_vector_client.upsert_chunk(
            source_type="platform_doc",
            source_id=doc["source_id"],
            text=doc["text"],
            summary=summary,
            tags=sorted(set(doc["tags"])),
            keywords=keywords,
            embedding=embedding,
            link=doc["link"],
            title=doc["title"],
        )
    logger.info("[knowledge-bot] indexed %d platform docs", len(_platform_docs()))
