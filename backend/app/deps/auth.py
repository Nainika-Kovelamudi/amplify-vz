import asyncio
import functools
import logging
from typing import Any

import httpx
from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from app.config import get_settings

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=1)
def _fetch_jwks_sync(tenant_id: str) -> dict:
    url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
    with httpx.Client(timeout=10.0) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.json()


def _invalidate_jwks_cache() -> None:
    _fetch_jwks_sync.cache_clear()


async def _get_jwks(tenant_id: str) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_jwks_sync, tenant_id)


async def validate_azure_token(
    authorization: str = Header(..., alias="Authorization"),
) -> dict[str, Any]:
    """Validate Azure AD bearer token via JWKS. Returns claims dict."""
    settings = get_settings()

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        jwks = await _get_jwks(settings.azure_tenant_id)
    except httpx.HTTPError as exc:
        logger.error("Failed to fetch JWKS from Azure AD: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to fetch token signing keys.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token header.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    kid = unverified_header.get("kid")
    matching_key: dict | None = None
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            matching_key = key
            break

    if matching_key is None:
        _invalidate_jwks_cache()
        try:
            jwks = await _get_jwks(settings.azure_tenant_id)
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to fetch token signing keys.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                matching_key = key
                break

    if matching_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token signing key not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Try both access token audience (api://clientId) and ID token audience (clientId)
    payload = None
    last_exc = None
    for audience in [f"api://{settings.azure_client_id}", settings.azure_client_id]:
        try:
            payload = jwt.decode(
                token,
                matching_key,
                algorithms=["RS256"],
                audience=audience,
            )
            break
        except JWTError as exc:
            last_exc = exc

    if payload is None:
        try:
            unverified = jwt.get_unverified_claims(token)
            logger.warning("Token validation failed. aud=%s", unverified.get("aud"))
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    oid: str = payload.get("oid", "")
    email: str = payload.get("preferred_username") or payload.get("email", "")
    name: str = payload.get("name", "")

    if not oid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required 'oid' claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Map Azure App Role claims → internal role string
    # AAD puts assigned app roles in the "roles" claim as a list
    aad_roles: list[str] = payload.get("roles", [])
    if "Aimplify.Owner" in aad_roles:
        app_role = "Aimplify.Owner"
    elif "Aimplify.Admin" in aad_roles:
        app_role = "Aimplify.Admin"
    else:
        app_role = "Aimplify.User"

    return {"oid": oid, "email": email, "name": name, "app_role": app_role, "raw": payload}
