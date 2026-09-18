"""add view_count to catalog_assets

Revision ID: 022
Revises: 021
Create Date: 2026-07-23
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("catalog_assets")}
    if "view_count" not in columns:
        op.add_column("catalog_assets", sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("catalog_assets", "view_count")
