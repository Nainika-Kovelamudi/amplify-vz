from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CatalogAssetBase(BaseModel):
    aiv_ideation_id: Optional[str] = None
    aiv_ideation_title: Optional[str] = None
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
    thumbnail_url: Optional[str] = None
    dependencies: Optional[str] = None
    commands: List[str] = []
    architecture_file_url: Optional[str] = None
    category: Optional[str] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    designation: Optional[str] = None


class CatalogAssetCreate(CatalogAssetBase):
    repo_url: Optional[str] = None  # stored server-side, never returned


class CatalogAssetUpdate(BaseModel):
    aiv_ideation_id: Optional[str] = None
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
    thumbnail_url: Optional[str] = None
    dependencies: Optional[str] = None
    commands: Optional[List[str]] = None
    architecture_file_url: Optional[str] = None
    category: Optional[str] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    designation: Optional[str] = None


class CatalogAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    catalog_code: str
    slug: str
    title: str
    description: str
    family: str
    department: str
    tech_stack: List[str] = []
    collaborators: Optional[List[str]] = []
    cloud_provider: Optional[str] = None
    maturity: str
    demo_ready: bool
    video_url: Optional[str] = None
    video_urls: Optional[List[str]] = []
    demo_url: Optional[str] = None
    repo_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    dependencies: Optional[str] = None
    commands: Optional[List[str]] = []
    architecture_file_url: Optional[str] = None
    category: Optional[str] = None
    status: str
    ai_score: Optional[int] = None
    ai_feedback: Optional[dict] = None
    owner_id: Optional[UUID] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    designation: Optional[str] = None
    aiv_ideation_id: Optional[str] = None
    aiv_ideation_title: Optional[str] = None
    clone_request_count: int = 0
    deployment_count: int = 0
    like_count: int = 0
    liked_by_me: bool = False
    artifact_download_count: int = 0
    demo_view_count: int = 0
    view_count: int = 0
    demo_request_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


class CatalogAssetListResponse(BaseModel):
    items: List[CatalogAssetResponse]
    total: int


class PlatformFamilyResponse(BaseModel):
    id: str
    name: str
    color: Optional[str] = None
    tagline: Optional[str] = None
    department: Optional[str] = None
    description: Optional[str] = None
    long_description: Optional[str] = None
    use_cases: List[str] = []
    depends_on: List[str] = []
    enables: List[str] = []
    asset_count: int = 0
