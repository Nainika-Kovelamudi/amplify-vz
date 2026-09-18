from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    user = "Aimplify.User"
    admin = "Aimplify.Admin"
    owner = "Aimplify.Owner"


class AssetMaturity(str, enum.Enum):
    Experimental = "Experimental"
    BattleTested = "Battle-Tested"
    Production = "Production"


class AssetStatus(str, enum.Enum):
    Draft = "Draft"
    AI_Review = "AI_Review"
    Manual_Approval = "Manual_Approval"
    Approved = "Approved"
    Published = "Published"
    Needs_Changes = "Needs_Changes"
    Rejected = "Rejected"
    On_Hold = "On_Hold"
    Archived = "Archived"


class SubmissionStatus(str, enum.Enum):
    Submitted = "Submitted"
    AI_Review = "AI_Review"
    Manual_Approval = "Manual_Approval"
    Approved = "Approved"
    Published = "Published"
    Needs_Changes = "Needs_Changes"
    Rejected = "Rejected"
    On_Hold = "On_Hold"
    Archived = "Archived"


class CloneEnvironment(str, enum.Enum):
    Development = "Development"
    Staging = "Staging"
    Production = "Production"
    Research = "Research"


class CloneStatus(str, enum.Enum):
    Pending = "Pending"
    Approved = "Approved"
    Denied = "Denied"
    Cancelled = "Cancelled"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    azure_oid: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role_enum", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=UserRole.user,
    )
    department: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    owned_assets: Mapped[list["CatalogAsset"]] = relationship(
        "CatalogAsset", back_populates="owner", foreign_keys="CatalogAsset.owner_id"
    )
    submissions: Mapped[list["Submission"]] = relationship(
        "Submission", back_populates="submitter", foreign_keys="Submission.submitter_id"
    )
    reviewed_submissions: Mapped[list["Submission"]] = relationship(
        "Submission", back_populates="reviewer", foreign_keys="Submission.reviewed_by"
    )
    clone_requests: Mapped[list["CloneRequest"]] = relationship(
        "CloneRequest", back_populates="requester", foreign_keys="CloneRequest.requester_id"
    )
    demo_requests: Mapped[list["DemoRequest"]] = relationship(
        "DemoRequest", back_populates="requester", foreign_keys="DemoRequest.requester_id"
    )
    activity_logs: Mapped[list["ActivityLog"]] = relationship(
        "ActivityLog", back_populates="actor", foreign_keys="ActivityLog.actor_id"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="recipient", foreign_keys="Notification.recipient_id"
    )

    def __repr__(self) -> str:
        return f"<UserProfile id={self.id} email={self.email!r} role={self.role}>"


class CatalogAsset(Base):
    __tablename__ = "catalog_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    catalog_code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    family: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)
    tech_stack: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    cloud_provider: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    maturity: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    demo_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    video_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    demo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    repo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # NEVER exposed in API responses
    repo_blob_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    collaborators: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    dependencies: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    commands: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    architecture_file_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    owner_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    owner_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    manager_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    manager_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[AssetStatus] = mapped_column(
        SAEnum(AssetStatus, name="asset_status_enum"), nullable=False, default=AssetStatus.Draft
    )
    ai_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ai_feedback: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    artifact_download_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    demo_view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    demo_request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["UserProfile"] = relationship(
        "UserProfile", back_populates="owned_assets", foreign_keys=[owner_id]
    )
    clone_requests: Mapped[list["CloneRequest"]] = relationship(
        "CloneRequest", back_populates="asset", foreign_keys="CloneRequest.asset_id"
    )
    demo_requests: Mapped[list["DemoRequest"]] = relationship(
        "DemoRequest", back_populates="asset", foreign_keys="DemoRequest.asset_id"
    )

    def __repr__(self) -> str:
        return f"<CatalogAsset id={self.id} catalog_code={self.catalog_code!r} title={self.title!r}>"


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    catalog_code: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    family: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)
    tech_stack: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    collaborators: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    cloud_provider: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    maturity: Mapped[str] = mapped_column(String, nullable=False)
    demo_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    video_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    demo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    repo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    dependencies: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    commands: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # Submitter information (Section 1)
    owner_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    owner_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    manager_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    manager_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Asset classification
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Attachments
    architecture_file_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[SubmissionStatus] = mapped_column(
        SAEnum(SubmissionStatus, name="submission_status_enum"),
        nullable=False,
        default=SubmissionStatus.Submitted,
    )
    ai_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ai_feedback: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False, index=True
    )
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    submitter: Mapped["UserProfile"] = relationship(
        "UserProfile", back_populates="submissions", foreign_keys=[submitter_id]
    )
    reviewer: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile", back_populates="reviewed_submissions", foreign_keys=[reviewed_by]
    )

    def __repr__(self) -> str:
        return f"<Submission id={self.id} title={self.title!r} status={self.status}>"


