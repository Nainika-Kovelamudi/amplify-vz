"""Split submission comments into submitter and internal channels.

Revision ID: 033
Revises: 032
"""
from alembic import op
import sqlalchemy as sa

revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("submission_comments")}
    if "channel" not in columns:
        op.add_column(
            "submission_comments",
            sa.Column("channel", sa.String(length=20), nullable=False, server_default="submitter"),
        )
    op.execute("UPDATE submission_comments SET channel = 'submitter' WHERE channel IS NULL")
    op.create_check_constraint(
        "ck_submission_comments_channel",
        "submission_comments",
        "channel IN ('submitter', 'internal')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_submission_comments_channel", "submission_comments", type_="check")
    op.drop_column("submission_comments", "channel")
