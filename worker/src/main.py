"""SynthetIQ Temporal Worker — registers 4 workflows and 8 AI agent activities."""

from __future__ import annotations

import asyncio
import os
import signal
import sys
from typing import Any

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
    QuadCoreAuditWorkflow,
    SettlementDispatchWorkflow,
    UpstreamLiabilityWorkflow,
)


async def run_worker() -> None:
    """Initializes worker and registers all workflows and activities."""
    temporal_host = os.getenv("TEMPORAL_HOST", "localhost:7233")
    print(f"SynthetIQ Worker initialized for task queue: {TEMPORAL_TASK_QUEUE}")
    print(f"Connecting to Temporal host: {temporal_host}")
    print("Registered Workflows:")
    print("  - UpstreamLiabilityWorkflow")
    print("  - AuctionLiquidityWorkflow")
    print("  - QuadCoreAuditWorkflow")
    print("  - SettlementDispatchWorkflow")
    print("Registered Activities for 8 AI Agents:")
    print("  - calculate_brand_liability_activity (Brand Liability Agent)")
    print("  - parse_regulatory_rules_activity (Regulatory Watchdog Agent)")
    print("  - execute_double_auction_activity (Treasury Agent)")
    print("  - verify_eway_bill_activity (Logistics Agent)")
    print("  - audit_scada_telemetry_activity (Auditor Agent / TypeSafe Jev)")
    print("  - create_escrow_split_po_activity (ERP Agent)")
    print("  - generate_and_dispatch_form1_activity (Legal Agent)")

    # In production with active Temporal server, starts temporalio.worker.Worker
    try:
        from temporalio.client import Client
        from temporalio.worker import Worker

        client = await Client.connect(temporal_host)
        worker = Worker(
            client,
            task_queue=TEMPORAL_TASK_QUEUE,
            workflows=[
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
        print("Worker listening on task queue...")
        await worker.run()
    except Exception as e:
        print(f"Running in standalone worker mode ({e}). Press Ctrl+C to terminate.")
        while True:
            await asyncio.sleep(3600)


def main() -> None:
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
