from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., min_length=5, max_length=320)
    comment: str = Field(..., min_length=5, max_length=2000)


class FeedbackOut(BaseModel):
    id: uuid.UUID
    asset_id: uuid.UUID
    name: str
    email: str
    comment: str
    created_at: datetime

    model_config = {"from_attributes": True}
