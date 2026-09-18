"""
app/services/clone_token.py
----------------------------
Service functions for minting, validating, and redeeming clone tokens.

Public API
----------
generate_clone_token  – create a new CloneToken row with a 24-hour TTL
validate_clone_token  – look up a token and enforce expiry / redeemed guards
redeem_clone_token    – stamp redeemed_at, resolve the repo blob path, return SAS URL
build_token_url       – build the frontend URL that wraps a given token UUID
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.asset import Asset
from app.models.clone_request import CloneRequest
from app.models.clone_token import CloneToken
from app.services.azure_storage import generate_sas_url

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_TOKEN_TTL_HOURS: int = 24
_SAS_TTL_HOURS: int = 24


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


async def generate_clone_token(
    clone_request_id: UUID,
    db: AsyncSession,
) -> CloneToken:
    """
    Mint a new :class:`CloneToken` for the given clone request.

    Creates a row with:
    - ``token_uuid``  – a freshly generated UUID4
    - ``expires_at``  – now + 24 hours (UTC)

    Parameters
    ----------
    clone_request_id:
        Primary key of the approved :class:`CloneRequest`.
    db:
        Active async database session. The caller is responsible for
        committing the transaction.

    Returns
    -------
    CloneToken
        The newly created (but not yet committed) ORM object.
    """
    now = _utcnow()
    token = CloneToken(
        id=str(uuid4()),
        clone_request_id=str(clone_request_id),
        token_uuid=str(uuid4()),
        expires_at=now + timedelta(hours=_TOKEN_TTL_HOURS),
        redeemed_at=None,
        created_at=now,
    )
    db.add(token)
    await db.flush()
    logger.debug(
        "Minted clone token %s for clone_request %s (expires %s)",
        token.token_uuid,
        clone_request_id,
        token.expires_at.isoformat(),
    )
    return token


async def validate_clone_token(
    token_uuid: UUID,
    db: AsyncSession,
) -> CloneToken:
    """
    Look up a :class:`CloneToken` by its public UUID and enforce validity rules.

    Raises
    ------
    HTTPException 404
        Token UUID not found in the database.
    HTTPException 410 Gone
        Token has expired (``expires_at < now``).
    HTTPException 410 Gone
        Token has already been redeemed (``redeemed_at is not None``).

    Parameters
    ----------
    token_uuid:
        The UUID that identifies the token (sent in the public URL).
    db:
        Active async database session.

    Returns
    -------
    CloneToken
        The valid, unredeemed, unexpired token ORM object.
    """
    result = await db.execute(
        select(CloneToken).where(CloneToken.token_uuid == str(token_uuid))
    )
    token: Optional[CloneToken] = result.scalar_one_or_none()

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clone token not found.",
        )

    now = _utcnow()

    # Normalise expires_at to UTC-aware for comparison
    expires_at: datetime = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Token expired",
        )

    if token.redeemed_at is not None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Token already redeemed",
        )

    return token


async def redeem_clone_token(
    token: CloneToken,
    db: AsyncSession,
) -> str:
    """
    Redeem *token* and return a time-limited Azure Blob Storage SAS URL.

    Steps
    -----
    1. Stamp ``token.redeemed_at = now`` and commit.
    2. Load the related :class:`CloneRequest` → :class:`Asset`.
    3. Resolve the repo blob path from the asset.
    4. Call :func:`generate_sas_url` to produce a 24-hour SAS URL.

    Parameters
    ----------
    token:
        A validated, unredeemed :class:`CloneToken` (from
        :func:`validate_clone_token`).
    db:
        Active async database session.

    Returns
    -------
    str
        A time-limited SAS URL pointing to the repository archive blob.

    Raises
    ------
    HTTPException 404
        If the associated clone request or asset cannot be found.
    """
    now = _utcnow()
    token.redeemed_at = now
    await db.flush()

    # Load associated clone request
    cr_result = await db.execute(
        select(CloneRequest).where(CloneRequest.id == token.clone_request_id)
    )
    cr: Optional[CloneRequest] = cr_result.scalar_one_or_none()
    if cr is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clone request '{token.clone_request_id}' not found.",
        )

    # Load associated asset
    asset_result = await db.execute(
        select(Asset).where(Asset.id == cr.asset_id)
    )
    asset: Optional[Asset] = asset_result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset '{cr.asset_id}' not found.",
        )

    # Resolve the repo blob path stored on the asset
    repo_path: str = str(
        getattr(asset, "repo_blob_path", None)
        or getattr(asset, "repo_url", None)
        or cr.asset_id
    )

    await db.commit()

    sas_url: str = generate_sas_url(
        container="repos",
        blob_name=repo_path,
        expiry_hours=_SAS_TTL_HOURS,
    )
    logger.info(
        "Redeemed clone token %s for asset '%s'; SAS URL generated.",
        token.token_uuid,
        cr.asset_id,
    )
    return sas_url


def build_token_url(token_uuid: UUID) -> str:
    """
    Build the frontend URL that wraps a clone token UUID.

    Returns
    -------
    str
        A URL of the form ``{settings.frontend_url}/clone/token/{token_uuid}``.
    """
    return f"{settings.frontend_url.rstrip('/')}/clone/token/{token_uuid}"
