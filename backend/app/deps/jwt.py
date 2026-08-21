import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from jose import ExpiredSignatureError, JWTError, jwt

from app.config import get_settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 24


def create_app_jwt(user: Any) -> str:
    """Create a signed Amplify App JWT for the given UserProfile."""
    settings = get_settings()
    now = datetime.now(tz=timezone.utc)
    expiry = now + timedelta(hours=TOKEN_EXPIRY_HOURS)

    payload: dict[str, Any] = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "department": user.department,
        "iat": int(now.timestamp()),
        "exp": int(expiry.timestamp()),
    }

    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


async def decode_app_jwt(token: str) -> dict[str, Any]:
    """Decode and validate an Amplify App JWT. Raises HTTP 401 if invalid."""
    settings = get_settings()

    try:
        payload: dict[str, Any] = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return payload
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except JWTError as exc:
        logger.warning("App JWT decode failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
