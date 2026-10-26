from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator, Optional, Union

from azure.storage.blob import BlobSasPermissions, ContentSettings, generate_blob_sas
from azure.storage.blob.aio import BlobServiceClient

from app.config import get_settings

logger = logging.getLogger(__name__)

CONTAINER = "artifacts"


def _connection_string() -> str:
    cs = get_settings().blob_connection_string
    if not cs:
        raise RuntimeError(
            "Blob storage is not configured. "
            "Set BLOB_CONNECTION_STRING in Azure App Service Application Settings "
            "or as a Key Vault secret named 'blob-connection-string'."
        )
    return cs


async def upload_blob_stream(
    blob_name: str,
    stream: AsyncIterator[bytes],
    content_type: str,
    length: int,
) -> str:
    """
    Stream bytes from an async iterator directly to Azure Blob Storage.
    No in-memory buffering — suitable for large files (100 MB+).
    `length` must be the exact byte count (use Content-Length header).
    """
    settings = get_settings()
    conn_str = _connection_string()

    async with BlobServiceClient.from_connection_string(conn_str) as client:
        container_client = client.get_container_client(CONTAINER)
        try:
            await container_client.create_container()
        except Exception:
            pass

        blob_client = container_client.get_blob_client(blob_name)
        await blob_client.upload_blob(
            stream,
            overwrite=True,
            length=length,
            content_settings=ContentSettings(
                content_type=content_type,
                content_disposition="attachment" if blob_name.lower().endswith((".html", ".htm", ".js")) else None,
            ),
            max_concurrency=4,
        )

    return _make_sas_url(
        blob_name,
        account_name=settings.blob_account_name,
        account_key=settings.blob_account_key,
        expiry_hours=24 * 365 * 10,
    )


async def upload_blob(blob_name: str, data: bytes, content_type: str) -> str:
    """
    Upload bytes to the artifacts container and return a long-lived SAS URL.

    SAS URLs work regardless of whether the storage account allows anonymous
    access (which Azure disables by default on accounts created after 2023).
    """
    settings = get_settings()
    conn_str = _connection_string()

    async with BlobServiceClient.from_connection_string(conn_str) as client:
        container_client = client.get_container_client(CONTAINER)

        # Create container without public access — access is controlled by SAS
        try:
            await container_client.create_container()
        except Exception:
            pass  # Already exists

        blob_client = container_client.get_blob_client(blob_name)
        await blob_client.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(
                content_type=content_type,
                content_disposition="attachment" if blob_name.lower().endswith((".html", ".htm", ".js")) else None,
            ),
        )

    # Return a 10-year SAS URL so stored URLs don't expire in practice
    return _make_sas_url(
        blob_name,
        account_name=settings.blob_account_name,
        account_key=settings.blob_account_key,
        expiry_hours=24 * 365 * 10,
    )


async def delete_blob(blob_name: str) -> None:
    """Delete a blob by its name (path within the artifacts container)."""
    async with BlobServiceClient.from_connection_string(_connection_string()) as client:
        blob_client = client.get_blob_client(container=CONTAINER, blob=blob_name)
        try:
            await blob_client.delete_blob(delete_snapshots="include")
        except Exception as exc:
            logger.warning("delete_blob: %s — %s", blob_name, exc)


async def generate_sas_url(blob_name: str, expiry_hours: int = 24) -> str:
    """Generate a time-limited SAS URL for a private blob."""
    settings = get_settings()
    return _make_sas_url(
        blob_name,
        account_name=settings.blob_account_name,
        account_key=settings.blob_account_key,
        expiry_hours=expiry_hours,
    )


def _make_sas_url(
    blob_name: str,
    account_name: str,
    account_key: str,
    expiry_hours: int,
) -> str:
    if not account_name or not account_key:
        # Fallback: plain URL (works only if container has public access)
        logger.warning(
            "blob_account_name or blob_account_key not set — returning plain URL. "
            "Set BLOB_ACCOUNT_NAME and BLOB_ACCOUNT_KEY in App Service settings."
        )
        return (
            f"https://{account_name or 'unknown'}.blob.core.windows.net"
            f"/{CONTAINER}/{blob_name}"
        )

    expiry = datetime.now(tz=timezone.utc) + timedelta(hours=expiry_hours)
    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=CONTAINER,
        blob_name=blob_name,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=expiry,
    )
    return (
        f"https://{account_name}.blob.core.windows.net"
        f"/{CONTAINER}/{blob_name}?{sas_token}"
    )


