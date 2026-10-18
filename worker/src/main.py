"""SynthetIQ Temporal Worker - Multi-agent orchestration entry point."""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

from temporalio.client import Client
from temporalio.worker import Worker

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from flows.workflows import (
    AuctionLiquidityWorkflow,
    MasterEPRComplianceWorkflow,
    QuadCoreAuditWorkflow,
    SettlementDispatchWorkflow,
    UpstreamLiabilityWorkflow,
)
from activities import agent_activities
from activities.config_activities import fetch_run_config_activity, update_workflow_run_activity
from services.jev_auditor import initialize_jev_auditor
from services.nimble_service import initialize_nimble_service
from services.privacy_service import initialize_privacy_service

# Shared config  -  installed under the synthetiq_shared namespace
try:
    from synthetiq_shared.config import get_config
except ModuleNotFoundError:
    # Local dev fallback (running outside Docker with src/ on sys.path)
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent / "packages" / "synthetiq-shared" / "src"))
    from config import get_config  # type: ignore[no-redef]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def initialize_services() -> None:
    """Initialize all AI services with configuration from environment."""
    config = get_config()

    # Validate configuration
    validation = config.validate()
    if validation["errors"]:
        logger.warning("Configuration errors/warnings detected:")
        for error in validation["errors"]:
            logger.warning(f"  - {error}")

    if validation["warnings"]:
        logger.warning("Configuration warnings:")
        for warning in validation["warnings"]:
            logger.warning(f"  - {warning}")

    import os
    use_vertex = (
        os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() == "true"
        or os.getenv("USE_VERTEX_AI", "").lower() == "true"
        or bool(config.gcp.project_id)
    )

    if use_vertex:
        effective_project = config.gcp.project_id or "synthetiq-dev"
        effective_loc = os.getenv("GOOGLE_CLOUD_LOCATION") or os.getenv("VERTEX_LOCATION") or config.gcp.region or "global"
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "true"
        os.environ["GOOGLE_CLOUD_PROJECT"] = effective_project
        os.environ["GCP_PROJECT_ID"] = effective_project
        os.environ["GOOGLE_CLOUD_LOCATION"] = effective_loc
        os.environ["GCP_REGION"] = effective_loc
        os.environ["GEMINI_MODEL"] = config.gemini.model or "gemini-3.8-flash"
        logger.info(f" - Google ADK & Vertex AI Model Garden configured: model={os.environ['GEMINI_MODEL']}, location={effective_loc}")
    elif config.gemini.is_configured:
        os.environ["GOOGLE_API_KEY"] = config.gemini.api_key
        os.environ["GEMINI_API_KEY"] = config.gemini.api_key
        os.environ["GEMINI_MODEL"] = config.gemini.model or "gemini-3.8-flash"
        logger.info(f" - Google ADK configured: model={config.gemini.model}")
    else:
        logger.warning("Neither Vertex AI nor GEMINI_API_KEY configured. Running worker in demo/mock agent mode.")
        os.environ.setdefault("GOOGLE_API_KEY", "mock-agent-key")
        os.environ.setdefault("GEMINI_API_KEY", "mock-agent-key")
        os.environ.setdefault("GEMINI_MODEL", "gemini-3.8-flash")

    # Set GCP project context for BigQuery / Pub/Sub
    if config.gcp.project_id:
        os.environ["GCP_PROJECT_ID"] = config.gcp.project_id
        os.environ["GCP_REGION"] = config.gcp.region or "global"
        os.environ["GOOGLE_CLOUD_PROJECT"] = config.gcp.project_id
        logger.info(
            f" - GCP Platform configured: project={config.gcp.project_id}, "
            f"region={config.gcp.region}"
        )
    else:
        logger.warning("GCP_PROJECT_ID not set - Vertex AI / BigQuery / Pub/Sub disabled")

    # Initialize Gemini AI service (dual-mode: Vertex AI + API key fallback)
    from services.ai_service import initialize_gemini_service
    initialize_gemini_service(
        api_key=config.gemini.api_key,
        model_name=config.gemini.model or "gemini-3.8-flash",
        temperature=config.gemini.temperature,
        max_tokens=config.gemini.max_tokens,
        gcp_project_id=config.gcp.project_id if config.gcp.project_id else None,
        gcp_region=os.environ.get("GOOGLE_CLOUD_LOCATION", config.gcp.region or "global"),
    )
    logger.info(" - Gemini AI service initialized (gemini-3.8-flash)")

    # Initialize ADK session service
    from agents.base_adk import get_session_service
    get_session_service()
    logger.info(" -  ADK InMemorySessionService initialized")

    # Initialize Nimble System 1 service (Ollama /v1/systemone)
    nimble_host = config.ollama.host  # reuse OLLAMA_HOST
    logger.info(f"Initializing Nimble System 1 service at {nimble_host}...")
    initialize_nimble_service(
        ollama_host=nimble_host,
        model="nimble",
        timeout=10.0,
    )
    logger.info(" -  Nimble service initialized (availability checked on first call)")

    # Initialize Jev auditor (NIMBLE_PRIMARY  - ' falls back to HYBRID_ENSEMBLE)
    logger.info(f"Initializing Jev auditor in {config.jev.mode} mode...")
    initialize_jev_auditor(
        mode=config.jev.mode,
        model_path=config.jev.model_path if config.jev.model_exists else None,
        torque_threshold_nm=config.jev.torque_threshold_nm,
        power_factor_min=config.jev.power_factor_min,
        power_factor_max=config.jev.power_factor_max,
        confidence_threshold=config.jev.confidence_threshold,
    )
    logger.info(" -  Jev auditor initialized")

    # Initialize privacy service (Ollama + Gemma)
    if config.ollama.enable_pii_scrubbing:
        logger.info("Initializing privacy service (Ollama + Gemma 2B)...")
        initialize_privacy_service(
            ollama_host=config.ollama.host,
            model=config.ollama.model,
            enabled=True,
        )
        logger.info(" -  Privacy service initialized")
    else:
        initialize_privacy_service(enabled=False)
        logger.info("Privacy service disabled (PII scrubbing off)")

    # Initialize OpenTelemetry and Observability Service
    try:
        from services.observability import initialize_observability
        otlp_target = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT") or os.getenv("OTLP_ENDPOINT") or config.observability.otel_endpoint
        initialize_observability(
            service_name="synthetiq-worker",
            otlp_endpoint=otlp_target,
            enable_telemetry=config.observability.enable_telemetry,
        )
        logger.info(f" - OpenTelemetry & Observability service initialized (endpoint: {otlp_target})")
    except Exception as otel_exc:
        logger.warning(f"Observability initialization failed ({otel_exc}); continuing")

    logger.info("All services initialized successfully!")


