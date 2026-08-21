"""010 add role_locked to user_profiles

Revision ID: 010_add_user_role_locked
Revises: 009_add_clone_request_purpose
Create Date: 2026-07-07
"""
from alembic import op
import sqlalchemy as sa

revision = "010_add_user_role_locked"
down_revision = "009_add_clone_request_purpose"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("role_locked", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "role_locked")
