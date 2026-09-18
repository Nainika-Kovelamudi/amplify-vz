"""013 add artifact_download_count and demo_view_count to catalog_assets

Revision ID: 013_add_engagement_counts
Revises: 012_fix_maturity_enum_values
Create Date: 2026-07-07
"""
from alembic import op
import sqlalchemy as sa

revision = "013_add_engagement_counts"
down_revision = "012_fix_maturity_enum_values"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("catalog_assets", sa.Column("artifact_download_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("catalog_assets", sa.Column("demo_view_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("catalog_assets", "demo_view_count")
    op.drop_column("catalog_assets", "artifact_download_count")
