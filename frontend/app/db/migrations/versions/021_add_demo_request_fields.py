"""add vertical and additional_details to demo_requests

Revision ID: 021
Revises: 020
Create Date: 2026-07-23
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("demo_requests")}
    if "requester_email" not in columns:
        op.add_column("demo_requests", sa.Column("requester_email", sa.String(), nullable=True))
    if "requester_name" not in columns:
        op.add_column("demo_requests", sa.Column("requester_name", sa.String(), nullable=True))
    if "vertical" not in columns:
        op.add_column("demo_requests", sa.Column("vertical", sa.String(), nullable=True))
    if "additional_details" not in columns:
        op.add_column("demo_requests", sa.Column("additional_details", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("demo_requests", "additional_details")
    op.drop_column("demo_requests", "vertical")
    op.drop_column("demo_requests", "requester_name")
    op.drop_column("demo_requests", "requester_email")
