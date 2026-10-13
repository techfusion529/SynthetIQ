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
    create_llm_agent,
    create_parallel_group,
    create_sequential_pipeline,
    run_agent,
)
from .auditor_agent import AUDITOR_INSTRUCTION, fetch_scada_telemetry, evaluate_scada_signature
from .brand_liability_agent import BRAND_LIABILITY_INSTRUCTION, query_erp_sales, get_historic_debt, calculate_amortization
from .regulatory_agent import REGULATORY_INSTRUCTION, fetch_cpcb_gazette, extract_conversion_factors
from .treasury_agent import TREASURY_INSTRUCTION, compute_statutory_corridor, fetch_recycler_bids, validate_price_corridor
from .logistics_agent import LOGISTICS_INSTRUCTION, verify_eway_bill, scan_qr_packaging_ledger, assess_logistics_risk
from .erp_agent import ERP_INSTRUCTION, validate_po_conditions, create_purchase_order
from .legal_agent import LEGAL_INSTRUCTION, apply_conversion_factor, sign_form1_dsc, dispatch_to_cpcb_portal

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Compose the pipeline (module-level agents for the SequentialAgent pipeline)
# ---------------------------------------------------------------------------

def _build_pipeline():
    """Build the EPR compliance SequentialAgent pipeline with fresh agent instances."""
    _brand_liability = create_llm_agent(
        name="brand_liability_agent",
        instruction=BRAND_LIABILITY_INSTRUCTION,
        tools=[query_erp_sales, get_historic_debt, calculate_amortization],
        description="Calculates EPR plastic-waste liability from ERP sales + 1/3 amortization rule",
        output_key="liability_result",
    )
    _regulatory = create_llm_agent(
        name="regulatory_watchdog_agent",
        instruction=REGULATORY_INSTRUCTION,
        tools=[fetch_cpcb_gazette, extract_conversion_factors],
        description="Parses CPCB gazette notifications into structured EPR conversion factors and deadlines",
        output_key="regulatory_rules",
    )
    _treasury = create_llm_agent(
        name="treasury_agent",
        instruction=TREASURY_INSTRUCTION,
        tools=[compute_statutory_corridor, fetch_recycler_bids, validate_price_corridor],
        description="Runs the continuous double auction within the statutory price corridor",
        output_key="auction_result",
    )
    _logistics = create_llm_agent(
        name="logistics_agent",
        instruction=LOGISTICS_INSTRUCTION,
        tools=[verify_eway_bill, scan_qr_packaging_ledger, assess_logistics_risk],
        description="Verifies material origin and transportation via E-Way bills and QR packaging ledger",
        output_key="logistics_result",
    )
    _auditor = create_llm_agent(
        name="auditor_agent",
        instruction=AUDITOR_INSTRUCTION,
        tools=[fetch_scada_telemetry, evaluate_scada_signature],
        description="SCADA telemetry fraud detection via Nimble System 1 / Jev ensemble",
        output_key="audit_result",
    )
    _erp = create_llm_agent(
        name="erp_agent",
        instruction=ERP_INSTRUCTION,
        tools=[validate_po_conditions, create_purchase_order],
        description="Creates 80/20 split escrow purchase order after validating audit and logistics verdicts",
        output_key="po_result",
    )
    _legal = create_llm_agent(
        name="legal_agent",
        instruction=LEGAL_INSTRUCTION,
        tools=[apply_conversion_factor, sign_form1_dsc, dispatch_to_cpcb_portal],
        description="Generates, DSC-signs, and submits CPCB Form-1 for EPR credit registration",
        output_key="form1_result",
    )

    upstream_parallel = create_parallel_group(
        name="upstream_parallel",
        agents=[_brand_liability, _regulatory],
        description="Parallel computation of EPR liability and regulatory conversion factors",
    )
    audit_parallel = create_parallel_group(
        name="audit_parallel",
        agents=[_logistics, _auditor],
        description="Parallel logistics origin verification and SCADA telemetry fraud detection",
    )
    return create_sequential_pipeline(
        name="epr_compliance_pipeline",
        agents=[
            upstream_parallel,
            _treasury,
            audit_parallel,
            _erp,
            _legal,
        ],
        description="End-to-end EPR compliance pipeline: liability  - ' auction  - ' audit  - ' PO  - ' Form-1",
    )


epr_compliance_pipeline = _build_pipeline()


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_epr_pipeline(
    company_id: str,
    fiscal_year: str,
    category: str,
    volume_tons: float,
    recycler_id: str = "",
    plant_id: str = "",
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
        f"Starting EPR pipeline  -  company={company_id}, FY={fiscal_year}, "
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
