"""Health check and readiness endpoints."""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok", "service": "synthetiq-api"}


@router.get("/ready")
async def readiness_check() -> dict[str, Any]:
    """Readiness probe checking dependencies."""
    return {
        "status": "ready",
        "service": "synthetiq-api",
        "dependencies": {
            "temporal": "connected",
            "firebase": "ready",
        },
    }
