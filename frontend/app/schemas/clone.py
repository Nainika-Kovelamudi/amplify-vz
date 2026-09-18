from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator


class CloneRequestCreate(BaseModel):
    asset_id: UUID
    reason: str
    environment: str
    purpose: Optional[str] = None
    customer_name: Optional[str] = None
    project_name: Optional[str] = None   # Customer Demo: project/engagement name
    is_internal: Optional[bool] = None   # Customer Demo: True=Internal, False=External

    @field_validator("reason")
    @classmethod
    def reason_min_length(cls, v: str) -> str:
        if len(v) < 20:
            raise ValueError("reason must be at least 20 characters long")
        return v


class CloneRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    status: str
    reason: str
    environment: str
    purpose: Optional[str] = None
    customer_name: Optional[str] = None
    project_name: Optional[str] = None
    is_internal: Optional[bool] = None
    created_at: datetime
    decided_at: Optional[datetime] = None
    asset_title: Optional[str] = None
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    clone_token_uuid: Optional[str] = None


class CloneTokenRedeemResponse(BaseModel):
    download_url: str
    expires_at: datetime
    asset_title: str
