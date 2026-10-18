"""SynthetIQ API Gateway  -  FastAPI entry point (v0.2)."""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from src.constants import API_V1_STR, CORS_ORIGINS, PROJECT_NAME
from src.routes import (
    agent_config_router,
    auctions_router,
    audit_router,
    auth_router,
    config_router,
    datasources_router,
    health_router,
    liability_router,
    orchestrator_router,
    org_config_router,
    organizations_router,
    regulatory_router,
    runs_router,
    compliance_router,
    schedules_router,
    settlement_router,
    stream_router,
    users_router,
    users_me_router,
    hitl_router,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle  -  DB, Firebase, and Scheduler."""

    # ---- Startup -------------------------------------------------------
    logger.info("SynthetIQ API starting upâ€¦")

    # Force-import all ORM models so they register with Base.metadata
    try:
        import synthetiq_shared.models  # noqa: F401
        logger.info("[DB] All ORM models registered with Base.metadata")
    except Exception as exc:
        logger.error(f"[DB] Failed to import ORM models: {exc}")

    # 1. DB schema initialization (idempotent CREATE TABLE IF NOT EXISTS across all environments)
    try:
        from synthetiq_shared.database import init_db
        await init_db()
        logger.info("[DB] Database tables and schema verified")
    except Exception as exc:
        logger.exception(f"[DB] Database initialization failed: {exc}")

    # 2. CFG-01: idempotent platform bootstrap (seed admin, platform org, default pack)
    try:
        from synthetiq_shared.bootstrap import bootstrap_platform
        await bootstrap_platform()
        logger.info("[Bootstrap] Platform bootstrap completed")
    except Exception as exc:
        logger.exception(f"[Bootstrap] Platform bootstrap failed: {exc}")

    # 3. Idempotent default tenant and demo seed
    try:
        from synthetiq_shared.seed import seed_database
        await seed_database()
        logger.info("[Seed] Default tenant and demo seeds verified")
    except Exception as exc:
        logger.warning(f"[Seed] Tenant seed notice: {exc}")

    # 2. Firebase Auth (idempotent; dev-mode falls through silently)
    try:
        from src.services.auth_service import initialize_firebase
        initialize_firebase()
        logger.info("[Auth] Firebase Auth ready")
    except Exception as exc:
        logger.warning(f"Firebase init skipped ({type(exc).__name__}: {exc})")
    try:
        from src.services.scheduler_service import TemporalScheduleService
        from src.services.temporal_service import temporal_service
        temporal_client = await temporal_service.get_client()
        app.state.schedule_svc = TemporalScheduleService(temporal_client)
        logger.info("[Scheduler] TemporalScheduleService ready")
    except Exception as exc:
        logger.warning(f"TemporalScheduleService init skipped ({type(exc).__name__}: {exc})")
        app.state.schedule_svc = None

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

# ---- OpenTelemetry setup ------------------------------------------------
_otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT") or os.getenv("OTLP_ENDPOINT", "")
if _otlp_endpoint:
    try:
        from opentelemetry import metrics, trace
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader

        _resource = Resource.create({
            "service.name": "synthetiq-api",
            "service.version": "0.1.0",
            "deployment.environment": os.getenv("ENVIRONMENT", "dev"),
            "k8s.pod.name": os.getenv("HOSTNAME", "synthetiq-api-pod"),
        })

        # Setup TracerProvider
        _tracer_provider = TracerProvider(resource=_resource)
        if _otlp_endpoint.startswith("http://") or _otlp_endpoint.startswith("https://") or ":4318" in _otlp_endpoint:
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter as HTTPTraceExporter
            from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter as HTTPMetricExporter
            _trace_url = _otlp_endpoint if "/v1/traces" in _otlp_endpoint else f"{_otlp_endpoint.rstrip('/')}/v1/traces"
            _metric_url = _otlp_endpoint if "/v1/metrics" in _otlp_endpoint else f"{_otlp_endpoint.rstrip('/')}/v1/metrics"
            _span_exporter = HTTPTraceExporter(endpoint=_trace_url)
            _metric_exporter = HTTPMetricExporter(endpoint=_metric_url)
        else:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter as GRPCTraceExporter
            from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter as GRPCMetricExporter
            _span_exporter = GRPCTraceExporter(endpoint=_otlp_endpoint, insecure=True)
            _metric_exporter = GRPCMetricExporter(endpoint=_otlp_endpoint, insecure=True)

        _tracer_provider.add_span_processor(BatchSpanProcessor(_span_exporter))
        trace.set_tracer_provider(_tracer_provider)

        # Setup MeterProvider
        _metric_reader = PeriodicExportingMetricReader(_metric_exporter, export_interval_millis=15000)
        _meter_provider = MeterProvider(resource=_resource, metric_readers=[_metric_reader])
        metrics.set_meter_provider(_meter_provider)

        logger.info(f"[OTel] TracerProvider & MeterProvider initialized, exporting to {_otlp_endpoint}")
    except Exception as _otel_exc:
        logger.warning(f"[OTel] OpenTelemetry setup failed ({_otel_exc}); continuing without exporter")

try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    FastAPIInstrumentor.instrument_app(app)
    logger.info("[OTel] FastAPIInstrumentor wired")
except Exception as _inst_exc:
    logger.warning(f"[OTel] FastAPIInstrumentor unavailable ({_inst_exc})")

# ---- Prometheus metrics -------------------------------------------------
Instrumentator().instrument(app).expose(app)

# Register slowapi rate-limit error handler
from src.routes.auth import limiter  # noqa: E402
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    logger.error(f"[Unhandled Exception] {request.method} {request.url.path}: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc) or "Internal server error occurred",
            "error_type": type(exc).__name__,
            "path": request.url.path,
        },
    )

from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

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
app.include_router(users_me_router,       prefix=API_V1_STR)
app.include_router(hitl_router,           prefix=API_V1_STR)
app.include_router(agent_config_router,   prefix=API_V1_STR)
app.include_router(runs_router,           prefix=API_V1_STR)
app.include_router(compliance_router,     prefix=API_V1_STR)
app.include_router(regulatory_router,     prefix=API_V1_STR)
app.include_router(org_config_router,     prefix=API_V1_STR)
app.include_router(datasources_router,    prefix=API_V1_STR)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
