from datetime import datetime
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_email: Optional[str] = None
    actor_display_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[UUID] = None
    metadata: Optional[Any] = None
    created_at: datetime


class ActivityLogListResponse(BaseModel):
    items: List[ActivityLogResponse]
    total: int
    page: int
    page_size: int
