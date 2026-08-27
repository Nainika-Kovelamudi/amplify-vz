from fastapi import APIRouter

from app.deps.rbac import require_role
from app.services.aiv_ideation_service import list_approved_ideations

router = APIRouter(prefix="/integrations", tags=["Integrations"])


@router.get("/aiv/ideations")
async def approved_aiv_ideations(
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> dict:
    return {"items": await list_approved_ideations()}
