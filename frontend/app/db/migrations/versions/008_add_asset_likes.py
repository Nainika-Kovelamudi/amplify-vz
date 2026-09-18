"""008 add asset likes

Revision ID: 008_add_asset_likes
Revises: 007_add_catalog_asset_fields
Create Date: 2026-07-02
"""
from alembic import op
import sqlalchemy as sa

revision = "008_add_asset_likes"
down_revision = "007_add_catalog_asset_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "asset_likes",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("asset_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("catalog_assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint("uq_asset_likes_asset_user", "asset_likes", ["asset_id", "user_id"])
    op.create_index("ix_asset_likes_asset_id", "asset_likes", ["asset_id"])


def downgrade() -> None:
    op.drop_index("ix_asset_likes_asset_id", "asset_likes")
    op.drop_constraint("uq_asset_likes_asset_user", "asset_likes")
    op.drop_table("asset_likes")
