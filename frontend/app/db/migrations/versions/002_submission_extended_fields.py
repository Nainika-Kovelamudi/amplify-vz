"""Add extended submitter/classification fields to submissions

Revision ID: 002_submission_extended_fields
Revises: 001_initial_schema
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa

revision = "002_submission_extended_fields"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # All these columns are already included in 001_initial_schema.
    # Kept as a no-op for migration history continuity.
    pass


def downgrade() -> None:
    pass
