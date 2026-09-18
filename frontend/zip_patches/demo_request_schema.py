from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DemoRequestCreate(BaseModel):
    asset_id: UUID
    customer_name: str
    project_name: str
    vertical: Optional[str] = None
    additional_details: Optional[str] = None


class DemoRequestResponse(BaseModel):
    id: UUID
    asset_id: UUID
    asset_title: Optional[str] = None
    asset_slug: Optional[str] = None
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    customer_name: str
    project_name: str
    vertical: Optional[str] = None
    additional_details: Optional[str] = None
    requested_at: datetime

    model_config = {"from_attributes": True}
