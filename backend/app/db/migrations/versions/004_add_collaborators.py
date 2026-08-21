"""add collaborators column to submissions

Revision ID: 004_add_collaborators
Revises: 003_rename_role_enum
Create Date: 2026-07-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "004_add_collaborators"
down_revision = "003_rename_role_enum"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("submissions", sa.Column("collaborators", JSON, nullable=True))


def downgrade() -> None:
    op.drop_column("submissions", "collaborators")
