"""Authentication & Session Router  -  Login, Registration, and User Context."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select

from src.middleware.auth import CurrentUser, get_optional_user
from src.services.auth_service import auth_service
from src.services.jwt_utils import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_refresh_token,
)
from synthetiq_shared.database import get_db_session
from synthetiq_shared.models import AgentConfiguration, Organization, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])

limiter = Limiter(key_func=get_remote_address)


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


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    user_id: str
    email: str
    display_name: str
    role: str
    org_id: str
    organization_name: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/15minutes")
async def login(request: Request, payload: LoginRequest) -> AuthResponse:
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

        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        user, org = row

        # Verify password if provided
        if payload.password:
            if not user.password_hash or not verify_password(payload.password, user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password",
                )
            # Transparently re-hash SHA-256 passwords to argon2id on successful login
            if user.password_hash and not user.password_hash.startswith("$argon2"):
                try:
                    user.password_hash = hash_password(payload.password)
                    logger.info(f"Re-hashed password for {email} from SHA-256 to argon2id")
                except Exception as exc:
                    logger.warning(f"Could not re-hash password for {email}: {exc}")
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

        token_payload = {
            "uid": user.user_id,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            "org_id": user.org_id,
            "authorized": True,
        }
        token = create_access_token(token_payload)
        refresh = create_refresh_token({
            "uid": user.user_id,
            "email": user.email,
            "role": user.role,
            "org_id": user.org_id,
        })

        return AuthResponse(
            access_token=token,
            refresh_token=refresh,
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
        from src.services.auth_service import create_user as _create_user
        new_user = await _create_user(
            session,
            user_id=user_id,
            email=email,
            display_name=payload.display_name,
            password_hash=hash_password(payload.password),
            role="admin",
            org_id=org_id,
        )
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
    refresh = create_refresh_token({
        "uid": user_id,
        "email": email,
        "role": "admin",
        "org_id": org_id,
    })

    return AuthResponse(
        access_token=token,
        refresh_token=refresh,
        user=UserResponse(
            user_id=user_id,
            email=email,
            display_name=payload.display_name,
            role="admin",
            org_id=org_id,
            organization_name=payload.organization_name,
        ),
    )


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token_endpoint(payload: RefreshRequest) -> AuthResponse:
    """Issue a new access token and refresh token given a valid refresh token."""
    try:
        claims = verify_refresh_token(payload.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    # Re-verify user is still active and role is current from the database
    async with get_db_session() as session:
        result = await session.execute(
            select(User, Organization)
            .join(Organization, User.org_id == Organization.org_id)
            .where(User.user_id == claims["uid"])
            .where(User.is_active.is_(True))
        )
        row = result.first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User no longer active",
            )
        user, org = row

    new_access = create_access_token({
        "uid": user.user_id,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "org_id": user.org_id,
        "authorized": True,
    })
    new_refresh = create_refresh_token({
        "uid": user.user_id,
        "email": user.email,
        "role": user.role,
        "org_id": user.org_id,
    })

    return AuthResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        user=UserResponse(
            user_id=user.user_id,
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            org_id=user.org_id,
            organization_name=org.name,
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


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------

class VerifyEmailRequest(BaseModel):
    token: str


@router.post("/verify-email")
async def verify_email(payload: VerifyEmailRequest) -> dict[str, Any]:
    """Validate an email verification token and activate the organisation."""
    from datetime import datetime, timezone
    from synthetiq_shared.models import InviteToken

    async with get_db_session() as session:
        result = await session.execute(
            select(InviteToken).where(InviteToken.token == payload.token)
        )
        token_row = result.scalar_one_or_none()

        if not token_row:
            raise HTTPException(status_code=404, detail="Token not found")
        if token_row.purpose != "email_verification":
            raise HTTPException(status_code=400, detail="Invalid token purpose")
        if token_row.used_at is not None:
            raise HTTPException(status_code=410, detail="Token has already been used")
        now = datetime.now(timezone.utc)
        # Handle both tz-aware and naive datetimes stored in DB
        expires = token_row.expires_at
        if expires.tzinfo is None:
            from datetime import timezone as tz
            expires = expires.replace(tzinfo=tz.utc)
        if now > expires:
            raise HTTPException(status_code=410, detail="Token has expired")

        # Activate the organisation
        if token_row.org_id:
            res = await session.execute(
                select(Organization).where(Organization.org_id == token_row.org_id)
            )
            org = res.scalar_one_or_none()
            if org:
                org.status = "active"

        # Mark token as used
        token_row.used_at = now

        return {"status": "verified", "org_id": token_row.org_id}


# ---------------------------------------------------------------------------
# Accept invite
# ---------------------------------------------------------------------------

class AcceptInviteRequest(BaseModel):
    token: str
    password: str
    display_name: str = ""


@router.post("/accept-invite", response_model=AuthResponse)
async def accept_invite(payload: AcceptInviteRequest) -> AuthResponse:
    """Accept an org invite token, create user + membership, return JWT."""
    import uuid as _uuid
    from datetime import datetime, timezone
    from synthetiq_shared.models import InviteToken
    from src.services.auth_service import create_user
    from src.services.jwt_utils import create_access_token, create_refresh_token, hash_password

    async with get_db_session() as session:
        result = await session.execute(
            select(InviteToken).where(InviteToken.token == payload.token)
        )
        token_row = result.scalar_one_or_none()

        if not token_row:
            raise HTTPException(status_code=404, detail="Token not found")
        if token_row.purpose != "invite":
            raise HTTPException(status_code=400, detail="Invalid token purpose")
        if token_row.used_at is not None:
            raise HTTPException(status_code=410, detail="Token has already been used")
        now = datetime.now(timezone.utc)
        expires = token_row.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if now > expires:
            raise HTTPException(status_code=410, detail="Token has expired")

        email = token_row.email
        org_id = token_row.org_id or ""
        role = token_row.role

        # Check email not already registered
        from synthetiq_shared.models import User as UserModel
        existing = await session.execute(select(UserModel).where(UserModel.email == email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"User with email {email!r} already exists")

        user_id = f"USR-{_uuid.uuid4().hex[:8].upper()}"
        display_name = payload.display_name or email

        new_user = await create_user(
            session,
            user_id=user_id,
            email=email,
            display_name=display_name,
            password_hash=hash_password(payload.password),
            role=role,
            org_id=org_id,
        )

        # Mark token used
        token_row.used_at = now

        # Get org name for response
        from synthetiq_shared.models import Organization as OrgModel
        org_res = await session.execute(select(OrgModel).where(OrgModel.org_id == org_id))
        org = org_res.scalar_one_or_none()
        org_name = org.name if org else ""

        logger.info(f"Invite accepted: {email} joined org {org_id} as {role}")

    access_token = create_access_token({
        "uid": user_id,
        "email": email,
        "display_name": display_name,
        "role": role,
        "org_id": org_id,
        "authorized": True,
    })
    refresh = create_refresh_token({
        "uid": user_id,
        "email": email,
        "role": role,
        "org_id": org_id,
    })

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh,
        user=UserResponse(
            user_id=user_id,
            email=email,
            display_name=display_name,
            role=role,
            org_id=org_id,
            organization_name=org_name,
        ),
    )
