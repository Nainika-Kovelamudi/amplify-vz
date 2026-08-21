from datetime import datetime
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class SubmissionCreate(BaseModel):
    title: str
    description: str
    family: str
    department: str
    tech_stack: List[str] = []
    collaborators: List[str] = []
    cloud_provider: Optional[str] = None
    maturity: str
    demo_ready: bool = False
    video_url: Optional[str] = None
    video_urls: List[str] = []
    demo_url: Optional[str] = None
    repo_url: Optional[str] = None
    dependencies: Optional[str] = None
    commands: List[str] = []
    # Section 1 — submitter info
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    designation: Optional[str] = None
    # Classification
    category: Optional[str] = None
    # Attachments
    architecture_file_url: Optional[str] = None
    # Re-submission of an existing published asset
    catalog_asset_id: Optional[str] = None


class SubmissionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    family: Optional[str] = None
    department: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    collaborators: Optional[List[str]] = None
    cloud_provider: Optional[str] = None
    maturity: Optional[str] = None
    demo_ready: Optional[bool] = None
    video_url: Optional[str] = None
    video_urls: Optional[List[str]] = None
    demo_url: Optional[str] = None
    repo_url: Optional[str] = None
    dependencies: Optional[str] = None
    commands: Optional[List[str]] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    designation: Optional[str] = None
    category: Optional[str] = None
    architecture_file_url: Optional[str] = None


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    family: str
    department: str
    tech_stack: Optional[List[str]] = []
    collaborators: Optional[List[str]] = []
    cloud_provider: Optional[str] = None
    maturity: str
    demo_ready: bool
    video_url: Optional[str] = None
    video_urls: Optional[List[str]] = []
    demo_url: Optional[str] = None
    repo_url: Optional[str] = None
    dependencies: Optional[str] = None
    commands: Optional[List[str]] = []
    status: str
    ai_score: Optional[int] = None
    ai_feedback: Optional[Any] = None
    admin_notes: Optional[str] = None
    submitter_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Section 1
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    designation: Optional[str] = None
    category: Optional[str] = None
    architecture_file_url: Optional[str] = None


class SubmissionListResponse(BaseModel):
    items: List[SubmissionResponse]
    total: int
