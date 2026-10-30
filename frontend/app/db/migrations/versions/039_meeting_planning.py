"""Auditable meeting/demo drafts and tagged accelerator associations."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
revision='039'
down_revision='038'
branch_labels=None
depends_on=None


def upgrade():
    op.create_table('meeting_plans',sa.Column('id',UUID(as_uuid=True),primary_key=True),
        sa.Column('requester_id',UUID(as_uuid=True),sa.ForeignKey('user_profiles.id'),nullable=False),
        sa.Column('state',sa.String(20),nullable=False),sa.Column('revision',sa.Integer(),nullable=False),
        sa.Column('content',sa.JSON(),nullable=False),sa.Column('recommendations',sa.JSON(),nullable=False),
        sa.Column('recommendation_hash',sa.String(64)),sa.Column('batch_id',UUID(as_uuid=True),sa.ForeignKey('demo_request_batches.id'),unique=True),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()))
    op.create_index('ix_meeting_plans_requester_id','meeting_plans',['requester_id'])
    op.create_table('meeting_plan_assets',sa.Column('id',UUID(as_uuid=True),primary_key=True),
        sa.Column('plan_id',UUID(as_uuid=True),sa.ForeignKey('meeting_plans.id',ondelete='CASCADE'),nullable=False),
        sa.Column('asset_id',UUID(as_uuid=True),sa.ForeignKey('catalog_assets.id',ondelete='SET NULL')),
        sa.Column('asset_title',sa.String(),nullable=False),sa.Column('selected_via',sa.String(20),nullable=False),
        sa.UniqueConstraint('plan_id','asset_id',name='uq_meeting_plan_asset'))
    op.create_index('ix_meeting_plan_assets_plan_id','meeting_plan_assets',['plan_id'])


def downgrade():
    op.drop_table('meeting_plan_assets');op.drop_table('meeting_plans')
