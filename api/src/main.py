"""SynthetIQ API Gateway — FastAPI entry point (v0.2)."""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.constants import API_V1_STR, CORS_ORIGINS, PROJECT_NAME
from src.routes import (
    agent_config_router,
    auctions_router,
    audit_router,
    auth_router,
    companies_router,
    config_router,
    health_router,
    liability_router,
    orchestrator_router,
    organizations_router,
    schedules_router,
    settlement_router,
    users_router,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle — DB, Firebase, and Scheduler."""

    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("SynthetIQ API starting up…")

    # 1. SQLite / Postgres schema (dev: auto-create, prod: use Alembic)
    try:
        from synthetiq_shared.database import init_db  # type: ignore[import-not-found]
        await init_db()
        logger.info("✓ Database tables ready")
    except Exception as exc:
        logger.warning(f"DB init skipped ({type(exc).__name__}: {exc})")

    # 2. Firebase Auth (idempotent; dev-mode falls through silently)
    try:
        from src.services.auth_service import initialize_firebase
        initialize_firebase()
        logger.info("✓ Firebase Auth ready")
    except Exception as exc:
        logger.warning(f"Firebase init skipped ({type(exc).__name__}: {exc})")

    # 3. APScheduler — start the per-org schedule engine
    try:
        from src.services.scheduler_service import get_scheduler_service
        scheduler = get_scheduler_service()
        scheduler.start()
        logger.info("✓ APScheduler started")
        # Seed a default daily compliance run for the dev organisation
        scheduler.add_schedule(
            org_id="ORG-DEV-001",
            workflow_type="master_e2e",
            cron_expression="0 2 * * *",
            name="Daily E2E compliance (dev org)",
            workflow_params={
                "company_id": "COMP-IN-001",
                "volume_tons": 250,
                "category": "cat_i_rigid",
            },
        )
    except Exception as exc:
        logger.warning(f"Scheduler start skipped ({type(exc).__name__}: {exc})")

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    try:
        from src.services.scheduler_service import get_scheduler_service
        get_scheduler_service().shutdown(wait=False)
    except Exception:
        pass

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
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Root (unauthenticated) ────────────────────────────────────────────────────
app.include_router(health_router)

# ── Versioned API ─────────────────────────────────────────────────────────────
app.include_router(auth_router,           prefix=API_V1_STR)
app.include_router(health_router,       prefix=API_V1_STR)
app.include_router(config_router,       prefix=API_V1_STR)
app.include_router(orchestrator_router, prefix=API_V1_STR)
app.include_router(companies_router,    prefix=API_V1_STR)
app.include_router(liability_router,    prefix=API_V1_STR)
app.include_router(auctions_router,     prefix=API_V1_STR)
app.include_router(audit_router,        prefix=API_V1_STR)
app.include_router(settlement_router,   prefix=API_V1_STR)
app.include_router(schedules_router,    prefix=API_V1_STR)
app.include_router(organizations_router, prefix=API_V1_STR)
app.include_router(users_router,         prefix=API_V1_STR)
app.include_router(agent_config_router,  prefix=API_V1_STR)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
