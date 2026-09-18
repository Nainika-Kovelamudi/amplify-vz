"""add vertical and additional_details to demo_requests

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-07-23
"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("demo_requests", sa.Column("vertical", sa.String(), nullable=True))
    op.add_column("demo_requests", sa.Column("additional_details", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("demo_requests", "additional_details")
    op.drop_column("demo_requests", "vertical")
