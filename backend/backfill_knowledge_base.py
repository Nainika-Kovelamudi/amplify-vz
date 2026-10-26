"""
backfill_knowledge_base.py
---------------------------
One-time backfill for the Aimplify Knowledge Bot (docs/knowledge-bot-plan.md, Phase 0).

Indexes every currently-Published CatalogAsset plus the static platform docs
(family taxonomy, workflow explanations) into the shared AIV vector DB.

Safe to re-run: ingestion upserts by (namespace, source_type, source_id).

Usage:
    python backfill_knowledge_base.py
"""

import asyncio
import logging

from sqlalchemy import select

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("backfill_knowledge_base")


async def main() -> None:
    from app.config import get_settings, load_secrets
    await load_secrets(get_settings())
    from app.db.base import get_session_factory
    from app.db.models import AssetStatus, CatalogAsset
    from app.services.knowledge.ingestion_service import index_catalog_asset, index_platform_docs

    logger.info("Indexing static platform docs (family taxonomy, workflows)...")
    await index_platform_docs()

    async with get_session_factory()() as db:
        result = await db.execute(select(CatalogAsset).where(CatalogAsset.status == AssetStatus.Published))
        assets = result.scalars().all()

    logger.info("Indexing %d published catalog assets...", len(assets))
    indexed, failed = 0, 0
    for asset in assets:
        try:
            await index_catalog_asset(asset)
            indexed += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            logger.error("Failed to index asset %s (%s): %s", asset.id, asset.title, exc)

    logger.info("Backfill complete — indexed=%d failed=%d", indexed, failed)


if __name__ == "__main__":
    asyncio.run(main())
