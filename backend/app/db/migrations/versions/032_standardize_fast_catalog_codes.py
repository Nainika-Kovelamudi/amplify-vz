"""standardize FAST catalog codes using the first three family characters

Revision ID: 032
Revises: 031
"""
from alembic import op


revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Some legacy assets were imported with owner UUIDs whose user-profile rows
    # were never migrated.  PostgreSQL rechecks that FK when these rows are
    # updated, so recover the missing profiles first instead of dropping the
    # constraint, nulling ownership, or deleting assets.
    op.execute("""
        INSERT INTO user_profiles (
            id,
            azure_oid,
            email,
            display_name,
            role,
            department,
            role_locked,
            created_at,
            updated_at
        )
        SELECT
            a.owner_id,
            'recovered-' || a.owner_id::text,
            'recovered+' || a.owner_id::text || '@aimplify.local',
            COALESCE(NULLIF(MAX(a.owner_name), ''), 'Recovered asset owner'),
            'Aimplify.User'::user_role_enum,
            NULLIF(MAX(a.department), ''),
            TRUE,
            NOW(),
            NOW()
        FROM catalog_assets a
        LEFT JOIN user_profiles u ON u.id = a.owner_id
        WHERE u.id IS NULL
        GROUP BY a.owner_id
    """)

    # Build the complete mapping before changing any values.  Numbering is
    # deterministic within each family and does not depend on legacy prefixes.
    op.execute("""
        CREATE TEMP TABLE fast_code_map ON COMMIT DROP AS
        SELECT
            id,
            catalog_code AS old_code,
            CASE LOWER(family)
                WHEN 'forge' THEN 'FOR'
                WHEN 'atlas' THEN 'ATL'
                WHEN 'sentinel' THEN 'SEN'
                WHEN 'titan' THEN 'TIT'
            END || '-' || LPAD(
                ROW_NUMBER() OVER (
                    PARTITION BY LOWER(family)
                    ORDER BY created_at, id
                )::text,
                3,
                '0'
            ) AS new_code
        FROM catalog_assets
        WHERE LOWER(family) IN ('forge', 'atlas', 'sentinel', 'titan')
    """)

    # Move every affected asset to a unique temporary value first so swaps and
    # renumbering cannot violate the catalog_code unique constraint.
    op.execute("""
        UPDATE catalog_assets a
        SET catalog_code = '__FAST032__' || a.id::text
        FROM fast_code_map m
        WHERE a.id = m.id
    """)

    # Preserve links in legacy submission rows that store the public code.
    op.execute("""
        UPDATE submissions s
        SET catalog_code = m.new_code
        FROM fast_code_map m
        WHERE s.catalog_code = m.old_code
    """)

    op.execute("""
        UPDATE catalog_assets a
        SET catalog_code = m.new_code
        FROM fast_code_map m
        WHERE a.id = m.id
    """)


def downgrade() -> None:
    # Legacy prefixes were inconsistent, so their exact original values cannot
    # be reconstructed safely.
    pass
