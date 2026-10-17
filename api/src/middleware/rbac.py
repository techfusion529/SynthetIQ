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
    "brand_owner": {
        "orgs:read",
        "workflows:read", "workflows:execute",
        "audits:read",
        "config:read",
        "datasources:read",
    },
    "recycler": {
        "orgs:read",
        "workflows:read", "workflows:execute",
        "audits:read",
        "config:read",
    },
    "viewer": {
        "orgs:read",
        "workflows:read",
        "audits:read",
    },
}

# platform_admin has all admin permissions plus platform-wide privileges
PERMISSIONS["platform_admin"] = PERMISSIONS["admin"] | {
    "platform:admin",
    "orgs:admin",
    "config:platform_write",
}


def get_user_permissions(role: str) -> set[str]:
    """Get the permission set for a given role."""
    return PERMISSIONS.get(role, set())


def has_permission(user: dict[str, Any], permission: str) -> bool:
    """Check if a user has a specific permission."""
    role = user.get("role", "viewer")
    return permission in get_user_permissions(role)


# ---------------------------------------------------------------------------
# Cross-tenant and platform-admin guards
# ---------------------------------------------------------------------------

def assert_same_org(token_org_id: str, resource_org_id: str) -> None:
    """Raise HTTP 403 if the token's org does not match the resource's org.

    Empty token_org_id indicates platform_admin bypass.
    """
    if not token_org_id:
        return  # platform_admin bypass
    if token_org_id != resource_org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-tenant access denied",
        )


def assert_platform_admin(user: dict[str, Any]) -> None:
    """Raise HTTP 403 if user is not a platform_admin."""
    if user.get("role") != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required",
        )


# ---------------------------------------------------------------------------
# FastAPI Dependencies
# ---------------------------------------------------------------------------

def require_platform_admin() -> Callable:
    """Dependency that requires the user to be a platform_admin."""
    async def _check(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        assert_platform_admin(user)
        return user
    return _check


def require_role(*allowed_roles: str) -> Callable:
    """Create a dependency that requires the user to have one of the specified roles."""
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
    """Create a dependency that requires a specific permission."""
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
    """Ensure the user belongs to an organization."""
    if not user.get("org_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not associated with any organization",
        )
    return user
