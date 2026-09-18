from datetime import datetime
from typing import Optional, List, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: Optional[str] = None
    role: str
    role_locked: bool = False
    department: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: Literal["Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"]
    department: Optional[str] = None
    role_locked: bool = True  # default: lock on manual save


class UserListResponse(BaseModel):
    items: List[UserProfileResponse]
    total: int
