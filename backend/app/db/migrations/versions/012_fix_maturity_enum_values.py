"""012 fix maturity enum values — ensure DB stores hyphenated values

Revision ID: 012_fix_maturity_enum_values
Revises: 011_update_maturity_values
Create Date: 2026-07-07

After migration 011, SQLAlchemy was storing the enum member *name* ('BattleTested')
not the member *value* ('Battle-Tested').  This migration drops and recreates the
enum type with the correct values, and fixes any rows that slipped through with the
un-hyphenated form.
"""
from alembic import op
from sqlalchemy import text

revision = "012_fix_maturity_enum_values"
down_revision = "011_update_maturity_values"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ------------------------------------------------------------------ #
    # 1. Temporarily change the column to plain text so we can swap enums #
    # ------------------------------------------------------------------ #
    conn.execute(text("COMMIT"))

    conn.execute(text(
        "ALTER TABLE catalog_assets "
        "ALTER COLUMN maturity TYPE VARCHAR(50) "
        "USING maturity::text"
    ))

    # Drop old enum (may contain 'BattleTested' without hyphen)
    conn.execute(text("DROP TYPE IF EXISTS asset_maturity_enum"))

    # Re-create with the canonical three hyphenated values
    conn.execute(text(
        "CREATE TYPE asset_maturity_enum AS ENUM "
        "('Experimental', 'Battle-Tested', 'Production')"
    ))

    conn.execute(text("BEGIN"))

    # ------------------------------------------------------------------ #
    # 2. Normalize any legacy / un-hyphenated values still in the table   #
    # ------------------------------------------------------------------ #
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Experimental' "
        "WHERE lower(maturity) IN ('prototype', 'experimental')"
    ))
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Battle-Tested' "
        "WHERE lower(maturity) IN ('beta', 'battletested', 'battle-tested', "
        "'battle_tested', 'beta phase')"
    ))
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Production' "
        "WHERE lower(maturity) IN ('production', 'validated')"
    ))

    # ------------------------------------------------------------------ #
    # 3. Cast column back to the new enum                                 #
    # ------------------------------------------------------------------ #
    conn.execute(text("COMMIT"))

    conn.execute(text(
        "ALTER TABLE catalog_assets "
        "ALTER COLUMN maturity TYPE asset_maturity_enum "
        "USING maturity::asset_maturity_enum"
    ))

    conn.execute(text("BEGIN"))

    # ------------------------------------------------------------------ #
    # 4. Fix submissions table (free-text column, no enum cast needed)    #
    # ------------------------------------------------------------------ #
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Experimental' "
        "WHERE lower(maturity) IN ('prototype', 'experimental')"
    ))
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Battle-Tested' "
        "WHERE lower(maturity) IN ('beta', 'battletested', 'battle-tested', "
        "'battle_tested', 'beta phase')"
    ))
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Production' "
        "WHERE lower(maturity) IN ('production', 'validated')"
    ))


def downgrade() -> None:
    pass  # non-destructive data migration — no meaningful downgrade
