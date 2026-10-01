"""Role-Based Access Control (RBAC) middleware for SynthetIQ API.

Defines a permission matrix mapping roles to allowed actions,
and provides FastAPI dependencies for route-level enforcement.

Usage:
    from src.middleware.rbac import require_role, require_any_role

    @router.post("/admin-only")
    async def admin_route(user: CurrentUser, _: None = Depends(require_role("admin"))):
        ...

    @router.post("/officers-or-admins")
    async def officer_route(
        user: CurrentUser,
        _: None = Depends(require_any_role("admin", "compliance_officer")),
    ):
        ...
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from fastapi import Depends, HTTPException, status

from src.middleware.auth import get_current_user

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Permission Matrix
# ---------------------------------------------------------------------------
# Maps role -> set of allowed permissions

PERMISSIONS: dict[str, set[str]] = {
    "admin": {
        "orgs:read", "orgs:write", "orgs:delete",
        "users:read", "users:write", "users:delete",
        "schedules:read", "schedules:write", "schedules:delete",
        "workflows:read", "workflows:execute",
        "audits:read", "audits:write",
        "config:read", "config:write",
        "datasources:read", "datasources:write", "datasources:delete",
    },
    "compliance_officer": {
        "orgs:read",
        "users:read",
        "schedules:read",
        "workflows:read", "workflows:execute",
        "audits:read", "audits:write",
        "config:read",
        "datasources:read",
    },
    "auditor": {
        "orgs:read",
        "workflows:read",
        "audits:read", "audits:write",
        "config:read",
    },
    "viewer": {
        "orgs:read",
        "workflows:read",
        "audits:read",
    },
}


def get_user_permissions(role: str) -> set[str]:
    """Get the permission set for a given role.

    Args:
        role: User role string

    Returns:
        Set of permission strings
    """
    return PERMISSIONS.get(role, set())


def has_permission(user: dict[str, Any], permission: str) -> bool:
    """Check if a user has a specific permission.

    Args:
        user: User claims dict with 'role' key
        permission: Permission string (e.g., 'workflows:execute')

    Returns:
        True if the user's role grants the permission
    """
    role = user.get("role", "viewer")
    return permission in get_user_permissions(role)


# ---------------------------------------------------------------------------
# FastAPI Dependencies
# ---------------------------------------------------------------------------

def require_role(*allowed_roles: str) -> Callable:
    """Create a dependency that requires the user to have one of the specified roles.

    Args:
        *allowed_roles: Accepted role names

    Returns:
        FastAPI dependency function
    """
    async def _check_role(
        user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        user_role = user.get("role", "viewer")
        if user_role not in allowed_roles:
            logger.warning(
                f"Access denied: user={user.get('email')} role={user_role} "
                f"required={allowed_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(allowed_roles)}",
            )
        return user

    return _check_role


def require_permission(permission: str) -> Callable:
    """Create a dependency that requires a specific permission.

    Args:
        permission: Permission string (e.g., 'workflows:execute')

    Returns:
        FastAPI dependency function
    """
    async def _check_permission(
        user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        if not has_permission(user, permission):
            user_role = user.get("role", "viewer")
            logger.warning(
                f"Permission denied: user={user.get('email')} role={user_role} "
                f"required={permission}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: '{permission}' not granted to role '{user_role}'",
            )
        return user

    return _check_permission


def require_org_member(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Ensure the user belongs to an organization.

    Returns:
        User claims dict (guaranteed to have org_id)

    Raises:
        HTTPException: 403 if user has no org_id
    """
    if not user.get("org_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not associated with any organization",
        )
    return user