def make_direct_upload_urls(blob_name: str, expiry_minutes: int = 30) -> tuple[str, str]:
    """Return a short-lived write SAS URL and the long-lived read URL for one blob."""
    settings = get_settings()
    if not settings.blob_account_name or not settings.blob_account_key:
        raise RuntimeError("Blob account name/key are required for direct uploads.")
    now = datetime.now(tz=timezone.utc)
    token = generate_blob_sas(
        account_name=settings.blob_account_name,
        container_name=CONTAINER,
        blob_name=blob_name,
        account_key=settings.blob_account_key,
        permission=BlobSasPermissions(read=True, create=True, write=True),
        start=now - timedelta(minutes=5),
        expiry=now + timedelta(minutes=expiry_minutes),
    )
    base_url = f"https://{settings.blob_account_name}.blob.core.windows.net/{CONTAINER}/{blob_name}"
    return f"{base_url}?{token}", _make_sas_url(
        blob_name,
        account_name=settings.blob_account_name,
        account_key=settings.blob_account_key,
        expiry_hours=24 * 365 * 10,
    )


def make_html_attachment_url(blob_name: str, download_name: str = "") -> str:
    """Issue a short-lived direct download link that cannot render HTML inline."""
    settings = get_settings()
    if not settings.blob_account_name or not settings.blob_account_key:
        raise RuntimeError("Blob account name/key are required for direct downloads.")
    filename = os.path.basename(download_name or blob_name).replace('"', "").replace("\r", "").replace("\n", "")
    if not filename.lower().endswith((".html", ".htm")):
        filename = os.path.basename(blob_name)
    token = generate_blob_sas(
        account_name=settings.blob_account_name,
        container_name=CONTAINER,
        blob_name=blob_name,
        account_key=settings.blob_account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(tz=timezone.utc) + timedelta(minutes=5),
        content_disposition=f'attachment; filename="{filename}"',
        content_type="application/octet-stream",
        cache_control="no-store",
    )
    from urllib.parse import quote

    return f"https://{settings.blob_account_name}.blob.core.windows.net/{CONTAINER}/{quote(blob_name, safe='/')}?{token}"


def extract_blob_name(url: str) -> str | None:
    """Extract the blob path from a stored Azure Blob URL (with or without SAS token).

    e.g. https://account.blob.core.windows.net/artifacts/family/id/videos/file.mp4?sv=...
    returns 'family/id/videos/file.mp4'
    """
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        # path is like /artifacts/family/id/videos/file.mp4
        path = parsed.path.lstrip("/")
        # strip the container prefix
        container_prefix = CONTAINER + "/"
        if path.startswith(container_prefix):
            return path[len(container_prefix):]
    except Exception:
        pass
    return None


def refresh_sas_url(stored_url: str | None) -> str | None:
    """Return a fresh 10-year SAS URL for a stored blob URL, regenerating the token.

    If the stored URL has an expired SAS, this replaces it with a valid one.
    Returns None if the URL is None or the blob name cannot be extracted.
    """
    if not stored_url:
        return stored_url
    blob_name = extract_blob_name(stored_url)
    if not blob_name:
        return stored_url  # can't parse — return as-is
    settings = get_settings()
    if not settings.blob_account_name or not settings.blob_account_key:
        return stored_url  # no key available — return as-is
    return _make_sas_url(
        blob_name,
        account_name=settings.blob_account_name,
        account_key=settings.blob_account_key,
        expiry_hours=24 * 365 * 10,
    )


def make_blob_name(
    media_type: str,
    filename: str,
    family: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> str:
    """
    Build the blob path.

    With family + entity_id  →  {family_slug}/{entity_id}/{media_type}/{filename}
    With family only         →  {family_slug}/drafts/{media_type}/{filename}
    Fallback (no family)     →  drafts/{media_type}/{filename}
    """
    safe = filename.replace(" ", "_")
    family_slug = family.lower().replace(" ", "-") if family else None

    if family_slug and entity_id:
        return f"{family_slug}/{entity_id}/{media_type}/{safe}"
    if family_slug:
        return f"{family_slug}/drafts/{media_type}/{safe}"
    return f"drafts/{media_type}/{safe}"
