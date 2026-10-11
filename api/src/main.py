"""SynthetIQ API Gateway  -  FastAPI entry point (v0.2)."""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from src.constants import API_V1_STR, CORS_ORIGINS, PROJECT_NAME
from src.routes import (
    agent_config_router,
    auctions_router,
    audit_router,
    auth_router,
    config_router,
    health_router,
    liability_router,
    orchestrator_router,
    organizations_router,
    runs_router,
    schedules_router,
    settlement_router,
    stream_router,
    users_router,
    stream_router,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle  -  DB, Firebase, and Scheduler."""

    # ---- Startup -------------------------------------------------------
    logger.info("SynthetIQ API starting upâ€¦")

    # Force-import new ORM models so they register with Base.metadata
    try:
        from synthetiq_shared.models import AuctionRecord, BidRecord, AuditRecord, EscrowPORecord, Form1Record  # noqa: F401
    except Exception:
        pass
    # 1. DB schema is managed by Alembic migrations — no auto-create in production
    try:
        from synthetiq_shared.database import init_db  # type: ignore[import-not-found]
        # init_db() calls Base.metadata.create_all — only run in dev mode
        import os
        if os.getenv("ENV", "local").lower() == "local":
            await init_db()
            logger.info("[DB] Database tables ready (dev auto-create)")
        else:
            logger.info("[DB] Skipping auto-create; Alembic owns the schema in production")
    except Exception as exc:
        logger.warning(f"DB init skipped ({type(exc).__name__}: {exc})")

    # 2. Firebase Auth (idempotent; dev-mode falls through silently)
    try:
        from src.services.auth_service import initialize_firebase
        initialize_firebase()
        logger.info("[Auth] Firebase Auth ready")
    except Exception as exc:
        logger.warning(f"Firebase init skipped ({type(exc).__name__}: {exc})")

    yield

    # ---- Shutdown ------------------------------------------------------
    try:
        from synthetiq_shared.database import close_db  # type: ignore[import-not-found]
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
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Register slowapi rate-limit error handler
from src.routes.auth import limiter  # noqa: E402
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Root (unauthenticated) -----------------------------------------
app.include_router(health_router)
app.include_router(health_router, prefix="/api")

# ---- Versioned API --------------------------------------------------
app.include_router(auth_router,           prefix=API_V1_STR)
app.include_router(health_router,         prefix=API_V1_STR)
app.include_router(config_router,         prefix=API_V1_STR)
app.include_router(orchestrator_router,   prefix=API_V1_STR)
app.include_router(liability_router,      prefix=API_V1_STR)
app.include_router(auctions_router,       prefix=API_V1_STR)
app.include_router(audit_router,          prefix=API_V1_STR)
app.include_router(settlement_router,     prefix=API_V1_STR)
app.include_router(stream_router,         prefix=API_V1_STR)
app.include_router(schedules_router,      prefix=API_V1_STR)
app.include_router(organizations_router,  prefix=API_V1_STR)
app.include_router(users_router,          prefix=API_V1_STR)
app.include_router(agent_config_router,   prefix=API_V1_STR)
app.include_router(runs_router,           prefix=API_V1_STR)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
