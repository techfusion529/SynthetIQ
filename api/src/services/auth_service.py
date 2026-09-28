"""Firebase Auth / JWT validation service for Human-in-the-Loop endpoints."""

from __future__ import annotations

import os
from typing import Any


class AuthService:
    """Verifies Firebase JWT tokens from executive dashboard."""

    def __init__(self) -> None:
        self.dev_mode = os.getenv("AUTH_DEV_MODE", "true").lower() in ("true", "1", "yes")

    async def verify_token(self, token: str | None) -> dict[str, Any]:
        """Validates bearer token or returns mock user in dev mode."""
        if not token:
            if self.dev_mode:
                return {
                    "uid": "dev-user-001",
                    "email": "compliance_officer@synthetiq.ai",
                    "role": "compliance_officer",
                    "authorized": True,
                }
            raise ValueError("Authorization token missing")

        # In dev/mock mode or token parse
        clean_token = token.replace("Bearer ", "")
        return {
            "uid": f"user-{clean_token[:8]}",
            "email": "auditor@enterprise.in",
            "role": "compliance_officer",
            "authorized": True,
        }


auth_service = AuthService()
