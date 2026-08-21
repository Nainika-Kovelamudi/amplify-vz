"""add multiple demo video URLs

Revision ID: 023
Revises: 022
Create Date: 2026-08-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("submissions", sa.Column("video_urls", postgresql.JSON(), nullable=True))
    op.add_column("catalog_assets", sa.Column("video_urls", postgresql.JSON(), nullable=True))
    op.execute("UPDATE submissions SET video_urls = json_build_array(video_url) WHERE video_url IS NOT NULL")
    op.execute("UPDATE catalog_assets SET video_urls = json_build_array(video_url) WHERE video_url IS NOT NULL")


def downgrade() -> None:
    op.drop_column("catalog_assets", "video_urls")
    op.drop_column("submissions", "video_urls")
