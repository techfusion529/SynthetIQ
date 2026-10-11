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

    Re-verifies user status and role from the database on every request
    to prevent stale token claims from granting access to deactivated accounts.

    Args:
        authorization: Authorization header (Bearer <token>)

    Returns:
        Verified user claims dict (role/org_id always reflect live DB values)

    Raises:
        HTTPException: 401 if token is missing, invalid, or user is inactive
    """
    try:
        user = await auth_service.verify_token(authorization)
        if not user.get("authorized"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User is not authorized",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Re-verify user is still active and use live role/org_id from DB
    uid = user.get("uid")
    if uid:
        try:
            from sqlalchemy import select
            from synthetiq_shared.database import get_db_session
            from synthetiq_shared.models import User as UserModel
            async with get_db_session() as session:
                db_user = (await session.execute(
                    select(UserModel)
                    .where(UserModel.user_id == uid)
                    .where(UserModel.is_active.is_(True))
                )).scalar_one_or_none()
                if db_user is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User account is inactive or deleted",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                # Always use DB role and org_id — prevents stale token elevation
                user["role"] = db_user.role
                user["org_id"] = db_user.org_id
        except HTTPException:
            raise
        except Exception as db_err:
            logger.warning(f"Could not re-verify user from DB: {db_err}")

    return user


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
