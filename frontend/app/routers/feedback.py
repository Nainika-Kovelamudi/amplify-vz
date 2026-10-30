from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db as get_session
from app.db.models import AssetFeedback, CatalogAsset
from app.schemas.feedback import FeedbackCreate, FeedbackOut

from app.deps.rbac import get_current_user
router = APIRouter(prefix="/catalog", tags=["feedback"], dependencies=[Depends(get_current_user)])


async def _get_asset(asset_id: uuid.UUID, db: AsyncSession) -> CatalogAsset:
    result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


@router.get("/{asset_id}/feedback", response_model=list[FeedbackOut])
async def list_feedback(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
) -> list[FeedbackOut]:
    await _get_asset(asset_id, db)
    result = await db.execute(
        select(AssetFeedback)
        .where(AssetFeedback.asset_id == asset_id)
        .order_by(AssetFeedback.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{asset_id}/feedback", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    asset_id: uuid.UUID,
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_session),
) -> FeedbackOut:
    await _get_asset(asset_id, db)
    fb = AssetFeedback(
        asset_id=asset_id,
        name=body.name,
        email=body.email,
        comment=body.comment,
    )
    db.add(fb)
    await db.commit()
    await db.refresh(fb)
    return fb
