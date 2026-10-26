"""Durable evaluation recovery and asset remediation workflow."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '036'
down_revision = '035'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('evaluation_jobs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('entity_type', sa.String(20), nullable=False), sa.Column('entity_id', UUID(as_uuid=True), nullable=False),
        sa.Column('requested_by', UUID(as_uuid=True), sa.ForeignKey('user_profiles.id', ondelete='SET NULL')),
        sa.Column('state', sa.String(20), nullable=False, server_default='Queued'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'), sa.Column('options', sa.JSON()),
        sa.Column('error', sa.Text()), sa.Column('lease_token', sa.String(36)), sa.Column('lease_until', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('entity_type','entity_id',name='uq_evaluation_target'))
    op.create_index('ix_evaluation_jobs_state','evaluation_jobs',['state'])
    op.create_table('asset_remediations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('asset_id', UUID(as_uuid=True), sa.ForeignKey('catalog_assets.id', ondelete='SET NULL')),
        sa.Column('asset_title', sa.String(), nullable=False), sa.Column('fingerprint', sa.String(180), nullable=False),
        sa.Column('category', sa.String(40), nullable=False), sa.Column('title', sa.String(), nullable=False),
        sa.Column('action', sa.Text(), nullable=False), sa.Column('severity', sa.String(20), nullable=False, server_default='Medium'),
        sa.Column('state', sa.String(25), nullable=False, server_default='Open'),
        sa.Column('assignee_id', UUID(as_uuid=True), sa.ForeignKey('user_profiles.id', ondelete='SET NULL')),
        sa.Column('due_at', sa.DateTime(timezone=True)), sa.Column('evidence', sa.Text()),
        sa.Column('reviewer_id', UUID(as_uuid=True), sa.ForeignKey('user_profiles.id', ondelete='SET NULL')),
        sa.Column('reviewed_at', sa.DateTime(timezone=True)),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('user_profiles.id', ondelete='SET NULL')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('asset_id','fingerprint', name='uq_remediation_finding'))
    op.create_index('ix_asset_remediations_asset_id','asset_remediations',['asset_id'])
    op.create_index('ix_asset_remediations_state','asset_remediations',['state'])


def downgrade():
    op.execute("DO $$ BEGIN IF EXISTS (SELECT 1 FROM evaluation_jobs) OR EXISTS (SELECT 1 FROM asset_remediations) THEN RAISE EXCEPTION 'Operational history exists; archive it before downgrade'; END IF; END $$")
    op.drop_table('asset_remediations'); op.drop_table('evaluation_jobs')
