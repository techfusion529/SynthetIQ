"""SynthetIQ API Gateway — FastAPI entry point."""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Allow shared package imports when running inside Docker
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "packages" / "synthetiq-shared" / "src"))

from src.constants import API_V1_STR, CORS_ORIGINS, PROJECT_NAME
from src.routes import (
    auctions_router,
    audit_router,
    companies_router,
    config_router,
    health_router,
    liability_router,
    orchestrator_router,
    settlement_router,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown lifecycle manager."""
    # --- Startup ---
    logger.info("SynthetIQ API starting up…")

    # Initialise SQLite / Postgres schema (dev: auto-create, prod: use Alembic)
    try:
        from database import init_db  # type: ignore[import-untyped]
        await init_db()
        logger.info("✓ Database tables ready")
    except Exception as exc:
        logger.warning(f"DB init skipped: {exc}")

    # Initialise Firebase Auth (idempotent — dev-mode falls through)
    try:
        from src.services.auth_service import initialize_firebase
        initialize_firebase()
        logger.info("✓ Firebase Auth ready")
    except Exception as exc:
        logger.warning(f"Firebase init skipped: {exc}")

    yield

    # --- Shutdown ---
    try:
        from database import close_db  # type: ignore[import-untyped]
        await close_db()
        logger.info("Database engine disposed")
    except Exception:
        pass
    logger.info("SynthetIQ API shut down cleanly")


app = FastAPI(
    title=PROJECT_NAME,
    description="Zero-Trust Multi-Agent Autonomous EPR Compliance & Anti-Fraud Engine",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS — allow the Firebase Executive Dashboard and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Root health (unauthenticated) ────────────────────────────────────────────
app.include_router(health_router)

# ── Versioned API ─────────────────────────────────────────────────────────────
app.include_router(health_router,      prefix=API_V1_STR)
app.include_router(config_router,      prefix=API_V1_STR)
app.include_router(orchestrator_router, prefix=API_V1_STR)
app.include_router(companies_router,   prefix=API_V1_STR)
app.include_router(liability_router,   prefix=API_V1_STR)
app.include_router(auctions_router,    prefix=API_V1_STR)
app.include_router(audit_router,       prefix=API_V1_STR)
app.include_router(settlement_router,  prefix=API_V1_STR)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
