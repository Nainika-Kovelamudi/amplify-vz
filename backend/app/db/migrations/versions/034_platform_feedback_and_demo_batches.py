"""Store platform feedback and parent demo requests, including existing audit data."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("platform_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("submitter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index("ix_platform_feedback_submitter_id", "platform_feedback", ["submitter_id"])
    op.create_table("demo_request_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("customer_name", sa.String(), nullable=False),
        sa.Column("project_name", sa.String(), nullable=False),
        sa.Column("vertical", sa.String(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index("ix_demo_request_batches_requester_id", "demo_request_batches", ["requester_id"])
    op.add_column("demo_requests", sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_demo_requests_batch_id", "demo_requests", "demo_request_batches", ["batch_id"], ["id"])
    op.create_index("ix_demo_requests_batch_id", "demo_requests", ["batch_id"])
    # Preserve feedback and bulk groups created by the previous implementation.
    op.execute("""
        INSERT INTO platform_feedback (id, submitter_id, name, email, comment, created_at)
        SELECT COALESCE(log.entity_id, log.id), profile.id,
               log.metadata::jsonb->>'name',
               COALESCE(log.metadata::jsonb->>'email', profile.email, ''),
               log.metadata::jsonb->>'comment', log.created_at
        FROM activity_logs log LEFT JOIN user_profiles profile ON profile.id = log.actor_id
        WHERE log.action = 'platform_feedback_created' AND log.metadata::jsonb->>'comment' IS NOT NULL
        ON CONFLICT (id) DO NOTHING
    """)
    op.execute("""
        INSERT INTO demo_request_batches (id, requester_id, customer_name, project_name, vertical, requested_at)
        SELECT DISTINCT ON (log.entity_id) log.entity_id, profile.id,
               COALESCE(log.metadata::jsonb->>'customer_name', request.customer_name),
               COALESCE(log.metadata::jsonb->>'project_name', request.project_name),
               request.vertical, log.created_at
        FROM activity_logs log
        JOIN user_profiles profile ON profile.id = log.actor_id
        JOIN demo_requests request ON log.metadata::jsonb->'demo_request_ids' ? request.id::text
        WHERE log.action = 'multi_demo_request_created' AND log.entity_id IS NOT NULL
        ORDER BY log.entity_id, log.created_at
        ON CONFLICT (id) DO NOTHING
    """)
    op.execute("""
        UPDATE demo_requests request SET batch_id = batch.id
        FROM activity_logs log JOIN demo_request_batches batch ON batch.id = log.entity_id
        WHERE log.action = 'multi_demo_request_created'
          AND log.metadata::jsonb->'demo_request_ids' ? request.id::text
          AND request.batch_id IS NULL
    """)


def downgrade() -> None:
    op.drop_index("ix_demo_requests_batch_id", table_name="demo_requests")
    op.drop_constraint("fk_demo_requests_batch_id", "demo_requests", type_="foreignkey")
    op.drop_column("demo_requests", "batch_id")
    op.drop_table("demo_request_batches")
    op.drop_table("platform_feedback")
