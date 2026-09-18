"""standardize Titan catalog codes

Revision ID: 031
Revises: 030
"""
from alembic import op

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TEMP TABLE titan_code_map ON COMMIT DROP AS
        SELECT id, catalog_code AS old_code,
               'TIT-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at, id)::text, 3, '0') AS new_code
        FROM catalog_assets
        WHERE LOWER(family) = 'titan'
    """)
    op.execute("""
        UPDATE catalog_assets a
        SET catalog_code = '__TIT__' || a.id::text
        FROM titan_code_map m
        WHERE a.id = m.id
    """)
    op.execute("""
        UPDATE submissions s
        SET catalog_code = m.new_code
        FROM titan_code_map m
        WHERE s.catalog_code = m.old_code
    """)
    op.execute("""
        UPDATE catalog_assets a
        SET catalog_code = m.new_code
        FROM titan_code_map m
        WHERE a.id = m.id
    """)


def downgrade() -> None:
    pass
