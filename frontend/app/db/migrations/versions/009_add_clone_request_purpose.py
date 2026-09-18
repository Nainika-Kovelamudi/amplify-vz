"""009 add clone request purpose fields

Revision ID: 009_add_clone_request_purpose
Revises: 008_add_asset_likes
Create Date: 2026-07-06
"""
from alembic import op
import sqlalchemy as sa

revision = "009_add_clone_request_purpose"
down_revision = "008_add_asset_likes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clone_requests", sa.Column("purpose", sa.Text(), nullable=True))
    op.add_column("clone_requests", sa.Column("customer_name", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("clone_requests", "customer_name")
    op.drop_column("clone_requests", "purpose")
