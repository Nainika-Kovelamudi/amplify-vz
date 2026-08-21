from __future__ import annotations

import logging
import uuid as _uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import AssetStatus, CatalogAsset, DemoRequest, UserProfile, UserRole
from app.deps.rbac import get_current_user, require_role
from app.schemas.demo_request import DemoRequestCreate, DemoRequestResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Demo Requests"])


def _to_response(dr: DemoRequest) -> DemoRequestResponse:
    asset = dr.asset if hasattr(dr, "asset") and dr.asset else None
    requester = dr.requester if hasattr(dr, "requester") and dr.requester else None
    return DemoRequestResponse(
        id=dr.id,
        asset_id=dr.asset_id,
        asset_title=asset.title if asset else None,
        asset_slug=asset.slug if asset else None,
        requester_name=requester.display_name if requester else None,
        requester_email=requester.email if requester else None,
        customer_name=dr.customer_name,
        project_name=dr.project_name,
        requested_at=dr.requested_at,
    )


@router.post("/demo-requests", response_model=DemoRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_demo_request(
    body: DemoRequestCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> DemoRequestResponse:
    from app.config import get_settings

    asset_result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == body.asset_id))
    asset = asset_result.scalars().first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    if asset.status != AssetStatus.Published:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset is not published.")

    dr = DemoRequest(
        id=_uuid.uuid4(),
        asset_id=body.asset_id,
        requester_id=user.id,
        customer_name=body.customer_name.strip(),
        project_name=body.project_name.strip(),
        requested_at=datetime.now(timezone.utc),
    )
    db.add(dr)

    # Increment demo_request_count on the asset
    if hasattr(asset, "demo_request_count"):
        asset.demo_request_count = (asset.demo_request_count or 0) + 1

    await db.commit()
    await db.refresh(dr)

    # Send notification email in background
    background_tasks.add_task(
        _notify_demo_request,
        asset_title=asset.title,
        asset_slug=asset.slug,
        requester_name=user.display_name or user.email,
        requester_email=user.email,
        customer_name=body.customer_name,
        project_name=body.project_name,
        asset_owner_email=asset.owner_email,
    )

    return DemoRequestResponse(
        id=dr.id,
        asset_id=dr.asset_id,
        asset_title=asset.title,
        asset_slug=asset.slug,
        requester_name=user.display_name,
        requester_email=user.email,
        customer_name=dr.customer_name,
        project_name=dr.project_name,
        requested_at=dr.requested_at,
    )


