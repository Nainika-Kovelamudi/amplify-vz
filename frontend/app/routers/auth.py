from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.base import get_db
from app.db.models import ActivityLog, UserProfile, UserRole
from app.deps.auth import validate_azure_token
from app.deps.jwt import create_app_jwt
from app.deps.rbac import get_current_user
from app.schemas.auth import AppJWTResponse, AzureTokenRequest, UserMeResponse
from pydantic import BaseModel


class DevLoginRequest(BaseModel):
    email: str = "owner@amplify.local"

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])


async def _upsert_user(claims: dict, db: AsyncSession) -> UserProfile:
    """Create or update UserProfile from Azure AD token claims.
    Role is synced from AAD App Role on every login — AAD is the source of truth.
    Owner (super_admin) can override roles manually via the admin UI; those
    overrides are stored in the DB but will be reset on next AAD login if the
    AAD role differs. To make overrides permanent, assign the AAD App Role.
    """
    oid = claims["oid"]
    email = claims.get("email", "")
    name = claims.get("name", "")
    # Role derived from AAD App Roles claim (mapped in auth.py)
    aad_role_str = claims.get("app_role", "Aimplify.User")
    try:
        aad_role = UserRole(aad_role_str)
    except ValueError:
        aad_role = UserRole.user

    result = await db.execute(select(UserProfile).where(UserProfile.azure_oid == oid))
    user = result.scalars().first()

    now = datetime.now(tz=timezone.utc)

    if user is None:
        user = UserProfile(
            azure_oid=oid,
            email=email,
            display_name=name,
            role=aad_role,
            last_login=now,
        )
        db.add(user)
    else:
        user.last_login = now
        user.email = email
        if name:
            user.display_name = name
        # Only sync role from AAD if it hasn't been manually pinned via the app.
        # role_locked = True means an Owner set it in RoleManager — respect that.
        if not user.role_locked:
            user.role = aad_role

    await db.flush()
    await db.refresh(user)
    return user


async def _log_activity(action: str, actor_id, db: AsyncSession) -> None:
    log = ActivityLog(
        actor_id=actor_id,
        action=action,
        entity_type="user",
        entity_id=actor_id,
    )
    db.add(log)


@router.post("/login", response_model=AppJWTResponse)
async def login(
    body: AzureTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> AppJWTResponse:
    claims = await validate_azure_token(authorization=f"Bearer {body.azure_token}")
    user = await _upsert_user(claims, db)
    await _log_activity("user_login", user.id, db)
    token = create_app_jwt(user)
    return AppJWTResponse(access_token=token)


@router.post("/refresh", response_model=AppJWTResponse)
async def refresh(
    user=Depends(get_current_user),
) -> AppJWTResponse:
    token = create_app_jwt(user)
    return AppJWTResponse(access_token=token)


@router.delete("/session", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await _log_activity("user_logout", user.id, db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/dev-login", response_model=AppJWTResponse, include_in_schema=True)
async def dev_login(
    body: DevLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AppJWTResponse:
    """Local dev only — bypasses Azure AD. Enabled when DEV_AUTH_BYPASS=true."""
    settings = get_settings()
    if not settings.dev_auth_bypass:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")

    result = await db.execute(select(UserProfile).where(UserProfile.email == body.email))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user with email '{body.email}'. Seed one via schema.sql first.",
        )

    user.last_login = datetime.now(tz=timezone.utc)
    await db.flush()
    await _log_activity("user_login_dev", user.id, db)
    token = create_app_jwt(user)
    return AppJWTResponse(access_token=token)


@router.get("/me", response_model=UserMeResponse)
async def get_me(user=Depends(get_current_user)) -> UserMeResponse:
    return UserMeResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        role=user.role.value if hasattr(user.role, "value") else user.role,
        department=user.department,
        last_login=user.last_login,
    )
