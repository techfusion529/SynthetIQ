"""Tenant context dependency  -  resolves org_id, role, and platform_admin flag.

Usage in routes:
    from src.utils.tenant import TenantCtx, get_tenant_ctx, set_rls_context
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.middleware.auth import get_current_user

logger = logging.getLogger(__name__)


class TenantCtx(BaseModel):
    org_id: str
    user_id: str
    role: str
    is_platform_admin: bool


async def get_tenant_ctx(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> TenantCtx:
    """Derive TenantCtx from the authenticated user.

    - platform_admin users get org_id="" and is_platform_admin=True
    - regular users get org_id and role from their active Membership row
    - users with no membership get HTTP 403
    """
    user_id: str = current_user.get("uid", "")
    role: str = current_user.get("role", "viewer")

    # Platform admins bypass org scoping
    if current_user.get("role") == "platform_admin" or current_user.get("platform_admin"):
        return TenantCtx(
            org_id="",
            user_id=user_id,
            role=role,
            is_platform_admin=True,
        )

    # For regular users, use the org_id from the JWT/DB (set by get_current_user)
    org_id: str = current_user.get("org_id", "")

    # If we have an org_id from the JWT, try to confirm with Membership table
    if org_id:
        try:
            from synthetiq_shared.database import get_db_session
            from synthetiq_shared.models import Membership
            async with get_db_session() as session:
                result = await session.execute(
                    select(Membership)
                    .where(Membership.user_id == user_id)
                    .where(Membership.org_id == org_id)
                    .where(Membership.is_active.is_(True))
                )
                membership = result.scalar_one_or_none()
                if membership:
                    role = membership.role
                # If no membership row exists yet, fall through to use JWT values
                # (supports legacy users created before memberships were introduced)
        except Exception as exc:
            logger.warning(f"Could not query Membership for user {user_id}: {exc}")

    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not associated with any organisation. No active membership found.",
        )

    # Add org_id as an OTel span attribute for distributed tracing
    try:
        from opentelemetry import trace as _otel_trace
        _otel_trace.get_current_span().set_attribute("org_id", org_id)
    except Exception:
        pass

    return TenantCtx(
        org_id=org_id,
        user_id=user_id,
        role=role,
        is_platform_admin=False,
    )


async def set_rls_context(session: AsyncSession, org_id: str) -> None:
    """SET LOCAL app.org_id for row-level security within the current transaction."""
    await session.execute(text("SET LOCAL app.org_id = :oid"), {"oid": org_id})
