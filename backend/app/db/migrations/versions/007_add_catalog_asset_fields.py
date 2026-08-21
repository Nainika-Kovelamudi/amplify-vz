"""add extended fields to catalog_assets

Revision ID: 007_add_catalog_asset_fields
Revises: 006_add_demo_url
Create Date: 2026-07-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "007_add_catalog_asset_fields"
down_revision = "006_add_demo_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("catalog_assets", sa.Column("collaborators", JSON, nullable=True))
    op.add_column("catalog_assets", sa.Column("dependencies", sa.Text, nullable=True))
    op.add_column("catalog_assets", sa.Column("commands", JSON, nullable=True))
    op.add_column("catalog_assets", sa.Column("architecture_file_url", sa.String, nullable=True))
    op.add_column("catalog_assets", sa.Column("category", sa.String, nullable=True))
    op.add_column("catalog_assets", sa.Column("owner_name", sa.String, nullable=True))
    op.add_column("catalog_assets", sa.Column("owner_email", sa.String, nullable=True))
    op.add_column("catalog_assets", sa.Column("manager_name", sa.String, nullable=True))
    op.add_column("catalog_assets", sa.Column("manager_email", sa.String, nullable=True))
    op.add_column("catalog_assets", sa.Column("designation", sa.String, nullable=True))


def downgrade() -> None:
    for col in ["designation", "manager_email", "manager_name", "owner_email",
                "owner_name", "category", "architecture_file_url", "commands",
                "dependencies", "collaborators"]:
        op.drop_column("catalog_assets", col)
