from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import text
from app.db.base import get_db
from app.db.models import ActivityLog, UserProfile
from app.deps.rbac import require_role
from app.schemas.user import UserListResponse, UserProfileResponse, UserRoleUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/users", tags=["Users"])


def _to_response(u: UserProfile) -> UserProfileResponse:
    return UserProfileResponse(
        id=u.id,
        email=u.email,
        display_name=u.display_name,
        role=u.role.value if hasattr(u.role, "value") else u.role,
        role_locked=u.role_locked,
        department=u.department,
        last_login=u.last_login,
        created_at=u.created_at,
    )


@router.get("", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
) -> UserListResponse:
    stmt = select(UserProfile)
    if role:
        stmt = stmt.where(UserProfile.role == role)
    if department:
        stmt = stmt.where(UserProfile.department == department)
    if search:
        term = f"%{search}%"
        stmt = stmt.where(
            UserProfile.email.ilike(term) | UserProfile.display_name.ilike(term)
        )

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    result = await db.execute(stmt.order_by(UserProfile.created_at.desc()).offset(skip).limit(limit))
    return UserListResponse(items=[_to_response(u) for u in result.scalars().all()], total=total)


@router.patch("/{user_id}/role", response_model=UserProfileResponse)
async def update_user_role(
    user_id: str,
    body: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=require_role("Aimplify.Owner"),
) -> UserProfileResponse:
    # Self-promotion guard
    if str(user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own role.",
        )

    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    target = result.scalars().first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    old_role = target.role.value if hasattr(target.role, "value") else target.role
    target.role = body.role
    target.department = body.department
    # Lock the role so Azure AD sync doesn't overwrite it on next login.
    # Set role_locked=False only when the caller explicitly wants to re-sync with AAD.
    target.role_locked = getattr(body, "role_locked", True)

    db.add(ActivityLog(
        actor_id=current_user.id,
        action="role_changed",
        entity_type="user",
        entity_id=target.id,
        metadata={
            "old_role": old_role,
            "new_role": body.role,
            "role_locked": target.role_locked,
            "changed_by_email": current_user.email,
        },
    ))

    return _to_response(target)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=require_role("Aimplify.Owner"),
) -> None:
    if str(user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot delete your own account.",
        )

    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    target = result.scalars().first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Block deletion if the user owns any catalog assets
    asset_count = (await db.execute(
        text("SELECT COUNT(*) FROM catalog_assets WHERE owner_id = :uid"),
        {"uid": user_id},
    )).scalar_one()
    if asset_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete user — they own {asset_count} catalog asset(s). Reassign or delete those assets first.",
        )

    # Block deletion if the user has active submissions
    submission_count = (await db.execute(
        text("SELECT COUNT(*) FROM submissions WHERE submitter_id = :uid AND status NOT IN ('Rejected', 'Archived')"),
        {"uid": user_id},
    )).scalar_one()
    if submission_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete user — they have {submission_count} active submission(s). Resolve those first.",
        )

    db.add(ActivityLog(
        actor_id=current_user.id,
        action="user_deleted",
        entity_type="user",
        entity_id=target.id,
        metadata={"deleted_email": target.email, "deleted_by": current_user.email},
    ))

    await db.delete(target)
    await db.commit()
