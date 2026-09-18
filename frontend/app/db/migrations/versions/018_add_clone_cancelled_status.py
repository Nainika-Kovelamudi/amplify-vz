"""018_add_clone_cancelled_status

Add 'Cancelled' value to clone_status_enum.

Revision ID: 018
Revises: 017
Create Date: 2026-07-12
"""
from alembic import op

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE clone_status_enum ADD VALUE IF NOT EXISTS 'Cancelled'")


def downgrade() -> None:
    # Postgres does not support removing enum values; mark rows then leave the value in place
    op.execute("UPDATE clone_requests SET status = 'Denied' WHERE status = 'Cancelled'")
