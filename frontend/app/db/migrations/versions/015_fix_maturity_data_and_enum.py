"""015 fix maturity data — normalise stale values to Experimental/Battle-Tested/Production

Revision ID: 015_fix_maturity_data_and_enum
Revises: 014_add_rejected_onhold_statuses
Create Date: 2026-07-07

Production was running old code (Prototype/Beta/Production enum) while the DB had
rows with 'Experimental' inserted by the newer local code. This migration normalises
all rows to the canonical three values so any code version reads them cleanly.

The catalog_assets.maturity column is kept as VARCHAR (the model was changed from
SAEnum to String(50) to avoid future enum/code version mismatches).
"""
from alembic import op
from sqlalchemy import text

revision = "015_fix_maturity_data_and_enum"
down_revision = "014_add_rejected_onhold_statuses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Cast column to VARCHAR first (idempotent if already VARCHAR)
    conn.execute(text("COMMIT"))
    conn.execute(text(
        "ALTER TABLE catalog_assets "
        "ALTER COLUMN maturity TYPE VARCHAR(50) USING maturity::text"
    ))
    conn.execute(text("BEGIN"))

    # Normalise catalog_assets rows
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Experimental' "
        "WHERE lower(maturity) IN ('prototype', 'experimental')"
    ))
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Battle-Tested' "
        "WHERE lower(maturity) IN ('beta', 'battle-tested', 'battletested', "
        "'battle_tested', 'validated')"
    ))
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Production' "
        "WHERE lower(maturity) = 'production'"
    ))
    # Fallback for any unrecognised value
    conn.execute(text(
        "UPDATE catalog_assets SET maturity = 'Experimental' "
        "WHERE maturity NOT IN ('Experimental', 'Battle-Tested', 'Production')"
    ))

    # Normalise free-text submissions.maturity
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Experimental' "
        "WHERE lower(maturity) IN ('prototype', 'experimental')"
    ))
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Battle-Tested' "
        "WHERE lower(maturity) IN ('beta', 'battle-tested', 'battletested', "
        "'battle_tested', 'validated')"
    ))
    conn.execute(text(
        "UPDATE submissions SET maturity = 'Production' "
        "WHERE lower(maturity) = 'production'"
    ))


def downgrade() -> None:
    pass  # data normalisation — no meaningful rollback
