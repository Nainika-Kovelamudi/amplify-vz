"""Record whether feedback concerns the platform or a specific asset."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '037'
down_revision = '036'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('platform_feedback', sa.Column('asset_id', UUID(as_uuid=True), nullable=True))
    # Snapshot retains the feedback subject even if the catalog asset is deleted.
    op.add_column('platform_feedback', sa.Column('asset_title', sa.String(), nullable=True))
    op.create_foreign_key('fk_platform_feedback_asset_id', 'platform_feedback', 'catalog_assets',
                          ['asset_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_platform_feedback_asset_id', 'platform_feedback', ['asset_id'])


def downgrade():
    op.execute("DO $$ BEGIN IF EXISTS (SELECT 1 FROM platform_feedback WHERE asset_title IS NOT NULL) "
               "THEN RAISE EXCEPTION 'Asset feedback exists; archive its target information before downgrade'; END IF; END $$")
    op.drop_index('ix_platform_feedback_asset_id', table_name='platform_feedback')
    op.drop_constraint('fk_platform_feedback_asset_id', 'platform_feedback', type_='foreignkey')
    op.drop_column('platform_feedback', 'asset_title')
    op.drop_column('platform_feedback', 'asset_id')
