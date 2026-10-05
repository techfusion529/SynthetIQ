"""Firebase Auth middleware — verifies JWT tokens from the executive dashboard.

In production mode, uses firebase_admin.auth.verify_id_token().
In dev mode (AUTH_DEV_MODE=true), returns a mock user for local development.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Firebase Admin SDK Initialization
# ---------------------------------------------------------------------------

_firebase_app: firebase_admin.App | None = None


def initialize_firebase() -> None:
    """Initialize Firebase Admin SDK (idempotent)."""
    global _firebase_app

    if _firebase_app is not None:
        return

    dev_mode = os.getenv("AUTH_DEV_MODE", "false").lower() in ("true", "1", "yes")
    if dev_mode:
        logger.warning("Firebase Auth running in DEV MODE — tokens are NOT verified")
        return

    # Try service account JSON, then Application Default Credentials
    cred_path = os.getenv("FIREBASE_ADMIN_SDK_PATH", "")
    project_id = os.getenv("FIREBASE_PROJECT_ID", "")

    try:
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info(f"Firebase initialized with service account: {cred_path}")
        elif project_id:
            _firebase_app = firebase_admin.initialize_app(
                options={"projectId": project_id}
            )
            logger.info(f"Firebase initialized with project ID: {project_id}")
        else:
            _firebase_app = firebase_admin.initialize_app()
            logger.info("Firebase initialized with Application Default Credentials")

    except Exception as e:
        logger.error(f"Firebase initialization failed: {e}")
        logger.warning("Falling back to dev mode authentication")


# ---------------------------------------------------------------------------
# Token Verification
# ---------------------------------------------------------------------------

class AuthService:
    """Verifies Firebase JWT tokens and extracts user claims."""

    def __init__(self) -> None:
        self.dev_mode = os.getenv("AUTH_DEV_MODE", "false").lower() in ("true", "1", "yes")
        if not self.dev_mode:
            initialize_firebase()

    async def verify_token(self, token: str | None) -> dict[str, Any]:
        """Validate a Bearer token and return user claims.

        Args:
            token: Authorization header value (e.g., "Bearer <jwt>")

        Returns:
            User claims dict with uid, email, role, org_id

        Raises:
            ValueError: If token is missing or invalid
        """
        if not token:
            if self.dev_mode:
                return self._dev_user()
            raise ValueError("Authorization token missing")

        # Strip Bearer prefix
        clean_token = token.replace("Bearer ", "").strip()

        if not clean_token:
            if self.dev_mode:
                return self._dev_user()
            raise ValueError("Empty authorization token")

        # 1. First check if it is our signed local HS256 JWT
        try:
            from src.services.jwt_utils import decode_access_token
            decoded = decode_access_token(clean_token)
            return {
                "uid": decoded.get("uid", ""),
                "email": decoded.get("email", ""),
                "display_name": decoded.get("display_name", ""),
                "role": decoded.get("role", "viewer"),
                "org_id": decoded.get("org_id", ""),
                "authorized": True,
            }
        except Exception:
            pass

        # 2. Dev mode: accept dev token or fallback
        if self.dev_mode:
            return self._dev_user(clean_token)

        # 3. Production: verify with Firebase Admin SDK
        try:
            decoded = firebase_auth.verify_id_token(clean_token)

            return {
                "uid": decoded["uid"],
                "email": decoded.get("email", ""),
                "display_name": decoded.get("name", ""),
                "role": decoded.get("role", "viewer"),
                "org_id": decoded.get("org_id", ""),
                "email_verified": decoded.get("email_verified", False),
                "authorized": True,
            }

        except firebase_auth.ExpiredIdTokenError:
            raise ValueError("Token has expired — please re-authenticate")
        except firebase_auth.RevokedIdTokenError:
            raise ValueError("Token has been revoked")
        except firebase_auth.InvalidIdTokenError as e:
            raise ValueError(f"Invalid token: {e}")
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            raise ValueError(f"Authentication failed: {e}")

    def _dev_user(self, token_hint: str = "") -> dict[str, Any]:
        """Return a mock user for development mode."""
        return {
            "uid": f"dev-{token_hint[:8]}" if token_hint else "dev-user-001",
            "email": "compliance_officer@synthetiq.ai",
            "display_name": "Dev User",
            "role": "admin",
            "org_id": "ORG-DEV-001",
            "email_verified": True,
            "authorized": True,
        }


# Global service instance
auth_service = AuthService()
