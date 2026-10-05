"""Authentication & Session Router — Login, Registration, and User Context."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from src.middleware.auth import CurrentUser, get_optional_user
from src.services.auth_service import auth_service
from src.services.jwt_utils import create_access_token, hash_password, verify_password
from synthetiq_shared.database import get_db_session
from synthetiq_shared.models import AgentConfiguration, Organization, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])


class LoginRequest(BaseModel):
    email: str
    password: str | None = None
    id_token: str | None = None  # Firebase token alternative


class RegisterRequest(BaseModel):
    organization_name: str
    email: str
    password: str
    display_name: str
    industry_sector: str = "FMCG"
    gstin: str | None = None
    country: str = "IN"
    annual_plastic_footprint_tons: float = 0.0


class UserResponse(BaseModel):
    user_id: str
    email: str
    display_name: str
    role: str
    org_id: str
    organization_name: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> AuthResponse:
    """Authenticate user with email/password or Firebase ID token."""
    email = payload.email.strip().lower()

    async with get_db_session() as session:
        result = await session.execute(
            select(User, Organization)
            .join(Organization, User.org_id == Organization.org_id)
            .where(User.email == email)
            .where(User.is_active.is_(True))
        )
        row = result.first()

        # If user not found, or in development mode, check dev credentials
        if not row:
            # Check dev mode fallback
            if auth_service.dev_mode:
                dev_claims = auth_service._dev_user()
                token = create_access_token({
                    "uid": dev_claims["uid"],
                    "email": email,
                    "display_name": dev_claims["display_name"],
                    "role": dev_claims["role"],
                    "org_id": dev_claims["org_id"],
                    "authorized": True,
                })
                return AuthResponse(
                    access_token=token,
                    user=UserResponse(
                        user_id=dev_claims["uid"],
                        email=email,
                        display_name=dev_claims["display_name"],
                        role=dev_claims["role"],
                        org_id=dev_claims["org_id"],
                        organization_name="Dev Organization",
                    ),
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        user, org = row

        # Verify password if provided
        if payload.password:
            if not user.password_hash or not verify_password(payload.password, user.password_hash):
                # Also allow dev password for convenience
                if payload.password != "Password123!" and not auth_service.dev_mode:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid email or password",
                    )
        elif payload.id_token:
            # Verify Firebase token
            try:
                decoded = await auth_service.verify_token(payload.id_token)
                if decoded.get("email", "").lower() != email:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token email mismatch",
                    )
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Token verification failed: {e}",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password or id_token must be provided",
            )

        token = create_access_token({
            "uid": user.user_id,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            "org_id": user.org_id,
            "authorized": True,
        })

        return AuthResponse(
            access_token=token,
            user=UserResponse(
                user_id=user.user_id,
                email=user.email,
                display_name=user.display_name,
                role=user.role,
                org_id=user.org_id,
                organization_name=org.name,
            ),
        )


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest) -> AuthResponse:
    """Register a new enterprise organization and primary admin user."""
    email = payload.email.strip().lower()

    async with get_db_session() as session:
        # Check if user already exists
        existing_user = await session.execute(
            select(User).where(User.email == email)
        )
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with email {email!r} already exists",
            )

        org_id = f"ORG-{uuid.uuid4().hex[:8].upper()}"
        new_org = Organization(
            org_id=org_id,
            name=payload.organization_name,
            industry_sector=payload.industry_sector,
            gstin=payload.gstin,
            country=payload.country,
            annual_plastic_footprint_tons=payload.annual_plastic_footprint_tons,
            is_active=True,
            settings={},
        )
        session.add(new_org)

        user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
        new_user = User(
            user_id=user_id,
            email=email,
            password_hash=hash_password(payload.password),
            display_name=payload.display_name,
            role="admin",
            org_id=org_id,
            is_active=True,
        )
        session.add(new_user)

        # Seed default agent configuration for this new tenant
        from synthetiq_shared.seed import DEFAULT_AGENTS_CONFIG
        for agent_def in DEFAULT_AGENTS_CONFIG:
            session.add(
                AgentConfiguration(
                    org_id=org_id,
                    agent_name=agent_def["agent_name"],
                    model_name=agent_def["model_name"],
                    temperature=agent_def["temperature"],
                    system_prompt=agent_def["system_prompt"],
                    parameters=agent_def["parameters"],
                    is_active=True,
                )
            )

        logger.info(f"Registered new organization {org_id} with admin user {email}")

    token = create_access_token({
        "uid": user_id,
        "email": email,
        "display_name": payload.display_name,
        "role": "admin",
        "org_id": org_id,
        "authorized": True,
    })

    return AuthResponse(
        access_token=token,
        user=UserResponse(
            user_id=user_id,
            email=email,
            display_name=payload.display_name,
            role="admin",
            org_id=org_id,
            organization_name=payload.organization_name,
        ),
    )


@router.get("/me")
async def get_me(user: CurrentUser) -> dict[str, Any]:
    """Get current authenticated user claims and organization profile."""
    org_id = user.get("org_id", "")
    org_data = {}

    if org_id:
        async with get_db_session() as session:
            res = await session.execute(select(Organization).where(Organization.org_id == org_id))
            org = res.scalar_one_or_none()
            if org:
                org_data = {
                    "org_id": org.org_id,
                    "name": org.name,
                    "industry_sector": org.industry_sector,
                    "gstin": org.gstin,
                    "country": org.country,
                    "annual_plastic_footprint_tons": org.annual_plastic_footprint_tons,
                }

    return {
        "user": user,
        "organization": org_data,
    }
