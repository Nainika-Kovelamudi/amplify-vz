"""011 update maturity values to Experimental/Battle-Tested/Production

Revision ID: 011_update_maturity_values
Revises: 010_add_user_role_locked
Create Date: 2026-07-07

NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL.
      This migration uses AUTOCOMMIT for that step via get_bind().
"""
from alembic import op
from sqlalchemy import text

revision = "011_update_maturity_values"
down_revision = "010_add_user_role_locked"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ALTER TYPE ADD VALUE must run outside a transaction block
    conn.execute(text("COMMIT"))
    conn.execute(text("ALTER TYPE asset_maturity_enum ADD VALUE IF NOT EXISTS 'Experimental'"))
    conn.execute(text("ALTER TYPE asset_maturity_enum ADD VALUE IF NOT EXISTS 'Battle-Tested'"))
    conn.execute(text("BEGIN"))

    # Migrate existing rows
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Experimental' WHERE maturity = 'Prototype'"
    ))
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Battle-Tested' WHERE maturity = 'Beta'"
    ))
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Experimental' "
        "WHERE lower(maturity) IN ('prototype', 'experimental')"
    ))
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Battle-Tested' "
        "WHERE lower(maturity) IN ('beta', 'battle-tested', 'battletested', 'beta phase')"
    ))
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Production' "
        "WHERE lower(maturity) IN ('production', 'validated')"
    ))

    # Swap enum to clean 3-value version (removes Prototype/Beta)
    conn.execute(text("COMMIT"))
    conn.execute(text("ALTER TYPE asset_maturity_enum RENAME TO asset_maturity_enum_old"))
    conn.execute(text(
        "CREATE TYPE asset_maturity_enum AS ENUM ('Experimental', 'Battle-Tested', 'Production')"
    ))
    conn.execute(text("""
        ALTER TABLE catalog_assets
        ALTER COLUMN maturity TYPE asset_maturity_enum
        USING maturity::text::asset_maturity_enum
    """))
    conn.execute(text("DROP TYPE asset_maturity_enum_old"))
    conn.execute(text("BEGIN"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("COMMIT"))
    conn.execute(text("ALTER TYPE asset_maturity_enum RENAME TO asset_maturity_enum_old"))
    conn.execute(text(
        "CREATE TYPE asset_maturity_enum AS ENUM ('Prototype', 'Beta', 'Production')"
    ))
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Prototype' WHERE maturity = 'Experimental'"
    ))
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Beta' WHERE maturity = 'Battle-Tested'"
    ))
    conn.execute(text("""
        ALTER TABLE catalog_assets
        ALTER COLUMN maturity TYPE asset_maturity_enum
        USING maturity::text::asset_maturity_enum
    """))
    conn.execute(text("DROP TYPE asset_maturity_enum_old"))
    conn.execute(text("BEGIN"))
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Prototype' WHERE maturity = 'Experimental'"
    ))
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Beta' WHERE maturity = 'Battle-Tested'"
    ))
