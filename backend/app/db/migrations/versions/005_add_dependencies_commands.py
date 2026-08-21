"""add dependencies and commands columns to submissions

Revision ID: 005_add_dependencies_commands
Revises: 004_add_collaborators
Create Date: 2026-07-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "005_add_dependencies_commands"
down_revision = "004_add_collaborators"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("submissions", sa.Column("dependencies", sa.Text, nullable=True))
    op.add_column("submissions", sa.Column("commands", JSON, nullable=True))


def downgrade() -> None:
    op.drop_column("submissions", "commands")
    op.drop_column("submissions", "dependencies")
