from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import PortalSetting, UserProfile
from app.deps.rbac import require_role
from app.schemas.portal_settings import PortalContent

router = APIRouter(prefix="/portal-settings", tags=["Portal settings"])
SETTING_KEY = "portal_content"


@router.get("", response_model=PortalContent)
async def get_portal_settings(db: AsyncSession = Depends(get_db)):
    from app.routers.catalog import default_portal_content
    setting = (await db.execute(select(PortalSetting).where(PortalSetting.key == SETTING_KEY))).scalar_one_or_none()
    defaults = default_portal_content()
    if not setting:
        return PortalContent.model_validate(defaults)
    stored = setting.value or {}
    merged = {**defaults, **stored, "banners": {**defaults["banners"], **stored.get("banners", {})}}
    requested_order = [name for name in merged.get("family_order", []) if name in {item.get("id") for item in merged.get("families", [])}]
    requested_order.extend(item["id"] for item in merged.get("families", []) if item.get("id") not in requested_order)
    family_by_id = {item["id"]: item for item in merged.get("families", [])}
    merged["family_order"] = requested_order
    merged["families"] = [family_by_id[name] for name in requested_order]
    return PortalContent.model_validate(merged)


@router.put("", response_model=PortalContent)
async def update_portal_settings(
    payload: PortalContent,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = require_role("Aimplify.Owner"),
):
    setting = (await db.execute(select(PortalSetting).where(PortalSetting.key == SETTING_KEY))).scalar_one_or_none()
    if setting is None:
        setting = PortalSetting(key=SETTING_KEY, value=payload.model_dump(), updated_by=user.id)
        db.add(setting)
    else:
        setting.value = payload.model_dump()
        setting.updated_by = user.id
    await db.commit()
    return payload
