"""Optional background initialization; missing bot settings never block startup."""
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


async def initialize_knowledge() -> None:
    settings = get_settings()
    if not (settings.aiv_mongodb_url and settings.aiv_mongodb_db_name and settings.gemini_api_key):
        return
    try:
        from app.services.knowledge.ingestion_service import index_platform_docs
        await index_platform_docs()
    except Exception:
        logger.exception("Knowledge bot platform indexing failed")
