from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CatalogAsset


async def next_catalog_code(db: AsyncSession, family: str) -> str:
    prefix = {"forge": "FOR", "atlas": "ATL", "sentinel": "SNT", "titan": "TIT"}.get(
        (family or "").strip().lower(), (family or "AST")[:3].upper()
    )
    await db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"), {"lock_key": f"catalog-code-{prefix}"})
    codes = (await db.execute(select(CatalogAsset.catalog_code).where(CatalogAsset.catalog_code.like(f"{prefix}-%")))).scalars()
    numbers = []
    for code in codes:
        suffix = (code or "").removeprefix(f"{prefix}-")
        if suffix.isdigit():
            numbers.append(int(suffix))
    return f"{prefix}-{max(numbers, default=0) + 1:03d}"
