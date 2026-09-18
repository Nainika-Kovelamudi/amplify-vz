"""add AIV ideation mapping

Revision ID: 024
Revises: 023
"""
from alembic import op
import sqlalchemy as sa

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in ("submissions", "catalog_assets"):
        columns = {column["name"] for column in inspector.get_columns(table)}
        if "aiv_ideation_id" not in columns:
            op.add_column(table, sa.Column("aiv_ideation_id", sa.String(), nullable=True))
        if "aiv_ideation_title" not in columns:
            op.add_column(table, sa.Column("aiv_ideation_title", sa.String(), nullable=True))
        indexes = {index["name"] for index in inspector.get_indexes(table)}
        index_name = f"ix_{table}_aiv_ideation_id"
        if index_name not in indexes:
            op.create_index(index_name, table, ["aiv_ideation_id"])


def downgrade() -> None:
    for table in ("catalog_assets", "submissions"):
        op.drop_index(f"ix_{table}_aiv_ideation_id", table_name=table)
        op.drop_column(table, "aiv_ideation_title")
        op.drop_column(table, "aiv_ideation_id")
