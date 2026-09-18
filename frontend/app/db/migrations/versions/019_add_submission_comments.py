"""019_add_submission_comments

Threaded comments on submissions — visible to submitter + admin/owner only.

Revision ID: 019
Revises: 018
Create Date: 2026-07-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    tables = conn.execute(sa.text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='submission_comments'")).fetchall()
    if not tables:
        op.create_table(
            "submission_comments",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("submission_id", UUID(as_uuid=True), sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("author_id", UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_submission_comments_submission_id ON submission_comments (submission_id)"))


def downgrade() -> None:
    op.drop_index("ix_submission_comments_submission_id", "submission_comments")
    op.drop_table("submission_comments")
