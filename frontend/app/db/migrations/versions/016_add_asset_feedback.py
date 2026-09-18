"""016_add_asset_feedback

Add asset_feedback table for public per-asset comments.

Revision ID: 016
Revises: 015
Create Date: 2026-07-09
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "016"
down_revision = "015_fix_maturity_data_and_enum"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "asset_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("catalog_assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("comment", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_asset_feedback_asset_id", "asset_feedback", ["asset_id"])


def downgrade() -> None:
    op.drop_index("ix_asset_feedback_asset_id", table_name="asset_feedback")
    op.drop_table("asset_feedback")