async def _start_health_server(port: int = 9090):
    """Run a lightweight HTTP health check and Prometheus metrics responder on port 9090."""
    async def _handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            req = await reader.read(1024)
            req_str = req.decode("utf-8", errors="ignore")
            if "GET /metrics" in req_str:
                from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
                metrics_data = generate_latest()
                hdr = (
                    f"HTTP/1.1 200 OK\r\n"
                    f"Content-Type: {CONTENT_TYPE_LATEST}\r\n"
                    f"Content-Length: {len(metrics_data)}\r\n\r\n"
                ).encode("utf-8")
                writer.write(hdr + metrics_data)
            else:
                resp = b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\n\r\nOK"
                writer.write(resp)
            await writer.drain()
        except Exception:
            pass
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass

    server = await asyncio.start_server(_handle_client, "0.0.0.0", port)
    logger.info(f" -  Health check & metrics server listening on port {port}")
    return server


async def main() -> None:
    """Start Temporal worker with all workflows and activities."""
    config = get_config()

    # Start health check server
    health_server = await _start_health_server(9090)

    # Initialize AI services
    await initialize_services()

    # Connect to Temporal server with retry
    temporal_target = os.getenv("TEMPORAL_HOST", os.getenv("TEMPORAL_ADDRESS", config.temporal.host))
    logger.info(f"Connecting to Temporal at {temporal_target}...")
    client = None
    for attempt in range(1, 31):
        try:
            client = await Client.connect(temporal_target)
            logger.info(" -  Connected to Temporal")
            break
        except Exception as e:
            logger.warning(f"Temporal not ready yet (attempt {attempt}/30): {e}. Retrying in 3s...")
            await asyncio.sleep(3)
    if client is None:
        raise RuntimeError(f"Could not connect to Temporal at {temporal_target} after 30 attempts")

    # List all activity functions
    activities = [
        agent_activities.calculate_brand_liability_activity,
        agent_activities.parse_regulatory_rules_activity,
        agent_activities.execute_double_auction_activity,
        agent_activities.verify_eway_bill_activity,
        agent_activities.audit_scada_telemetry_activity,
        agent_activities.create_escrow_split_po_activity,
        agent_activities.generate_and_dispatch_form1_activity,
        agent_activities.generate_audit_report_pdf_activity,
        fetch_run_config_activity,
        update_workflow_run_activity,
    ]

    # Configure sandbox runner with passthrough modules for pydantic and shared modules
    from temporalio.worker.workflow_sandbox import SandboxedWorkflowRunner, SandboxRestrictions
    workflow_runner = SandboxedWorkflowRunner(
        restrictions=SandboxRestrictions.default.with_passthrough_modules(
            "platform",
            "pydantic",
            "pydantic_core",
            "synthetiq_shared",
        )
    )

    # Start worker
    logger.info("Starting Temporal worker...")
    worker = Worker(
        client,
        task_queue="synthetiq-main",
        workflows=[
            UpstreamLiabilityWorkflow,
            AuctionLiquidityWorkflow,
            QuadCoreAuditWorkflow,
            SettlementDispatchWorkflow,
            MasterEPRComplianceWorkflow,
        ],
        activities=activities,
        workflow_runner=workflow_runner,
    )

    logger.info("=" * 60)
    logger.info("🚀 SynthetIQ Temporal Worker Started Successfully!")
    logger.info("=" * 60)
    logger.info(f"Task Queue: synthetiq-main")
    logger.info(f"Workflows: 5 registered")
    logger.info(f"Activities: {len(activities)} registered")
    logger.info(f"AI Model: {config.gemini.model}")
    logger.info(f"Jev Mode: {config.jev.mode} (Nimble primary, Jev fallback)")
    logger.info(f"Privacy:  {'Enabled' if config.ollama.enable_pii_scrubbing else 'Disabled'}")
    logger.info("=" * 60)

    try:
        await worker.run()
    except KeyboardInterrupt:
        logger.info("\nShutting down worker...")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
