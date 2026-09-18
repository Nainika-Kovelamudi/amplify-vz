"""align FAST family colors with canonical icons

Revision ID: 030
Revises: 029
"""
import json
from alembic import op
import sqlalchemy as sa

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None

COLORS = {"Forge": "#F05A0A", "Atlas": "#147FE6", "Sentinel": "#07885C", "Titan": "#5B35CC"}


def upgrade() -> None:
    bind = op.get_bind()
    raw = bind.execute(sa.text("SELECT value FROM portal_settings WHERE key = 'portal_content'")).scalar()
    if not raw:
        return
    content = json.loads(raw) if isinstance(raw, str) else dict(raw)
    for family in content.get("families", []):
        if family.get("id") in COLORS:
            family["color"] = COLORS[family["id"]]
    bind.execute(sa.text("UPDATE portal_settings SET value = CAST(:value AS JSON) WHERE key = 'portal_content'"), {"value": json.dumps(content)})


def downgrade() -> None:
    pass
