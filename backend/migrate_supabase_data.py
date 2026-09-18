"""
Migrate submissions_rows.xlsx → PostgreSQL (catalog_assets + user_profiles)
Run: python migrate_supabase_data.py
"""
import json
import re
import uuid
from datetime import datetime, timezone

import pandas as pd
import psycopg2

# ── Config ────────────────────────────────────────────────────────────────────
XLSX_PATH = r"D:\GenAI\AmplifyPlatform\submissions_rows.xlsx"
DB_DSN = "host=192.168.74.12 port=5432 dbname=amplify user=postgres password=postgres"

# ── Helpers ───────────────────────────────────────────────────────────────────
FAMILY_MAP = {
    "atlas":    "Atlas",
    "forge":    "Forge",
    "sentinel": "Sentinel",
    "relay":    "Relay",
    "nexus":    "Nexus",
}

STATUS_MAP = {
    "Published":  "Published",
    "Approved":   "Approved",
    "published":  "Published",
    "approved":   "Approved",
}

MATURITY_MAP = {
    "experimental": "Beta",
    "validated":    "Production",
    "battle-tested": "Production",
    "prototype":    "Prototype",
    "beta":         "Beta",
    "production":   "Production",
}

# catalog_code prefix per family
CODE_PREFIX = {"Atlas": "ATL", "Forge": "FRG", "Sentinel": "SNT", "Relay": "RLY", "Nexus": "NXS"}
_code_counters = {}


def next_catalog_code(family: str) -> str:
    prefix = CODE_PREFIX.get(family, "GEN")
    _code_counters[prefix] = _code_counters.get(prefix, 0) + 1
    return f"{prefix}-{_code_counters[prefix]:03d}"


def slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[\s_-]+", "-", slug).strip("-")


def parse_clouds(raw) -> list:
    if pd.isna(raw) or not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return [c.strip() for c in str(raw).split(",") if c.strip()]


def safe_str(val) -> str | None:
    if pd.isna(val):
        return None
    s = str(val).strip()
    return s if s else None


def parse_dt(val) -> datetime | None:
    if pd.isna(val):
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val
    try:
        return datetime.fromisoformat(str(val)).replace(tzinfo=timezone.utc)
    except Exception:
        return None


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    df = pd.read_excel(XLSX_PATH)
    print(f"Loaded {len(df)} rows from Excel")

    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor()

    users_inserted = 0
    assets_inserted = 0
    skipped = 0

    for _, row in df.iterrows():
        # ── 1. Upsert owner in user_profiles ──────────────────────────────────
        owner_email = safe_str(row.get("owner_email"))
        author_name = safe_str(row.get("author")) or "Unknown"

        if not owner_email:
            owner_email = f"{slugify(author_name)}@amplify.local"

        # Generate a deterministic OID from email so reruns are idempotent
        azure_oid = f"migrated-{slugify(owner_email)}"

        cur.execute("""
            INSERT INTO user_profiles (id, azure_oid, email, display_name, role, department, created_at, updated_at)
            VALUES (gen_random_uuid(), %s, %s, %s, 'guest', 'Delivery', NOW(), NOW())
            ON CONFLICT (azure_oid) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
        """, (azure_oid, owner_email, author_name))

        if cur.rowcount:
            users_inserted += 1

        cur.execute("SELECT id FROM user_profiles WHERE email = %s", (owner_email,))
        owner_id = cur.fetchone()[0]

        # ── 2. Map fields ──────────────────────────────────────────────────────
        title = safe_str(row.get("asset_name")) or "Untitled"
        family_raw = safe_str(row.get("family_id")) or "nexus"
        family = FAMILY_MAP.get(family_raw.lower(), "Nexus")
        description = safe_str(row.get("description")) or ""
        maturity_raw = (safe_str(row.get("maturity")) or "experimental").lower()
        maturity = MATURITY_MAP.get(maturity_raw, "Beta")
        status_raw = safe_str(row.get("status")) or "Published"
        status = STATUS_MAP.get(status_raw, "Published")
        clouds = parse_clouds(row.get("clouds"))
        cloud_provider = clouds[0].upper() if clouds else "Azure"
        video_url = safe_str(row.get("video_url"))
        demo_ready = bool(video_url)
        score = row.get("score")
        ai_score = int(score) if pd.notna(score) and str(score).strip() not in ("", "None") else None
        created_at = parse_dt(row.get("submitted_at")) or datetime.now(timezone.utc)

        # Generate unique catalog_code and slug
        catalog_code = next_catalog_code(family)
        base_slug = slugify(title)

        # Ensure slug uniqueness by appending catalog_code suffix
        slug = f"{base_slug}-{catalog_code.lower()}"

        ai_feedback = None
        if ai_score is not None:
            ai_feedback = json.dumps({"summary": "Migrated from Supabase.", "composite_score": ai_score})

        # ── 3. Insert catalog_asset ────────────────────────────────────────────
        try:
            cur.execute("""
                INSERT INTO catalog_assets (
                    id, catalog_code, title, slug, description,
                    family, department, tech_stack, cloud_provider,
                    maturity, demo_ready, video_url,
                    status, ai_score, ai_feedback,
                    owner_id, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), %s, %s, %s, %s,
                    %s, %s, %s::jsonb, %s,
                    %s::asset_maturity_enum, %s, %s,
                    %s::asset_status_enum, %s, %s::jsonb,
                    %s, %s, NOW()
                )
                ON CONFLICT (catalog_code) DO NOTHING
            """, (
                catalog_code, title, slug, description,
                family, "Delivery", json.dumps(clouds), cloud_provider,
                maturity, demo_ready, video_url,
                status, ai_score, ai_feedback,
                owner_id, created_at,
            ))

            if cur.rowcount:
                assets_inserted += 1
                print(f"  OK  {catalog_code}  {title[:60]}")
            else:
                skipped += 1
                print(f"  --  skipped (conflict): {catalog_code}  {title[:60]}")

        except Exception as e:
            conn.rollback()
            print(f"  ERR on '{title}': {e}")
            skipped += 1
            continue

        conn.commit()

    cur.close()
    conn.close()

    print(f"\nDone — {users_inserted} users upserted, {assets_inserted} assets inserted, {skipped} skipped.")


if __name__ == "__main__":
    main()
