"""User Management Router — Per-tenant user administration and role management.

RBAC:
  GET    /organizations/{org_id}/users          → users:read  (viewer+)
  POST   /organizations/{org_id}/users          → users:write (admin)
  PATCH  /organizations/{org_id}/users/{uid}/role → users:write (admin)
  DELETE /organizations/{org_id}/users/{uid}      → users:write (admin)
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.jwt_utils import hash_password
from synthetiq_shared.database import get_db_session
from synthetiq_shared.models import Organization, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/organizations/{org_id}/users", tags=["User Management"])

VALID_ROLES = {"admin", "compliance_officer", "auditor", "viewer"}


class CreateUserRequest(BaseModel):
    email: str
    display_name: str
    role: Literal["admin", "compliance_officer", "auditor", "viewer"] = "viewer"
    password: str = "Password123!"


class UpdateRoleRequest(BaseModel):
    role: Literal["admin", "compliance_officer", "auditor", "viewer"]


def _verify_tenant_access(user: dict[str, Any], org_id: str) -> None:
    """Ensure non-admins cannot access other organizations."""
    if user.get("role") != "admin" and user.get("org_id") != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization's users",
        )


@router.get("/")
async def list_users(
    org_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("users:read")),
) -> list[dict[str, Any]]:
    """List all active members belonging to an organization."""
    _verify_tenant_access(user, org_id)

    async with get_db_session() as session:
        # Check org exists
        res = await session.execute(select(Organization).where(Organization.org_id == org_id))
        if not res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Organization {org_id!r} not found")

        res_users = await session.execute(
            select(User)
            .where(User.org_id == org_id)
            .where(User.is_active.is_(True))
            .order_by(User.created_at.desc())
        )
        users = res_users.scalars().all()

        return [
            {
                "user_id": u.user_id,
                "email": u.email,
                "display_name": u.display_name,
                "role": u.role,
                "org_id": u.org_id,
                "is_active": u.is_active,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]


@router.post("/")
async def invite_or_create_user(
    org_id: str,
    payload: CreateUserRequest,
    user: CurrentUser,
    _: Any = Depends(require_permission("users:write")),
) -> dict[str, Any]:
    """Add a new user to the organization with an assigned RBAC role."""
    _verify_tenant_access(user, org_id)

    email = payload.email.strip().lower()

    async with get_db_session() as session:
        # Check organization exists
        res = await session.execute(select(Organization).where(Organization.org_id == org_id))
        org = res.scalar_one_or_none()
        if not org:
            raise HTTPException(status_code=404, detail=f"Organization {org_id!r} not found")

        # Check if email is already taken
        res_user = await session.execute(select(User).where(User.email == email))
        if res_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with email {email!r} already exists",
            )

        new_user = User(
            user_id=f"USR-{uuid.uuid4().hex[:8].upper()}",
            email=email,
            display_name=payload.display_name,
            password_hash=hash_password(payload.password),
            role=payload.role,
            org_id=org_id,
            is_active=True,
        )
        session.add(new_user)
        logger.info(f"User {email} added to org {org_id} with role {payload.role} by {user['email']}")

        return {
            "user_id": new_user.user_id,
            "email": new_user.email,
            "display_name": new_user.display_name,
            "role": new_user.role,
            "org_id": new_user.org_id,
            "is_active": new_user.is_active,
            "created_at": new_user.created_at.isoformat() if new_user.created_at else None,
        }


@router.patch("/{user_id}/role")
async def update_user_role(
    org_id: str,
    user_id: str,
    payload: UpdateRoleRequest,
    user: CurrentUser,
    _: Any = Depends(require_permission("users:write")),
) -> dict[str, Any]:
    """Change the RBAC role for an existing organization member."""
    _verify_tenant_access(user, org_id)

    async with get_db_session() as session:
        res = await session.execute(
            select(User).where(User.user_id == user_id).where(User.org_id == org_id)
        )
        target_user = res.scalar_one_or_none()
        if not target_user:
            raise HTTPException(status_code=404, detail=f"User {user_id!r} not found in this organization")

        # Prevent changing own role if sole admin
        if target_user.user_id == user.get("uid") and payload.role != "admin":
            admin_count_res = await session.execute(
                select(User).where(User.org_id == org_id).where(User.role == "admin").where(User.is_active.is_(True))
            )
            if len(admin_count_res.scalars().all()) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot downgrade role of the sole organization administrator",
                )

        target_user.role = payload.role
        logger.info(f"Updated role for {target_user.email} to {payload.role} by {user['email']}")

        return {
            "user_id": target_user.user_id,
            "email": target_user.email,
            "role": target_user.role,
            "updated_by": user["email"],
        }


@router.delete("/{user_id}")
async def deactivate_user(
    org_id: str,
    user_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("users:write")),
) -> dict[str, Any]:
    """Deactivate or remove a user from the organization."""
    _verify_tenant_access(user, org_id)

    if user_id == user.get("uid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account while logged in",
        )

    async with get_db_session() as session:
        res = await session.execute(
            select(User).where(User.user_id == user_id).where(User.org_id == org_id)
        )
        target_user = res.scalar_one_or_none()
        if not target_user:
            raise HTTPException(status_code=404, detail=f"User {user_id!r} not found in this organization")

        target_user.is_active = False
        logger.info(f"Deactivated user {target_user.email} from org {org_id} by {user['email']}")

        return {
            "user_id": user_id,
            "email": target_user.email,
            "status": "deactivated",
            "deactivated_by": user["email"],
        }
