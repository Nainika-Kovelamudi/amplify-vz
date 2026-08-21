"""017_add_clone_project_fields

Add project_name and is_internal to clone_requests for Customer Demo tracking.

Revision ID: 017
Revises: 016
Create Date: 2026-07-12
"""
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clone_requests", sa.Column("project_name", sa.Text(), nullable=True))
    op.add_column("clone_requests", sa.Column("is_internal", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("clone_requests", "is_internal")
    op.drop_column("clone_requests", "project_name")
