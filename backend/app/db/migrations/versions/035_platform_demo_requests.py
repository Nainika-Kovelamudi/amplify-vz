"""Allow an owner-routed platform demo without a catalog asset."""
from alembic import op
import sqlalchemy as sa

revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("demo_requests", sa.Column("request_type", sa.String(20), nullable=False, server_default="asset"))
    op.alter_column("demo_requests", "asset_id", nullable=True)
    op.create_check_constraint("ck_demo_request_target", "demo_requests",
        "(request_type = 'asset' AND asset_id IS NOT NULL) OR (request_type = 'platform' AND asset_id IS NULL)")


def downgrade():
    # Preserve platform requests. Downgrade cannot represent them in the old schema.
    op.execute("DO $$ BEGIN IF EXISTS (SELECT 1 FROM demo_requests WHERE request_type = 'platform') "
               "THEN RAISE EXCEPTION 'Platform demo requests exist. Downgrade would lose them.'; END IF; END $$")
    op.drop_constraint("ck_demo_request_target", "demo_requests", type_="check")
    op.alter_column("demo_requests", "asset_id", nullable=False)
    op.drop_column("demo_requests", "request_type")