@router.get("/demo-requests/my", response_model=list[DemoRequestResponse])
async def get_my_demo_requests(
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> list[DemoRequestResponse]:
    result = await db.execute(
        select(DemoRequest)
        .where(DemoRequest.requester_id == user.id)
        .order_by(DemoRequest.requested_at.desc())
    )
    rows = result.scalars().all()

    # Load related assets/requesters
    out: list[DemoRequestResponse] = []
    for dr in rows:
        asset_res = await db.execute(select(CatalogAsset).where(CatalogAsset.id == dr.asset_id))
        asset = asset_res.scalars().first()
        out.append(DemoRequestResponse(
            id=dr.id,
            asset_id=dr.asset_id,
            asset_title=asset.title if asset else None,
            asset_slug=asset.slug if asset else None,
            requester_name=user.display_name,
            requester_email=user.email,
            customer_name=dr.customer_name,
            project_name=dr.project_name,
            requested_at=dr.requested_at,
        ))
    return out


@router.get("/demo-requests/asset/{asset_id}", response_model=list[DemoRequestResponse])
async def get_demo_requests_for_asset(
    asset_id: _uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> list[DemoRequestResponse]:
    asset_res = await db.execute(select(CatalogAsset).where(CatalogAsset.id == asset_id))
    asset = asset_res.scalars().first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    is_owner = str(asset.owner_id) == str(user.id)
    is_admin_or_owner_role = user.role in (UserRole.admin, UserRole.owner)
    if not is_owner and not is_admin_or_owner_role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

    result = await db.execute(
        select(DemoRequest)
        .where(DemoRequest.asset_id == asset_id)
        .order_by(DemoRequest.requested_at.desc())
    )
    rows = result.scalars().all()

    out: list[DemoRequestResponse] = []
    for dr in rows:
        req_res = await db.execute(select(UserProfile).where(UserProfile.id == dr.requester_id))
        requester = req_res.scalars().first()
        out.append(DemoRequestResponse(
            id=dr.id,
            asset_id=dr.asset_id,
            asset_title=asset.title,
            asset_slug=asset.slug,
            requester_name=requester.display_name if requester else None,
            requester_email=requester.email if requester else None,
            customer_name=dr.customer_name,
            project_name=dr.project_name,
            requested_at=dr.requested_at,
        ))
    return out


@router.get("/demo-requests", response_model=list[DemoRequestResponse])
async def get_all_demo_requests(
    db: AsyncSession = Depends(get_db),
    user: UserProfile = require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> list[DemoRequestResponse]:
    result = await db.execute(
        select(DemoRequest).order_by(DemoRequest.requested_at.desc())
    )
    rows = result.scalars().all()

    out: list[DemoRequestResponse] = []
    for dr in rows:
        asset_res = await db.execute(select(CatalogAsset).where(CatalogAsset.id == dr.asset_id))
        asset = asset_res.scalars().first()
        req_res = await db.execute(select(UserProfile).where(UserProfile.id == dr.requester_id))
        requester = req_res.scalars().first()
        out.append(DemoRequestResponse(
            id=dr.id,
            asset_id=dr.asset_id,
            asset_title=asset.title if asset else None,
            asset_slug=asset.slug if asset else None,
            requester_name=requester.display_name if requester else None,
            requester_email=requester.email if requester else None,
            customer_name=dr.customer_name,
            project_name=dr.project_name,
            requested_at=dr.requested_at,
        ))
    return out


async def _notify_demo_request(
    asset_title: str,
    asset_slug: str,
    requester_name: str,
    requester_email: str,
    customer_name: str,
    project_name: str,
    asset_owner_email: str | None,
) -> None:
    from app.services.email_service import _send, _wrap
    from app.config import get_settings

    settings = get_settings()
    frontend = settings.frontend_url or "https://aimplify-dev.infovision.ai"
    asset_url = f"{frontend}/assets/{asset_slug}"

    body_html = f"""
    <tr><td style="padding:32px 40px 8px;">
      <h2 style="margin:0;font-family:Arial,sans-serif;font-size:20px;color:#1e1b4b;">
        New Customer Demo Request
      </h2>
    </td></tr>
    <tr><td style="padding:8px 40px 24px;font-family:Arial,sans-serif;font-size:14px;color:#374151;line-height:1.6;">
      <p><strong>{requester_name}</strong> ({requester_email}) has raised a customer demo request for
         <strong>{asset_title}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Customer</td>
            <td style="padding:6px 0;font-weight:600;">{customer_name}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Project / Opp</td>
            <td style="padding:6px 0;font-weight:600;">{project_name}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Requested by</td>
            <td style="padding:6px 0;">{requester_name} &lt;{requester_email}&gt;</td></tr>
      </table>
    </td></tr>
    """

    html = _wrap(
        accent_color="#7C3AED",
        accent_label="Demo Request",
        body_html=body_html,
        cta_url=asset_url,
        cta_label="View Asset",
    )

    recipients: list[str] = []
    if asset_owner_email:
        recipients.append(asset_owner_email)

    subject = f"[Amplify] Customer Demo Request — {asset_title}"
    for email in recipients:
        try:
            await _send(email, subject, html)
        except Exception as exc:
            logger.warning("Failed to send demo request notification to %s: %s", email, exc)
