"""EPR Compliance Pipeline Orchestrator  -  Google ADK SequentialAgent / ParallelAgent.

Architecture (per implementation_plan.md):

  epr_compliance_pipeline (SequentialAgent)
   -  -  -  -  -  -  upstream_parallel (ParallelAgent)
   -  -     -  -  -  -  -  -  brand_liability_agent
   -  -     - " -  -  -  -  regulatory_watchdog_agent
   -  -  -  -  -  -  treasury_agent
   -  -  -  -  -  -  audit_parallel (ParallelAgent)
   -  -     -  -  -  -  -  -  logistics_agent
   -  -     - " -  -  -  -  auditor_agent
   -  -  -  -  -  -  erp_agent
   - " -  -  -  -  legal_agent
"""

from __future__ import annotations

import logging
from typing import Any

from .base_adk import (
    create_parallel_group,
    create_sequential_pipeline,
    run_agent,
)
from .brand_liability_agent import brand_liability_agent
from .regulatory_agent import regulatory_agent
from .treasury_agent import treasury_agent
from .logistics_agent import logistics_agent
from .auditor_agent import auditor_agent
from .erp_agent import erp_agent
from .legal_agent import legal_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Compose the pipeline
# ---------------------------------------------------------------------------

# Stage 1: Brand liability + Regulatory rules in parallel
upstream_parallel = create_parallel_group(
    name="upstream_parallel",
    agents=[brand_liability_agent, regulatory_agent],
    description="Parallel computation of EPR liability and regulatory conversion factors",
)

# Stage 3: Logistics verification + SCADA audit in parallel
audit_parallel = create_parallel_group(
    name="audit_parallel",
    agents=[logistics_agent, auditor_agent],
    description="Parallel logistics origin verification and SCADA telemetry fraud detection",
)

# Full pipeline  -  sequential stages
epr_compliance_pipeline = create_sequential_pipeline(
    name="epr_compliance_pipeline",
    agents=[
        upstream_parallel,   # Stage 1: Liability + Regulatory (parallel)
        treasury_agent,      # Stage 2: Auction
        audit_parallel,      # Stage 3: Logistics + SCADA Audit (parallel)
        erp_agent,           # Stage 4: Escrow PO
        legal_agent,         # Stage 5: Form-1 dispatch
    ],
    description="End-to-end EPR compliance pipeline: liability  - ' auction  - ' audit  - ' PO  - ' Form-1",
)


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_epr_pipeline(
    company_id: str,
    fiscal_year: str,
    category: str,
    volume_tons: float,
    recycler_id: str = "RECYC-DELHI-01",
    plant_id: str = "PLANT-OKHLA-2",
    statutory_base_rate: float = 12.0,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Execute the full EPR compliance pipeline via ADK SequentialAgent.

    Each stage's output is stored in ADK session state and passed as context
    to subsequent stages. The Temporal activity layer calls this function.

    Args:
        company_id: Buying company identifier
        fiscal_year: Target fiscal year
        category: Plastic category
        volume_tons: Target volume in tonnes
        recycler_id: Recycler to audit
        plant_id: Plant to audit
        statutory_base_rate: CPCB penalty rate per kg
        session_id: Optional ADK session ID for state continuity

    Returns:
        Aggregated pipeline result dict with keys for each stage
    """
    logger.info(
        f"🚀 Starting EPR pipeline  -  company={company_id}, FY={fiscal_year}, "
        f"category={category}, volume={volume_tons}t"
    )

    result = await run_agent(
        agent=epr_compliance_pipeline,
        user_message=(
            f"Execute the full EPR compliance pipeline:\n"
            f"  company_id: {company_id}\n"
            f"  fiscal_year: {fiscal_year}\n"
            f"  category: {category}\n"
            f"  volume_tons: {volume_tons}\n"
            f"  recycler_id: {recycler_id}\n"
            f"  plant_id: {plant_id}\n"
            f"  statutory_base_rate_inr: {statutory_base_rate}\n\n"
            "Run all pipeline stages. Each stage must complete before the next starts."
        ),
        session_id=session_id or f"epr-{company_id}-{fiscal_year}",
        user_id=company_id,
    )

    return {
        "pipeline": "epr_compliance_pipeline",
        "company_id": company_id,
        "fiscal_year": fiscal_year,
        "category": category,
        "volume_tons": volume_tons,
        "session_id": result.get("session_id"),
        "tool_calls_count": len(result.get("tool_calls", [])),
        "response_summary": result.get("response", "")[:500],
    }
