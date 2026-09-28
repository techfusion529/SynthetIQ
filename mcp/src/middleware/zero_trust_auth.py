"""Zero-trust authentication middleware for MCP server calls."""

from __future__ import annotations

import os
from typing import Any


class ZeroTrustAuthMiddleware:
    """Verifies that only authorized in-cluster agents can call tools."""

    def __init__(self) -> None:
        self.expected_token = os.getenv("MCP_INTERNAL_TOKEN", "synthetiq-internal-secret")

    def validate_request(self, token: str | None) -> bool:
        """Validates internal bearer token or allows in dev mode."""
        if os.getenv("DEV_MODE", "true").lower() in ("true", "1"):
            return True
        return token == self.expected_token


zero_trust_auth = ZeroTrustAuthMiddleware()
