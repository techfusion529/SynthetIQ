"""SynthetIQ Temporal Worker — registers 5 workflows and 7 AI agent activities."""

from __future__ import annotations

import asyncio
import os
from temporalio.client import Client
from temporalio.worker import Worker

from src.activities import (
    audit_scada_telemetry_activity,
    calculate_brand_liability_activity,
    create_escrow_split_po_activity,
    execute_double_auction_activity,
    generate_and_dispatch_form1_activity,
    parse_regulatory_rules_activity,
    verify_eway_bill_activity,
)
from src.constants import TEMPORAL_TASK_QUEUE
from src.flows import (
    AuctionLiquidityWorkflow,
    MasterEPRComplianceWorkflow,
    QuadCoreAuditWorkflow,
    SettlementDispatchWorkflow,
    UpstreamLiabilityWorkflow,
)


async def run_worker() -> None:
    """Initializes worker and registers all workflows and activities with retry loop."""
    temporal_host = os.getenv("TEMPORAL_HOST", "localhost:7233")
    print(f"[SynthetIQ Worker] Connecting to Temporal Server at: {temporal_host}")
    print(f"[SynthetIQ Worker] Listening on Task Queue: {TEMPORAL_TASK_QUEUE}")
    print("[SynthetIQ Worker] Registering Workflows:")
    print("  • MasterEPRComplianceWorkflow (End-to-End Orchestrator)")
    print("  • UpstreamLiabilityWorkflow")
    print("  • AuctionLiquidityWorkflow")
    print("  • QuadCoreAuditWorkflow")
    print("  • SettlementDispatchWorkflow")

    client = None
    for attempt in range(1, 30):
        try:
            client = await Client.connect(temporal_host)
            print(f"[SynthetIQ Worker] Successfully connected to Temporal Server on attempt {attempt}!")
            break
        except Exception as e:
            print(f"[SynthetIQ Worker] Waiting for Temporal Server at {temporal_host} (attempt {attempt}/30)... {e}")
            await asyncio.sleep(2)

    if not client:
        raise RuntimeError(f"Could not connect to Temporal Server at {temporal_host} after 30 attempts")

    worker = Worker(
        client,
        task_queue=TEMPORAL_TASK_QUEUE,
        workflows=[
            MasterEPRComplianceWorkflow,
            UpstreamLiabilityWorkflow,
            AuctionLiquidityWorkflow,
            QuadCoreAuditWorkflow,
            SettlementDispatchWorkflow,
        ],
        activities=[
            calculate_brand_liability_activity,
            parse_regulatory_rules_activity,
            execute_double_auction_activity,
            verify_eway_bill_activity,
            audit_scada_telemetry_activity,
            create_escrow_split_po_activity,
            generate_and_dispatch_form1_activity,
        ],
    )

    print("[SynthetIQ Worker] Multi-agent worker listening on queue. Ready for workflow dispatches!")
    await worker.run()


def main() -> None:
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
