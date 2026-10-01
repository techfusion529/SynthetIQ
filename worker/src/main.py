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
from services.jev_auditor import initialize_jev_auditor
from services.nimble_service import initialize_nimble_service
from services.privacy_service import initialize_privacy_service

# Shared config — installed under the synthetiq_shared namespace
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
        logger.error("Configuration errors:")
        for error in validation["errors"]:
            logger.error(f"  - {error}")
        raise RuntimeError("Invalid configuration. Fix errors and restart.")

    if validation["warnings"]:
        logger.warning("Configuration warnings:")
        for warning in validation["warnings"]:
            logger.warning(f"  - {warning}")

    # Set GEMINI_API_KEY in env so google-adk's LlmAgent picks it up
    import os
    if config.gemini.is_configured:
        os.environ["GOOGLE_API_KEY"] = config.gemini.api_key
        os.environ["GEMINI_API_KEY"] = config.gemini.api_key
        os.environ["GEMINI_MODEL"] = config.gemini.model
        logger.info(f"✓ Google ADK configured: model={config.gemini.model}")
    else:
        logger.error("GEMINI_API_KEY not configured. Cannot start worker.")
        raise RuntimeError("Gemini API key required")

    # Initialize ADK session service
    from agents.base_adk import get_session_service
    get_session_service()
    logger.info("✓ ADK InMemorySessionService initialized")

    # Initialize Nimble System 1 service (Ollama /v1/systemone)
    nimble_host = config.ollama.host  # reuse OLLAMA_HOST
    logger.info(f"Initializing Nimble System 1 service at {nimble_host}...")
    initialize_nimble_service(
        ollama_host=nimble_host,
        model="nimble",
        timeout=10.0,
    )
    logger.info("✓ Nimble service initialized (availability checked on first call)")

    # Initialize Jev auditor (NIMBLE_PRIMARY → falls back to HYBRID_ENSEMBLE)
    logger.info(f"Initializing Jev auditor in {config.jev.mode} mode...")
    initialize_jev_auditor(
        mode=config.jev.mode,
        model_path=config.jev.model_path if config.jev.model_exists else None,
        torque_threshold_nm=config.jev.torque_threshold_nm,
        power_factor_min=config.jev.power_factor_min,
        power_factor_max=config.jev.power_factor_max,
        confidence_threshold=config.jev.confidence_threshold,
    )
    logger.info("✓ Jev auditor initialized")

    # Initialize privacy service (Ollama + Gemma)
    if config.ollama.enable_pii_scrubbing:
        logger.info("Initializing privacy service (Ollama + Gemma 2B)...")
        initialize_privacy_service(
            ollama_host=config.ollama.host,
            model=config.ollama.model,
            enabled=True,
        )
        logger.info("✓ Privacy service initialized")
    else:
        initialize_privacy_service(enabled=False)
        logger.info("Privacy service disabled (PII scrubbing off)")

    logger.info("All services initialized successfully!")


async def main() -> None:
    """Start Temporal worker with all workflows and activities."""
    config = get_config()

    # Initialize AI services
    await initialize_services()

    # Connect to Temporal server
    logger.info(f"Connecting to Temporal at {config.temporal.host}...")
    client = await Client.connect(config.temporal.host)
    logger.info("✓ Connected to Temporal")

    # List all activity functions
    activities = [
        agent_activities.calculate_brand_liability_activity,
        agent_activities.parse_regulatory_rules_activity,
        agent_activities.execute_double_auction_activity,
        agent_activities.verify_eway_bill_activity,
        agent_activities.audit_scada_telemetry_activity,
        agent_activities.create_escrow_split_po_activity,
        agent_activities.generate_and_dispatch_form1_activity,
    ]

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
