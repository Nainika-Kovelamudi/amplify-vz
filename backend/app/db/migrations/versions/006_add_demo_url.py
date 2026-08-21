"""add demo_url to catalog_assets and submissions

Revision ID: 006_add_demo_url
Revises: 005_add_dependencies_commands
Create Date: 2026-07-02
"""
from alembic import op
import sqlalchemy as sa

revision = "006_add_demo_url"
down_revision = "005_add_dependencies_commands"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("catalog_assets", sa.Column("demo_url", sa.String, nullable=True))
    op.add_column("submissions", sa.Column("demo_url", sa.String, nullable=True))


def downgrade() -> None:
    op.drop_column("submissions", "demo_url")
    op.drop_column("catalog_assets", "demo_url")
