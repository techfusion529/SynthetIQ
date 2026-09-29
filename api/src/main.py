"""SynthetIQ API Gateway — FastAPI entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown lifecycle manager."""
    # Startup: Initialize logging, verify connections
    yield
    # Shutdown: Clean up connections


app = FastAPI(
    title=PROJECT_NAME,
    description="Zero-Trust Multi-Agent Autonomous EPR Compliance & Anti-Fraud Engine",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration for Firebase Executive Dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root health check router
app.include_router(health_router)

# API v1 feature routers
app.include_router(health_router, prefix=API_V1_STR)
app.include_router(config_router, prefix=API_V1_STR)
app.include_router(orchestrator_router, prefix=API_V1_STR)
app.include_router(companies_router, prefix=API_V1_STR)
app.include_router(liability_router, prefix=API_V1_STR)
app.include_router(auctions_router, prefix=API_V1_STR)
app.include_router(audit_router, prefix=API_V1_STR)
app.include_router(settlement_router, prefix=API_V1_STR)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
