from __future__ import annotations

import logging
import uuid as _uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, AssetStatus, CatalogAsset, CloneRequest, CloneStatus, CloneToken, UserRole
from app.deps.rbac import require_role
from app.schemas.clone import CloneRequestCreate, CloneRequestResponse, CloneTokenRedeemResponse
from app.services.notification_service import push_notification

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Clone"])


def _to_response(
    cr: CloneRequest,
    asset: CatalogAsset | None = None,
    requester=None,
    clone_token_uuid: str | None = None,
) -> CloneRequestResponse:
    return CloneRequestResponse(
        id=cr.id,
        asset_id=cr.asset_id,
        status=cr.status.value if hasattr(cr.status, "value") else cr.status,
        reason=cr.reason,
        environment=cr.environment.value if hasattr(cr.environment, "value") else cr.environment,
        purpose=cr.purpose,
        customer_name=cr.customer_name,
        project_name=cr.project_name,
        is_internal=cr.is_internal,
        created_at=cr.created_at,
        decided_at=cr.decided_at,
        asset_title=asset.title if asset else None,
        requester_name=requester.display_name if requester else None,
        requester_email=requester.email if requester else None,
        clone_token_uuid=clone_token_uuid,
    )


@router.post("/clone-requests", response_model=CloneRequestResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_clone_request(
    body: CloneRequestCreate,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> CloneRequestResponse:
    from app.services.email_service import send_clone_request_email
    from app.config import get_settings

    asset_result = await db.execute(
        select(CatalogAsset).where(CatalogAsset.id == body.asset_id)
    )
    asset = asset_result.scalars().first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    if asset.status != AssetStatus.Published:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset is not published.")

    clone_req = CloneRequest(
        asset_id=body.asset_id,
        requester_id=user.id,
        reason=body.reason,
        environment=body.environment,
        purpose=body.purpose,
        customer_name=body.customer_name,
        project_name=body.project_name,
        is_internal=body.is_internal,
        status=CloneStatus.Pending,
        owner_notified_at=datetime.now(tz=timezone.utc),
    )
    db.add(clone_req)
    db.add(ActivityLog(
        actor_id=user.id,
        action="clone_requested",
        entity_type="clone_request",
        log_metadata={"asset_id": str(body.asset_id)},
    ))
    await db.flush()
    await db.refresh(clone_req)

    # Notify owner (and admins)
    from sqlalchemy import select as _select
    from app.db.models import UserProfile
    owner_result = await db.execute(_select(UserProfile).where(UserProfile.id == asset.owner_id))
    owner = owner_result.scalars().first()
    settings = get_settings()
    approve_url = f"{settings.frontend_url}/api/clone-requests/{clone_req.id}/approve"
    deny_url = f"{settings.frontend_url}/api/clone-requests/{clone_req.id}/deny"

    recipients: list[str] = []
    if owner:
        recipients.append(owner.email)
    # Also notify all platform admins
    admin_result = await db.execute(
        _select(UserProfile).where(UserProfile.role == UserRole.admin)
    )
    for admin in admin_result.scalars().all():
        if admin.email not in recipients:
            recipients.append(admin.email)

    for email in recipients:
        try:
            await send_clone_request_email(
                email, user.display_name or user.email,
                asset.title, body.reason, approve_url, deny_url,
            )
        except Exception as exc:
            logger.warning("Failed to send clone request email to %s: %s", email, exc)

    return _to_response(clone_req)


@router.get("/clone-requests/all", response_model=list[CloneRequestResponse])
async def get_all_clone_requests(
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> list[CloneRequestResponse]:
    """Admin/Owner: read-only view of every clone request across all assets."""
    from app.db.models import UserProfile
    rows = (await db.execute(
        select(CloneRequest, CatalogAsset, UserProfile)
        .join(CatalogAsset, CatalogAsset.id == CloneRequest.asset_id)
        .join(UserProfile, UserProfile.id == CloneRequest.requester_id)
        .order_by(CloneRequest.created_at.desc())
    )).all()
    return [_to_response(cr, asset, requester) for cr, asset, requester in rows]


@router.get("/clone-requests/incoming", response_model=list[CloneRequestResponse])
async def get_incoming_clone_requests(
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> list[CloneRequestResponse]:
    """Clone requests for assets owned by the current user."""
    from app.db.models import UserProfile
    rows = (await db.execute(
        select(CloneRequest, CatalogAsset, UserProfile)
        .join(CatalogAsset, CatalogAsset.id == CloneRequest.asset_id)
        .join(UserProfile, UserProfile.id == CloneRequest.requester_id)
        .where(CatalogAsset.owner_id == user.id)
        .order_by(CloneRequest.created_at.desc())
    )).all()
    return [_to_response(cr, asset, requester) for cr, asset, requester in rows]


@router.get("/clone-requests/mine", response_model=list[CloneRequestResponse])
async def get_my_clone_requests(
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> list[CloneRequestResponse]:
    # Use explicit LEFT JOIN on CloneToken — selectinload is unreliable on multi-entity selects
    rows = (await db.execute(
        select(CloneRequest, CatalogAsset, CloneToken)
        .outerjoin(CatalogAsset, CatalogAsset.id == CloneRequest.asset_id)
        .outerjoin(CloneToken, CloneToken.clone_request_id == CloneRequest.id)
        .where(CloneRequest.requester_id == user.id)
        .order_by(CloneRequest.created_at.desc())
    )).all()
    results = []
    for cr, asset, token in rows:
        token_uuid = str(token.token_uuid) if token is not None else None
        results.append(_to_response(cr, asset, clone_token_uuid=token_uuid))
    return results


async def _assert_can_decide(clone_req: CloneRequest, asset: CatalogAsset, user) -> None:
    """Asset owner, admins, and platform owners can approve or deny clone requests."""
    is_admin = user.role in (UserRole.admin, UserRole.owner)
    if str(asset.owner_id) != str(user.id) and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the asset creator or an admin can approve or deny access requests.",
        )


@router.patch("/clone-requests/{clone_id}/approve", response_model=CloneRequestResponse)
async def approve_clone_request(
    clone_id: str,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> CloneRequestResponse:
    from app.services.email_service import send_clone_approved_email
    from app.config import get_settings

    cr_result = await db.execute(select(CloneRequest).where(CloneRequest.id == clone_id))
    clone_req = cr_result.scalars().first()
    if not clone_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clone request not found.")

    if clone_req.status != CloneStatus.Pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Request is already '{clone_req.status}'.")

    asset_result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == clone_req.asset_id))
    asset = asset_result.scalars().first()
    await _assert_can_decide(clone_req, asset, user)

    clone_req.status = CloneStatus.Approved
    clone_req.decided_at = datetime.now(tz=timezone.utc)

    # Create 24h token
    token = CloneToken(
        clone_request_id=clone_req.id,
        token_uuid=_uuid.uuid4(),
        expires_at=datetime.now(tz=timezone.utc) + timedelta(days=7),
    )
    db.add(token)
    db.add(ActivityLog(
        actor_id=user.id,
        action="clone_approved",
        entity_type="clone_request",
        entity_id=clone_req.id,
    ))
    await db.flush()
    await db.refresh(token)

    # Email requester
    from app.db.models import UserProfile
    req_result = await db.execute(select(UserProfile).where(UserProfile.id == clone_req.requester_id))
    requester = req_result.scalars().first()
    if requester:
        settings = get_settings()
        download_url = f"{settings.frontend_url}/clone/token/{token.token_uuid}"
        try:
            await send_clone_approved_email(
                requester.email, asset.title, download_url,
                token.expires_at.isoformat(),
            )
        except Exception as exc:
            logger.warning("Failed to send clone approval email: %s", exc)

    await push_notification(
        db, str(clone_req.requester_id),
        "Clone Request Approved ✅",
        f'Your clone request for "{asset.title if asset else "an asset"}" has been approved. Check your email for the repo link.',
        "clone_approved", str(clone_req.id),
    )
    await db.commit()
    return _to_response(clone_req, asset, clone_token_uuid=str(token.token_uuid))


@router.patch("/clone-requests/{clone_id}/deny", response_model=CloneRequestResponse)
async def deny_clone_request(
    clone_id: str,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> CloneRequestResponse:
    from app.services.email_service import send_clone_denied_email

    cr_result = await db.execute(select(CloneRequest).where(CloneRequest.id == clone_id))
    clone_req = cr_result.scalars().first()
    if not clone_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clone request not found.")

    if clone_req.status != CloneStatus.Pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Request is already '{clone_req.status}'.")

    asset_result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == clone_req.asset_id))
    asset = asset_result.scalars().first()
    await _assert_can_decide(clone_req, asset, user)

    clone_req.status = CloneStatus.Denied
    clone_req.decided_at = datetime.now(tz=timezone.utc)

    db.add(ActivityLog(actor_id=user.id, action="clone_denied", entity_type="clone_request", entity_id=clone_req.id))
    await db.flush()

    from app.db.models import UserProfile
    req_result = await db.execute(select(UserProfile).where(UserProfile.id == clone_req.requester_id))
    requester = req_result.scalars().first()
    if requester:
        try:
            await send_clone_denied_email(requester.email, asset.title)
        except Exception as exc:
            logger.warning("Failed to send clone denial email: %s", exc)

    await push_notification(
        db, str(clone_req.requester_id),
        "Clone Request Denied ❌",
        f'Your clone request for "{asset.title if asset else "an asset"}" was not approved.',
        "clone_denied", str(clone_req.id),
    )
    await db.commit()
    return _to_response(clone_req)


@router.patch("/clone-requests/{clone_id}/cancel", response_model=CloneRequestResponse)
async def cancel_clone_request(
    clone_id: str,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> CloneRequestResponse:
    """Requester cancels their own pending clone request (only before approval)."""
    cr_result = await db.execute(select(CloneRequest).where(CloneRequest.id == clone_id))
    clone_req = cr_result.scalars().first()
    if not clone_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clone request not found.")
    if str(clone_req.requester_id) != str(user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only cancel your own clone requests.")
    if clone_req.status != CloneStatus.Pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel — request is already '{clone_req.status.value}'.",
        )

    clone_req.status = CloneStatus.Cancelled
    clone_req.decided_at = datetime.now(tz=timezone.utc)

    db.add(ActivityLog(
        actor_id=user.id,
        action="clone_cancelled",
        entity_type="clone_request",
        entity_id=clone_req.id,
    ))
    await db.flush()

    asset_result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == clone_req.asset_id))
    asset = asset_result.scalars().first()
    return _to_response(clone_req, asset)


@router.post("/clone-requests/{clone_id}/resend-link", response_model=CloneRequestResponse)
async def resend_clone_link(
    clone_id: str,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> CloneRequestResponse:
    """Re-send the approval email for an already-approved clone request."""
    from app.services.email_service import send_clone_approved_email
    from app.config import get_settings

    cr_result = await db.execute(select(CloneRequest).where(CloneRequest.id == clone_id))
    clone_req = cr_result.scalars().first()
    if not clone_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clone request not found.")
    if clone_req.requester_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your request.")
    if clone_req.status != CloneStatus.Approved:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is not approved yet.")

    # Find (or refresh) the associated token
    from app.db.models import CloneToken as _CloneToken
    token_result = await db.execute(
        select(_CloneToken).where(_CloneToken.clone_request_id == clone_req.id)
    )
    token = token_result.scalars().first()
    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No token found for this request.")

    # Extend expiry if already expired
    now = datetime.now(tz=timezone.utc)
    if token.expires_at.replace(tzinfo=timezone.utc) < now:
        token.expires_at = now + timedelta(days=7)
        token.redeemed_at = None
        await db.flush()

    asset_result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == clone_req.asset_id))
    asset = asset_result.scalars().first()

    from app.db.models import UserProfile
    req_result = await db.execute(select(UserProfile).where(UserProfile.id == clone_req.requester_id))
    requester = req_result.scalars().first()
    if requester:
        settings = get_settings()
        download_url = f"{settings.frontend_url}/clone/token/{token.token_uuid}"
        try:
            await send_clone_approved_email(
                requester.email, asset.title, download_url,
                token.expires_at.isoformat(),
            )
        except Exception as exc:
            logger.warning("Failed to resend clone approval email: %s", exc)

    return _to_response(clone_req, asset, clone_token_uuid=str(token.token_uuid))


@router.get("/clone/token/{token_uuid}", response_model=CloneTokenRedeemResponse)
async def redeem_clone_token(
    token_uuid: str,
    db: AsyncSession = Depends(get_db),
) -> CloneTokenRedeemResponse:

    result = await db.execute(select(CloneToken).where(CloneToken.token_uuid == token_uuid))
    token = result.scalars().first()
    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found.")

    now = datetime.now(tz=timezone.utc)
    if token.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=410, detail="Token expired.")

    if token.redeemed_at is None:
        token.redeemed_at = now
        await db.flush()

    cr_result = await db.execute(select(CloneRequest).where(CloneRequest.id == token.clone_request_id))
    clone_req = cr_result.scalars().first()
    asset_result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == clone_req.asset_id))
    asset = asset_result.scalars().first()

    # Return the GitHub repo URL directly — actual GitHub collaborator access
    # is granted manually by the asset creator outside this platform.
    repo_url = asset.repo_url or ""

    return CloneTokenRedeemResponse(
        download_url=repo_url,
        expires_at=token.expires_at,
        asset_title=asset.title,
    )
