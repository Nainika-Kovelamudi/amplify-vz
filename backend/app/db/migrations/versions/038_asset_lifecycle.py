"""Add Deprecated and Decommissioned asset/submission lifecycle values."""
from alembic import op
revision='038'
down_revision='037'
branch_labels=None
depends_on=None


def upgrade():
    with op.get_context().autocommit_block():
        for name in ('asset_status_enum','submission_status_enum'):
            for value in ('Deprecated','Decommissioned'):
                op.execute(f"ALTER TYPE {name} ADD VALUE IF NOT EXISTS '{value}'")


def downgrade():
    raise RuntimeError('Lifecycle enum values cannot be removed safely. Restore retired assets before a reviewed manual downgrade.')
