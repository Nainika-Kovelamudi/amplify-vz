"""add demo request approval workflow

Revision ID: 025
Revises: 024
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("demo_requests")}
    if "status" not in columns:
        op.add_column("demo_requests", sa.Column("status", sa.String(), nullable=False, server_default="Pending"))
    if "decision_notes" not in columns:
        op.add_column("demo_requests", sa.Column("decision_notes", sa.Text(), nullable=True))
    if "reviewed_by" not in columns:
        op.add_column("demo_requests", sa.Column("reviewed_by", UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            "fk_demo_requests_reviewed_by_user_profiles",
            "demo_requests", "user_profiles", ["reviewed_by"], ["id"],
        )
    if "reviewed_at" not in columns:
        op.add_column("demo_requests", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("demo_requests")}
    if "ix_demo_requests_status" not in indexes:
        op.create_index("ix_demo_requests_status", "demo_requests", ["status"])


def downgrade() -> None:
    op.drop_index("ix_demo_requests_status", table_name="demo_requests")
    op.drop_column("demo_requests", "reviewed_at")
    op.drop_constraint("fk_demo_requests_reviewed_by_user_profiles", "demo_requests", type_="foreignkey")
    op.drop_column("demo_requests", "reviewed_by")
    op.drop_column("demo_requests", "decision_notes")
    op.drop_column("demo_requests", "status")
