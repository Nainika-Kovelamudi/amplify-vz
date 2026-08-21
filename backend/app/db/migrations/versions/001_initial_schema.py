"""Initial schema — all base tables

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-07-01
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON, UUID, ENUM as PG_ENUM

revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def _enum(name: str, values: str) -> None:
    """Create a PostgreSQL enum type, skipping if it already exists."""
    op.execute(f"""
        DO $$ BEGIN
            CREATE TYPE {name} AS ENUM ({values});
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)


def upgrade() -> None:
    # -- Enums (DO...EXCEPTION handles partial re-runs safely) ----------------
    _enum("user_role_enum", "'guest', 'admin', 'super_admin'")
    _enum("asset_maturity_enum", "'Prototype', 'Beta', 'Production'")
    _enum("asset_status_enum", "'Draft', 'AI_Review', 'Manual_Approval', 'Approved', 'Published', 'Needs_Changes', 'Archived'")
    _enum("submission_status_enum", "'Submitted', 'AI_Review', 'Manual_Approval', 'Approved', 'Published', 'Needs_Changes', 'Archived'")
    _enum("clone_environment_enum", "'Development', 'Staging', 'Production', 'Research'")
    _enum("clone_status_enum", "'Pending', 'Approved', 'Denied'")

    # -- user_profiles ---------------------------------------------------------
    op.create_table(
        "user_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("azure_oid", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("role", PG_ENUM(name="user_role_enum", create_type=False), nullable=False),
        sa.Column("department", sa.String(), nullable=True),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_profiles_azure_oid", "user_profiles", ["azure_oid"], unique=True)
    op.create_index("ix_user_profiles_email", "user_profiles", ["email"], unique=True)

    # -- catalog_assets --------------------------------------------------------
    op.create_table(
        "catalog_assets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("catalog_code", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("family", sa.String(), nullable=False),
        sa.Column("department", sa.String(), nullable=False),
        sa.Column("tech_stack", JSON(), nullable=True),
        sa.Column("cloud_provider", sa.String(), nullable=True),
        sa.Column("maturity", PG_ENUM(name="asset_maturity_enum", create_type=False), nullable=False),
        sa.Column("demo_ready", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("video_url", sa.String(), nullable=True),
        sa.Column("thumbnail_url", sa.String(), nullable=True),
        sa.Column("repo_url", sa.String(), nullable=True),
        sa.Column("repo_blob_path", sa.String(), nullable=True),
        sa.Column("status", PG_ENUM(name="asset_status_enum", create_type=False), nullable=False),
        sa.Column("ai_score", sa.Integer(), nullable=True),
        sa.Column("ai_feedback", JSON(), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_catalog_assets_catalog_code", "catalog_assets", ["catalog_code"], unique=True)
    op.create_index("ix_catalog_assets_slug", "catalog_assets", ["slug"], unique=True)
    op.create_index("ix_catalog_assets_owner_id", "catalog_assets", ["owner_id"])

    # -- submissions -----------------------------------------------------------
    op.create_table(
        "submissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("catalog_code", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("family", sa.String(), nullable=False),
        sa.Column("department", sa.String(), nullable=False),
        sa.Column("tech_stack", JSON(), nullable=True),
        sa.Column("cloud_provider", sa.String(), nullable=True),
        sa.Column("maturity", sa.String(), nullable=False),
        sa.Column("demo_ready", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("video_url", sa.String(), nullable=True),
        sa.Column("repo_url", sa.String(), nullable=True),
        sa.Column("owner_name", sa.String(), nullable=True),
        sa.Column("owner_email", sa.String(), nullable=True),
        sa.Column("manager_name", sa.String(), nullable=True),
        sa.Column("manager_email", sa.String(), nullable=True),
        sa.Column("designation", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("architecture_file_url", sa.String(), nullable=True),
        sa.Column("status", PG_ENUM(name="submission_status_enum", create_type=False), nullable=False),
        sa.Column("ai_score", sa.Integer(), nullable=True),
        sa.Column("ai_feedback", JSON(), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("submitter_id", UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("reviewed_by", UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_submissions_catalog_code", "submissions", ["catalog_code"])
    op.create_index("ix_submissions_submitter_id", "submissions", ["submitter_id"])

    # -- clone_requests --------------------------------------------------------
    op.create_table(
        "clone_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("catalog_assets.id"), nullable=False),
        sa.Column("requester_id", UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("environment", PG_ENUM(name="clone_environment_enum", create_type=False), nullable=False),
        sa.Column("status", PG_ENUM(name="clone_status_enum", create_type=False), nullable=False),
        sa.Column("owner_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_clone_requests_asset_id", "clone_requests", ["asset_id"])
    op.create_index("ix_clone_requests_requester_id", "clone_requests", ["requester_id"])

    # -- clone_tokens ----------------------------------------------------------
    op.create_table(
        "clone_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("clone_request_id", UUID(as_uuid=True), sa.ForeignKey("clone_requests.id"), unique=True, nullable=False),
        sa.Column("token_uuid", UUID(as_uuid=True), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_clone_tokens_clone_request_id", "clone_tokens", ["clone_request_id"])
    op.create_index("ix_clone_tokens_token_uuid", "clone_tokens", ["token_uuid"])

    # -- activity_logs ---------------------------------------------------------
    op.create_table(
        "activity_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_id", UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_activity_logs_actor_id", "activity_logs", ["actor_id"])
    op.create_index("ix_activity_logs_action", "activity_logs", ["action"])
    op.create_index("ix_activity_logs_entity_type", "activity_logs", ["entity_type"])
    op.create_index("ix_activity_logs_entity_id", "activity_logs", ["entity_id"])

    # -- notifications ---------------------------------------------------------
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("recipient_id", UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_recipient_id", "notifications", ["recipient_id"])
    op.create_index("ix_notifications_event_type", "notifications", ["event_type"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("activity_logs")
    op.drop_table("clone_tokens")
    op.drop_table("clone_requests")
    op.drop_table("submissions")
    op.drop_table("catalog_assets")
    op.drop_table("user_profiles")
    op.execute("DROP TYPE IF EXISTS clone_status_enum")
    op.execute("DROP TYPE IF EXISTS clone_environment_enum")
    op.execute("DROP TYPE IF EXISTS submission_status_enum")
    op.execute("DROP TYPE IF EXISTS asset_status_enum")
    op.execute("DROP TYPE IF EXISTS asset_maturity_enum")
    op.execute("DROP TYPE IF EXISTS user_role_enum")
