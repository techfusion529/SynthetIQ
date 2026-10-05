"""JWT and Password Hashing Utilities for SynthetIQ Auth."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

# Secret key from environment or fallback for development
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "synthetiq-super-secret-jwt-signing-key-2026")
SALT = os.getenv("PASSWORD_SALT", "synthetiq_enterprise_salt_v1")


def hash_password(password: str) -> str:
    """Generate SHA-256 salted hash of password."""
    salted = f"{SALT}:{password}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed value."""
    if not hashed_password:
        return False
    return hmac.compare_digest(hash_password(plain_password), hashed_password)


def _b64url_encode(data: bytes) -> str:
    """Encode bytes to base64url without padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    """Decode base64url string with added padding."""
    rem = len(data) % 4
    if rem > 0:
        data += "=" * (4 - rem)
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_access_token(
    payload: dict[str, Any],
    expires_in_seconds: int = 7 * 86400,
) -> str:
    """Create a signed HS256 JWT."""
    header = {"alg": "HS256", "typ": "JWT"}
    exp = int(time.time()) + expires_in_seconds
    body = {**payload, "exp": exp, "iat": int(time.time())}

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    body_b64 = _b64url_encode(json.dumps(body, separators=(",", ":")).encode("utf-8"))

    signing_input = f"{header_b64}.{body_b64}".encode("utf-8")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(signature)

    return f"{header_b64}.{body_b64}.{sig_b64}"


def decode_access_token(token: str) -> dict[str, Any]:
    """Verify and decode HS256 JWT.

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

    # Check expiration
    exp = payload.get("exp")
    if exp and exp < time.time():
        raise ValueError("JWT token has expired")

    return payload
