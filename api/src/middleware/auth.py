"""FastAPI authentication dependency  -  extracts and verifies Firebase JWT from request headers.

Usage in routes:
    from src.middleware.auth import require_auth, CurrentUser

    @router.get("/protected")
    async def protected_route(user: CurrentUser):
        return {"message": f"Hello {user['email']}"}
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException, status

from src.services.auth_service import auth_service

logger = logging.getLogger(__name__)


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """FastAPI dependency that extracts and verifies the current user.

    Args:
        authorization: Authorization header (Bearer <token>)

    Returns:
        Verified user claims dict

    Raises:
        HTTPException: 401 if token is missing or invalid
    """
    try:
        user = await auth_service.verify_token(authorization)
        if not user.get("authorized"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User is not authorized",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


# Type alias for use in route signatures
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


async def get_optional_user(
    authorization: str | None = Header(default=None),
) -> dict[str, Any] | None:
    """Like get_current_user but returns None instead of raising 401.

    Useful for routes that behave differently for authenticated vs anonymous users.
    """
    if not authorization:
        return None
    try:
        return await auth_service.verify_token(authorization)
    except (ValueError, Exception):
        return None


OptionalUser = Annotated[dict[str, Any] | None, Depends(get_optional_user)]
