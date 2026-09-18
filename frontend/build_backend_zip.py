"""
build_backend_zip.py
--------------------
Builds backend.zip (staging) and backend_prod.zip (production) for Azure App Service deployment.

Strategy:
- Reads the EXISTING deployed backend zip (backend_base.zip or backend_prod_base.zip) as the
  "golden" base which has the correct module structure (app.deps.rbac, app.db.base, etc.)
- Patches/adds specific files that need changes for email notifications:
    * app/services/email_service.py  (our version with new email functions)
    * app/routers/clone_requests.py  (from zip_patches/ - correct deployed-backend imports)
    * app/routers/demo_requests.py   (from zip_patches/ - new file, correct imports)
  and fixes:
    * app/main.py                    (fix app.core.config -> app.config, add demo_requests router)
    * app/db/migrations/env.py       (fix app.core.config -> app.config, app.db.session -> app.db.base)
- Always writes ZIP entries with forward-slash paths (required for Linux Azure App Service rsync).

Usage:
    python build_backend_zip.py
"""

import io
import os
import zipfile

REPO_DIR = os.path.dirname(os.path.abspath(__file__))
ZIP_PATCHES_DIR = os.path.join(REPO_DIR, "zip_patches")
ACTIVE_BACKEND_DIR = os.path.abspath(os.path.join(REPO_DIR, "..", "..", "amplify-backend"))

# ---- Environment-specific config ----

ENVIRONMENTS = {
    "staging": {
        "base_zip": os.path.join(REPO_DIR, "backend_04082026.zip"),
        "output_zip": os.path.join(REPO_DIR, "backend.zip"),
    },
    "production": {
        "base_zip": os.path.join(REPO_DIR, "backend_prod_04082026.zip"),
        "output_zip": os.path.join(REPO_DIR, "backend_prod.zip"),
    },
}

# No text fixes needed — all patched files are in zip_patches/ with correct content
TEXT_FIXES: dict = {}

# No local repo patches — all patches come from zip_patches/ based on the working deployed zip
LOCAL_REPO_PATCHES = {
    "app/config.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "config.py"),
    "app/main.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "main.py"),
    "app/db/base.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "db", "base.py"),
    "startup.sh": os.path.join(ACTIVE_BACKEND_DIR, "startup.sh"),
    "requirements.txt": os.path.join(ACTIVE_BACKEND_DIR, "requirements.txt"),
    "app/services/agents/base.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "services", "agents", "base.py"),
    "app/services/orchestrator.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "services", "orchestrator.py"),
    "app/routers/submissions.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "routers", "submissions.py"),
    "app/routers/admin.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "routers", "admin.py"),
    "app/schemas/admin.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "schemas", "admin.py"),
    "app/db/models.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "db", "models.py"),
    "app/routers/catalog.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "routers", "catalog.py"),
    "app/routers/portal_settings.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "routers", "portal_settings.py"),
    "app/schemas/catalog.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "schemas", "catalog.py"),
    "app/schemas/portal_settings.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "schemas", "portal_settings.py"),
    "app/schemas/submission.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "schemas", "submission.py"),
    "app/db/migrations/versions/023_add_multiple_demo_videos.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "db", "migrations", "versions", "023_add_multiple_demo_videos.py"),
    "app/db/migrations/versions/024_add_aiv_ideation_mapping.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "db", "migrations", "versions", "024_add_aiv_ideation_mapping.py"),
    "app/routers/media.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "routers", "media.py"),
    "app/services/blob_service.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "services", "blob_service.py"),
    "app/services/executive_report_service.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "services", "executive_report_service.py"),
    "app/services/observability_report_service.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "services", "observability_report_service.py"),
    "app/services/notification_service.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "services", "notification_service.py"),
    "app/services/aiv_ideation_service.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "services", "aiv_ideation_service.py"),
    "app/routers/integrations.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "routers", "integrations.py"),
    "app/routers/notifications.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "routers", "notifications.py"),
    "app/routers/audit.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "routers", "audit.py"),
}

# Always package the complete Alembic history from the active backend. Packaging
# only the newest revision can break Azure startup when that revision points to
# a predecessor that is absent from an older golden base ZIP.
MIGRATIONS_DIR = os.path.join(ACTIVE_BACKEND_DIR, "app", "db", "migrations", "versions")
for migration_name in sorted(os.listdir(MIGRATIONS_DIR)):
    if migration_name.endswith(".py") and migration_name != "__init__.py":
        LOCAL_REPO_PATCHES[f"app/db/migrations/versions/{migration_name}"] = os.path.join(
            MIGRATIONS_DIR, migration_name
        )

