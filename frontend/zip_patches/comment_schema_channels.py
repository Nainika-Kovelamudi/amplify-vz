from datetime import datetime
from uuid import UUID
from typing import Literal
from pydantic import BaseModel, ConfigDict, field_validator

CommentChannel = Literal["submitter", "internal"]


class CommentCreate(BaseModel):
    body: str
    channel: CommentChannel = "submitter"

    @field_validator("body")
    @classmethod
    def body_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment body cannot be empty")
        if len(v) > 4000:
            raise ValueError("Comment body must be under 4000 characters")
        return v


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    submission_id: UUID
    author_id: UUID
    author_name: str
    author_email: str
    body: str
    channel: CommentChannel
    created_at: datetime
