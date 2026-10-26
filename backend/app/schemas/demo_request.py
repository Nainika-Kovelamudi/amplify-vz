from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class DemoRequestCreate(BaseModel):
    asset_id: UUID
    customer_name: str
    project_name: str
    vertical: Optional[str] = None
    additional_details: Optional[str] = None


class DemoRequestDecision(BaseModel):
    notes: Optional[str] = None


class MultiDemoRequestCreate(BaseModel):
    asset_ids: list[UUID] = Field(default_factory=list, max_length=100)
    platform_demo: bool = False
    customer_name: str = Field(min_length=1, max_length=200)
    project_name: str = Field(min_length=1, max_length=200)
    vertical: Optional[str] = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def require_selection(self):
        if not self.asset_ids and not self.platform_demo:
            raise ValueError("Select an asset or AImplify Platform Demo.")
        return self

    @field_validator("customer_name", "project_name")
    @classmethod
    def require_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field is required.")
        return value.strip()


class PlatformFeedbackCreate(BaseModel):
    asset_id: Optional[UUID] = None  # None means feedback about AImplify Platform.
    comment: str = Field(min_length=1, max_length=5000)

    @field_validator("comment")
    @classmethod
    def require_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Feedback is required.")
        return value.strip()


class DemoRequestResponse(BaseModel):
    id: UUID
    batch_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    request_type: str = "asset"
    asset_title: Optional[str] = None
    asset_slug: Optional[str] = None
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    customer_name: str
    project_name: str
    vertical: Optional[str] = None
    additional_details: Optional[str] = None
    status: str = "Pending"
    decision_notes: Optional[str] = None
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    requested_at: datetime

    model_config = {"from_attributes": True}
