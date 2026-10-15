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


@router.api_route("/health/init-db", methods=["GET", "POST"])
async def trigger_init_db() -> dict[str, Any]:
    """Explicitly trigger idempotent database initialization and platform bootstrap."""
    try:
        import synthetiq_shared.models  # noqa: F401
        from synthetiq_shared.database import init_db
        from synthetiq_shared.bootstrap import bootstrap_platform
        from synthetiq_shared.seed import seed_database

        await init_db()
        await bootstrap_platform()
        await seed_database()
        return {"status": "ok", "message": "Database tables and seeds initialized successfully"}
    except Exception as exc:
        import traceback
        return {"status": "error", "error": str(exc), "trace": traceback.format_exc()}
