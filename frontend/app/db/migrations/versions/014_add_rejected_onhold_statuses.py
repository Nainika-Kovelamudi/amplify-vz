"""014 add Rejected and On_Hold to submission and asset status enums

Revision ID: 014_add_rejected_onhold_statuses
Revises: 013_add_engagement_counts
Create Date: 2026-07-07
"""
from alembic import op

revision = "014_add_rejected_onhold_statuses"
down_revision = "013_add_engagement_counts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL ALTER TYPE must run outside a transaction block
    op.execute("COMMIT")
    op.execute("ALTER TYPE submission_status_enum ADD VALUE IF NOT EXISTS 'Rejected'")
    op.execute("ALTER TYPE submission_status_enum ADD VALUE IF NOT EXISTS 'On_Hold'")
    op.execute("ALTER TYPE asset_status_enum ADD VALUE IF NOT EXISTS 'Rejected'")
    op.execute("ALTER TYPE asset_status_enum ADD VALUE IF NOT EXISTS 'On_Hold'")


def downgrade() -> None:
    # Enum values cannot be removed in PostgreSQL without recreating the type
    pass
