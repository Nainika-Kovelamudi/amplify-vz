import logging
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.deps.jwt import decode_app_jwt

logger = logging.getLogger(__name__)

ROLE_HIERARCHY: dict[str, int] = {
    "Aimplify.User": 1,
    "Aimplify.Admin": 2,
    "Aimplify.Owner": 3,
}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request = None,
):
    """Decode bearer JWT and load UserProfile from DB. Raises 401 if missing/invalid."""
    from app.db.models import UserProfile
    from sqlalchemy import text

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = await decode_app_jwt(token)
    user_id: str = claims.get("sub", "")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    user = result.scalars().first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from app.services.asset_lifecycle import enforce_request_lifecycle
    await enforce_request_lifecycle(request, user, db)

    # Eagerly access all scalar columns now, while we're inside the async session,
    # so the object is fully hydrated and won't trigger a lazy-load later.
    _ = (user.id, user.email, user.display_name, user.role, user.department,
         user.created_at, user.updated_at)
    # Expunge from session so SQLAlchemy won't try to lazy-reload any attribute
    # after this dependency's session context ends.
    from sqlalchemy.orm import make_transient
    db.expunge(user)
    make_transient(user)
    return user


def require_role(*roles: str):
    """
    Dependency factory — allow only users whose role is in *roles*.

    Usage::
        @router.post("/submit", dependencies=[Depends(require_role("guest", "admin", "super_admin"))])
    """
    allowed = set(roles)

    async def _check(user=Depends(get_current_user)):
        role_val = user.role.value if hasattr(user.role, "value") else user.role
        if role_val not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access requires one of the following roles: {sorted(allowed)}.",
            )
        return user

    return Depends(_check)


def require_min_level(level: int):
    """Dependency factory — allow only users whose role level >= *level*."""

    async def _check(user=Depends(get_current_user)):
        role_val = user.role.value if hasattr(user.role, "value") else user.role
        if ROLE_HIERARCHY.get(role_val, 0) < level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access requires role level {level} or higher.",
            )
        return user

    return Depends(_check)


def dept_check(resource_dept: str, user) -> None:
    """
    Raise HTTP 403 if the user should not access *resource_dept*.
    super_admin: unrestricted. admin: own dept only.
    """
    role_val = user.role.value if hasattr(user.role, "value") else user.role

    if role_val == "Aimplify.Owner":
        return

    if role_val == "Aimplify.Admin":
        if user.department != resource_dept:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins can only access resources within their own department.",
            )
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions for cross-department access.",
    )
