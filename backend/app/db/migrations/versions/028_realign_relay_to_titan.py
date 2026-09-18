"""realign Relay assets and submissions to Titan

Revision ID: 028
Revises: 027
"""
from alembic import op

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Catalog codes are stable public identifiers and are deliberately retained.
    op.execute("UPDATE catalog_assets SET family = 'Titan' WHERE LOWER(TRIM(family)) = 'relay'")
    op.execute("UPDATE submissions SET family = 'Titan' WHERE LOWER(TRIM(family)) = 'relay'")


def downgrade() -> None:
    # Irreversible by design: after consolidation there is no reliable way to
    # distinguish former Relay rows from assets created directly under Titan.
    pass