REQUIRED_MARKERS = {
    "app/services/agents/base.py": b"_get_llm_configs",
    "app/routers/submissions.py": b"ai_scoring_retried",
    "app/services/orchestrator.py": b"preserve_status",
    "app/routers/admin.py": b"executive-report",
    "app/schemas/admin.py": b"ExecutiveReportResponse",
    "app/db/migrations/versions/022_add_asset_view_count.py": b'revision = "022"',
    "app/db/migrations/versions/024_add_aiv_ideation_mapping.py": b'down_revision = "023"',
}

# Files to take from zip_patches/ directory (correct deployed-backend versions)
# main.py and env.py from the working zip are already correct — not patched
ZIP_PATCH_FILES = {
    "app/services/email_service.py": os.path.join(ZIP_PATCHES_DIR, "email_service.py"),
    "app/routers/clone_requests.py": os.path.join(ZIP_PATCHES_DIR, "clone_requests.py"),
    # Demo request approval workflow is maintained in the active backend.
    "app/routers/demo_requests.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "routers", "demo_requests.py"),
    "app/routers/likes.py": os.path.join(ZIP_PATCHES_DIR, "likes.py"),
    "app/schemas/demo_request.py": os.path.join(ACTIVE_BACKEND_DIR, "app", "schemas", "demo_request.py"),
    "app/routers/users.py": os.path.join(ZIP_PATCHES_DIR, "users.py"),
}


def _apply_text_fixes(content: str, fixes: list) -> str:
    for old, new in fixes:
        content = content.replace(old, new)
    return content


def build_zip(env_name: str, config: dict) -> None:
    base_zip_path = config["base_zip"]
    output_zip_path = config["output_zip"]

    print(f"\n{'='*60}")
    print(f"Building {env_name}: {output_zip_path}")
    print(f"Base zip: {base_zip_path}")

    if not os.path.exists(base_zip_path):
        print(f"  ERROR: Base zip not found: {base_zip_path}")
        print("  Skipping this environment.")
        return

    # Read all entries from base zip
    base_entries: dict[str, bytes] = {}
    with zipfile.ZipFile(base_zip_path, "r") as zf_in:
        for name in zf_in.namelist():
            # Normalize to forward slashes
            normalized = name.replace("\\", "/")
            if os.path.basename(normalized).startswith(".env"):
                print(f"  Excluded environment file: {normalized}")
                continue
            base_entries[normalized] = zf_in.read(name)
    print(f"  Loaded {len(base_entries)} entries from base zip.")

    # Apply local repo patches (with text fixes)
    patched_count = 0
    for zip_path, local_path in LOCAL_REPO_PATCHES.items():
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Required active-backend file not found: {local_path}")
        with open(local_path, "r", encoding="utf-8") as f:
            content = f.read()
        # Apply text fixes if defined
        if zip_path in TEXT_FIXES:
            content = _apply_text_fixes(content, TEXT_FIXES[zip_path])
        base_entries[zip_path] = content.encode("utf-8")
        patched_count += 1
        print(f"  Patched (local): {zip_path}")

    # Apply zip_patches/ files (already correct for deployed backend)
    for zip_path, patch_path in ZIP_PATCH_FILES.items():
        if not os.path.exists(patch_path):
            print(f"  WARN: Patch file not found, skipping: {patch_path}")
            continue
        with open(patch_path, "rb") as f:
            base_entries[zip_path] = f.read()
        patched_count += 1
        print(f"  Patched (zip_patches): {zip_path}")

    print(f"  Total patched: {patched_count} files.")

    for zip_path, marker in REQUIRED_MARKERS.items():
        if marker not in base_entries.get(zip_path, b""):
            raise RuntimeError(
                f"Validation failed for {zip_path}: required scoring feature is missing"
            )
    print("  Scoring pipeline validation passed.")

    # Write output zip with forward-slash paths
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf_out:
        for name, data in base_entries.items():
            # Always use forward slashes
            zf_out.writestr(name.replace("\\", "/"), data)
    buf.seek(0)

    with open(output_zip_path, "wb") as f:
        f.write(buf.read())

    size_mb = os.path.getsize(output_zip_path) / (1024 * 1024)
    print(f"  Written: {output_zip_path} ({size_mb:.1f} MB)")


def main() -> None:
    print("Backend ZIP builder")
    print(f"Repo: {REPO_DIR}")
    print(f"Active backend: {ACTIVE_BACKEND_DIR}")
    print(f"Patches dir: {ZIP_PATCHES_DIR}")

    for env_name, config in ENVIRONMENTS.items():
        build_zip(env_name, config)

    print("\nDone.")


if __name__ == "__main__":
    main()
