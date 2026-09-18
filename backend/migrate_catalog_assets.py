"""
Migrate catalog_assets table data from staging (postgres db) → production (aimplify_prod db).
Skips rows that already exist in prod (by id). Safe to run multiple times.
"""
import psycopg2
import psycopg2.extras
from datetime import datetime

STAGING_DSN = {
    "host": "aimplify-db.postgres.database.azure.com",
    "port": 5432,
    "dbname": "postgres",
    "user": "aimplify",
    "password": "Infovision@123",
    "sslmode": "require",
}

PROD_DSN = {
    "host": "aimplify-db.postgres.database.azure.com",
    "port": 5432,
    "dbname": "aimplify_prod",
    "user": "aimplify",
    "password": "Infovision@123",
    "sslmode": "require",
}


def migrate():
    print(f"[{datetime.now():%H:%M:%S}] Connecting to staging...")
    src = psycopg2.connect(**STAGING_DSN)
    src.autocommit = False

    print(f"[{datetime.now():%H:%M:%S}] Connecting to production...")
    dst = psycopg2.connect(**PROD_DSN)
    dst.autocommit = False

    try:
        with src.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as sc:
            sc.execute("SELECT * FROM catalog_assets ORDER BY created_at")
            rows = sc.fetchall()

        print(f"[{datetime.now():%H:%M:%S}] Found {len(rows)} rows in staging catalog_assets.")

        if not rows:
            print("Nothing to migrate.")
            return

        # Get column names from first row
        columns = list(rows[0].keys())
        col_str = ", ".join(f'"{c}"' for c in columns)
        placeholders = ", ".join(["%s"] * len(columns))

        # Build UPDATE: set all columns except id, only for rows that already exist in prod
        non_id_cols = [c for c in columns if c != "id"]
        set_clause = ", ".join(f'"{c}" = %s' for c in non_id_cols)
        update_sql = f"""
            UPDATE catalog_assets
            SET {set_clause}
            WHERE id = %s
        """

        with dst.cursor() as dc:
            updated = 0
            skipped = 0
            for row in rows:
                set_values = [
                    psycopg2.extras.Json(row[c]) if isinstance(row[c], (dict, list)) else row[c]
                    for c in non_id_cols
                ]
                set_values.append(row["id"])  # for WHERE id = %s
                dc.execute(update_sql, set_values)
                if dc.rowcount == 1:
                    updated += 1
                else:
                    skipped += 1  # row doesn't exist in prod — skip

        dst.commit()
        print(f"[{datetime.now():%H:%M:%S}] Done. Updated: {updated}, Not in prod (skipped): {skipped}")

    except Exception as e:
        dst.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        src.close()
        dst.close()


if __name__ == "__main__":
    migrate()
