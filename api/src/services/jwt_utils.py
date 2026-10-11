"""JWT and Password Hashing Utilities for SynthetIQ Auth."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# ─── Secret key guard ────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is not set or is empty. "
        "Generate a random 256-bit value: "
        "python -c \"import secrets; print(secrets.token_hex(32))\""
    )

# ─── Argon2id password hasher ─────────────────────────────────────────────────
_ph = PasswordHasher()   # argon2id by default: memory=65536, time=3, parallelism=4


def hash_password(password: str) -> str:
    """Hash password with argon2id."""
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against an argon2id hash.

    Also accepts legacy SHA-256 hashes (prefixed with no $argon2 marker)
    so that existing accounts aren't immediately locked out on deploy.
    Legacy hashes will need to be re-hashed on next successful login.
    """
    if not hashed_password:
        return False
    # argon2 hashes start with "$argon2"
    if hashed_password.startswith("$argon2"):
        try:
            return _ph.verify(hashed_password, plain_password)
        except VerifyMismatchError:
            return False
        except Exception:
            return False
    # Legacy SHA-256 path — compare using constant-time compare
    salt = os.getenv("PASSWORD_SALT", "synthetiq_enterprise_salt_v1")
    salted = f"{salt}:{plain_password}"
    legacy_hash = hashlib.sha256(salted.encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy_hash, hashed_password)


# ─── Base64url helpers ────────────────────────────────────────────────────────

def _b64url_encode(data: bytes) -> str:
    """Encode bytes to base64url without padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    """Decode base64url string with added padding."""
    rem = len(data) % 4
    if rem > 0:
        data += "=" * (4 - rem)
    return base64.urlsafe_b64decode(data.encode("utf-8"))


# ─── Token creation / verification ───────────────────────────────────────────

def create_access_token(
    payload: dict[str, Any],
    expires_in_seconds: int = 60 * 60,   # 60 minutes
) -> str:
    """Create a signed HS256 JWT access token (60-minute lifetime by default)."""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    body = {**payload, "exp": now + expires_in_seconds, "iat": now}

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    body_b64 = _b64url_encode(json.dumps(body, separators=(",", ":")).encode("utf-8"))

    signing_input = f"{header_b64}.{body_b64}".encode("utf-8")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(signature)

    return f"{header_b64}.{body_b64}.{sig_b64}"


def decode_access_token(token: str) -> dict[str, Any]:
    """Verify and decode an HS256 JWT.

    Raises:
        ValueError: if invalid signature, expired, or malformed.
    """
    parts = token.strip().split(".")
    if len(parts) != 3:
        raise ValueError("Malformed JWT token")

    header_b64, body_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{body_b64}".encode("utf-8")
    expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    actual_sig = _b64url_decode(sig_b64)

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("Invalid JWT signature")

    payload = json.loads(_b64url_decode(body_b64).decode("utf-8"))

    exp = payload.get("exp")
    if exp and exp < time.time():
        raise ValueError("JWT token has expired")

    return payload


def create_refresh_token(payload: dict[str, Any]) -> str:
    """Create a signed HS256 refresh JWT (24-hour lifetime)."""
    refresh_payload = {**payload, "type": "refresh"}
    return create_access_token(refresh_payload, expires_in_seconds=24 * 60 * 60)


def verify_refresh_token(token: str) -> dict[str, Any]:
    """Verify a refresh token and return its claims.

    Raises:
        ValueError: if token is invalid, expired, or not a refresh token.
    """
    claims = decode_access_token(token)
    if claims.get("type") != "refresh":
        raise ValueError("Token is not a refresh token")
    return claims
