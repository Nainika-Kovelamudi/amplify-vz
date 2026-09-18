"""add submission review assignment

Revision ID: 026
Revises: 025
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("submissions")}
    additions = (
        ("assigned_reviewer_id", sa.Column("assigned_reviewer_id", UUID(as_uuid=True), nullable=True)),
        ("assigned_by", sa.Column("assigned_by", UUID(as_uuid=True), nullable=True)),
        ("assigned_at", sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True)),
    )
    for name, column in additions:
        if name not in columns:
            op.add_column("submissions", column)
    foreign_keys = {fk.get("name") for fk in sa.inspect(op.get_bind()).get_foreign_keys("submissions")}
    if "fk_submissions_assigned_reviewer" not in foreign_keys:
        op.create_foreign_key("fk_submissions_assigned_reviewer", "submissions", "user_profiles", ["assigned_reviewer_id"], ["id"])
    if "fk_submissions_assigned_by" not in foreign_keys:
        op.create_foreign_key("fk_submissions_assigned_by", "submissions", "user_profiles", ["assigned_by"], ["id"])
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("submissions")}
    if "ix_submissions_assigned_reviewer_id" not in indexes:
        op.create_index("ix_submissions_assigned_reviewer_id", "submissions", ["assigned_reviewer_id"])


def downgrade() -> None:
    op.drop_index("ix_submissions_assigned_reviewer_id", table_name="submissions")
    op.drop_constraint("fk_submissions_assigned_by", "submissions", type_="foreignkey")
    op.drop_constraint("fk_submissions_assigned_reviewer", "submissions", type_="foreignkey")
    op.drop_column("submissions", "assigned_at")
    op.drop_column("submissions", "assigned_by")
    op.drop_column("submissions", "assigned_reviewer_id")
