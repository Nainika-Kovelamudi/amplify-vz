from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import AssetLike, CatalogAsset, AssetStatus, ActivityLog
from app.deps.rbac import get_current_user
from sqlalchemy import update
import uuid as _uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/catalog", tags=["Likes"])


class LikeResponse(BaseModel):
    like_count: int
    liked_by_me: bool


@router.post("/{asset_id}/like", response_model=LikeResponse)
async def toggle_like(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> LikeResponse:
    asset_result = await db.execute(
        select(CatalogAsset).where(
            CatalogAsset.id == asset_id,
            CatalogAsset.status == AssetStatus.Published,
        )
    )
    if not asset_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    existing = (await db.execute(
        select(AssetLike).where(AssetLike.asset_id == asset_id, AssetLike.user_id == user.id)
    )).scalars().first()

    if existing:
        await db.delete(existing)
        liked_by_me = False
    else:
        db.add(AssetLike(asset_id=asset_id, user_id=user.id))
        liked_by_me = True

    await db.commit()

    count_result = await db.execute(
        select(func.count()).select_from(AssetLike).where(AssetLike.asset_id == asset_id)
    )
    like_count = count_result.scalar_one()
    return LikeResponse(like_count=like_count, liked_by_me=liked_by_me)


class CountResponse(BaseModel):
    count: int


async def _get_published_asset(asset_id: UUID, db: AsyncSession) -> CatalogAsset:
    result = await db.execute(
        select(CatalogAsset).where(
            CatalogAsset.id == asset_id,
            CatalogAsset.status == AssetStatus.Published,
        )
    )
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    return asset


@router.post("/{asset_id}/track-download", response_model=CountResponse)
async def track_artifact_download(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> CountResponse:
    asset = await _get_published_asset(asset_id, db)
    await db.execute(
        update(CatalogAsset)
        .where(CatalogAsset.id == asset_id)
        .values(artifact_download_count=CatalogAsset.artifact_download_count + 1)
    )
    await db.commit()
    await db.refresh(asset)
    return CountResponse(count=asset.artifact_download_count or 0)


@router.post("/{asset_id}/track-demo-view", response_model=CountResponse)
async def track_demo_view(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> CountResponse:
    asset = await _get_published_asset(asset_id, db)
    await db.execute(
        update(CatalogAsset)
        .where(CatalogAsset.id == asset_id)
        .values(demo_view_count=CatalogAsset.demo_view_count + 1)
    )
    await db.commit()
    await db.refresh(asset)
    return CountResponse(count=asset.demo_view_count or 0)


@router.post("/{asset_id}/track-view", response_model=CountResponse)
async def track_asset_view(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> CountResponse:
    asset = await _get_published_asset(asset_id, db)
    await db.execute(
        update(CatalogAsset)
        .where(CatalogAsset.id == asset_id)
        .values(view_count=CatalogAsset.view_count + 1)
    )
    db.add(ActivityLog(
        id=_uuid.uuid4(),
        actor_id=user.id,
        action="asset_viewed",
        entity_type="catalog_asset",
        entity_id=asset_id,
        log_metadata={"asset_title": asset.title, "slug": asset.slug},
        created_at=datetime.now(timezone.utc),
    ))
    await db.commit()
    await db.refresh(asset)
    return CountResponse(count=asset.view_count or 0)
