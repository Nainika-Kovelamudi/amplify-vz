"""add demo_requests table

Revision ID: 020
Revises: 019
Create Date: 2026-07-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "demo_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("catalog_assets.id"), nullable=False, index=True),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False, index=True),
        sa.Column("customer_name", sa.String(), nullable=False),
        sa.Column("project_name", sa.String(), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_demo_requests_asset_id", "demo_requests", ["asset_id"], if_not_exists=True)
    op.create_index("ix_demo_requests_requester_id", "demo_requests", ["requester_id"], if_not_exists=True)

    op.add_column(
        "catalog_assets",
        sa.Column("demo_request_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("catalog_assets", "demo_request_count")
    op.drop_table("demo_requests")