class CloneRequest(Base):
    __tablename__ = "clone_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_assets.id"), nullable=False, index=True
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False, index=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    purpose: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    customer_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    project_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_internal: Mapped[Optional[bool]] = mapped_column(nullable=True)
    environment: Mapped[CloneEnvironment] = mapped_column(
        SAEnum(CloneEnvironment, name="clone_environment_enum"), nullable=False
    )
    status: Mapped[CloneStatus] = mapped_column(
        SAEnum(CloneStatus, name="clone_status_enum"), nullable=False, default=CloneStatus.Pending
    )
    owner_notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    asset: Mapped["CatalogAsset"] = relationship(
        "CatalogAsset", back_populates="clone_requests", foreign_keys=[asset_id]
    )
    requester: Mapped["UserProfile"] = relationship(
        "UserProfile", back_populates="clone_requests", foreign_keys=[requester_id]
    )
    clone_token: Mapped[Optional["CloneToken"]] = relationship(
        "CloneToken", back_populates="clone_request", uselist=False
    )

    def __repr__(self) -> str:
        return f"<CloneRequest id={self.id} asset_id={self.asset_id} status={self.status}>"


class CloneToken(Base):
    __tablename__ = "clone_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clone_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clone_requests.id"), unique=True, nullable=False, index=True
    )
    token_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    redeemed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    clone_request: Mapped["CloneRequest"] = relationship(
        "CloneRequest", back_populates="clone_token", foreign_keys=[clone_request_id]
    )

    def __repr__(self) -> str:
        return f"<CloneToken id={self.id} token_uuid={self.token_uuid} expires_at={self.expires_at}>"


class AssetLike(Base):
    __tablename__ = "asset_likes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<AssetLike asset_id={self.asset_id} user_id={self.user_id}>"


class ActivityLog(Base):
    """Append-only audit log. Application must NEVER UPDATE or DELETE rows."""

    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String, nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    log_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    actor: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile", back_populates="activity_logs", foreign_keys=[actor_id]
    )

    def __repr__(self) -> str:
        return f"<ActivityLog id={self.id} action={self.action!r} entity_type={self.entity_type!r}>"


class SubmissionComment(Base):
    """Threaded conversation on a submission — visible only to submitter + admins/owners."""

    __tablename__ = "submission_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    author: Mapped["UserProfile"] = relationship("UserProfile", foreign_keys=[author_id])


class AssetFeedback(Base):
    __tablename__ = "asset_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<AssetFeedback id={self.id} asset_id={self.asset_id} email={self.email!r}>"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(String, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    recipient: Mapped["UserProfile"] = relationship(
        "UserProfile", back_populates="notifications", foreign_keys=[recipient_id]
    )

    def __repr__(self) -> str:
        return f"<Notification id={self.id} recipient_id={self.recipient_id} event_type={self.event_type!r}>"


class DemoRequest(Base):
    """Customer demo request raised by any user for a published catalog asset."""

    __tablename__ = "demo_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_assets.id"), nullable=False, index=True
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id"), nullable=False, index=True
    )
    customer_name: Mapped[str] = mapped_column(String, nullable=False)
    project_name: Mapped[str] = mapped_column(String, nullable=False)
    vertical: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    additional_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    asset: Mapped["CatalogAsset"] = relationship(
        "CatalogAsset", back_populates="demo_requests", foreign_keys=[asset_id]
    )
    requester: Mapped["UserProfile"] = relationship(
        "UserProfile", back_populates="demo_requests", foreign_keys=[requester_id]
    )

    def __repr__(self) -> str:
        return f"<DemoRequest id={self.id} asset_id={self.asset_id} customer={self.customer_name!r}>"
