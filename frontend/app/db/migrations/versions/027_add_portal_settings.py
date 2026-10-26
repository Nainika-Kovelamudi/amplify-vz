"""add owner-managed portal settings

Revision ID: 027
Revises: 026
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "portal_settings" not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table(
            "portal_settings",
            sa.Column("key", sa.String(length=100), primary_key=True),
            sa.Column("value", JSON(), nullable=False),
            sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("portal_settings")
