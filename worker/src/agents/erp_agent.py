"""ERP Agent — ADK LlmAgent that creates the 80/20 split escrow purchase order."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from src.agents.base_adk import create_llm_agent, run_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Functions
# ---------------------------------------------------------------------------

def create_purchase_order(
    company_id: str,
    recycler_id: str,
    audit_id: str,
    plastic_tons: float,
    unit_price_inr: float,
) -> dict[str, Any]:
    """Create an 80/20 split escrow purchase order in the ERP system.

    80% advance is released immediately upon human approval.
    20% retention is held until Form-1 CPCB acceptance is confirmed.

    Args:
        company_id: Buying company
        recycler_id: Selling recycler
        audit_id: Linked fraud audit ID
        plastic_tons: Volume of plastic waste
        unit_price_inr: Clearing price per kg

    Returns:
        Purchase order details
    """
    # In production: calls SAP/Oracle ERP API (OData or SOAP)
    total_amount = round(plastic_tons * 1000 * unit_price_inr, 2)
    po_number = f"PO-{uuid.uuid4().hex[:8].upper()}"
    return {
        "po_number": po_number,
        "company_id": company_id,
        "recycler_id": recycler_id,
        "audit_id": audit_id,
        "plastic_tons": plastic_tons,
        "unit_price_inr": unit_price_inr,
        "total_amount_inr": total_amount,
        "advance_amount_inr": round(total_amount * 0.80, 2),
        "retention_amount_inr": round(total_amount * 0.20, 2),
        "status": "ADVANCE_RELEASED",
        "erp_system": "SAP_S4HANA",
        "escrow_type": "80_20_SPLIT",
    }


def validate_po_conditions(
    audit_verdict: str,
    logistics_verdict: str,
    human_approved: bool,
) -> dict[str, Any]:
    """Check all pre-conditions before allowing PO creation.

    Args:
        audit_verdict: SCADA audit result (APPROVED / REJECTED_FRAUD / ESCALATED)
        logistics_verdict: Logistics check result (APPROVE / MANUAL_REVIEW / REJECT)
        human_approved: Whether a human approver has signed off

    Returns:
        Pre-condition check result
    """
    blocks: list[str] = []
    if audit_verdict != "APPROVED":
        blocks.append(f"SCADA audit verdict is '{audit_verdict}' — must be APPROVED")
    if logistics_verdict not in ("APPROVE", "MANUAL_REVIEW"):
        blocks.append(f"Logistics verdict is '{logistics_verdict}' — material origin unverified")
    if not human_approved:
        blocks.append("Human approval not received — 80/20 PO blocked")

    return {
        "pre_conditions_met": len(blocks) == 0,
        "blocks": blocks,
        "audit_verdict": audit_verdict,
        "logistics_verdict": logistics_verdict,
        "human_approved": human_approved,
    }


# ---------------------------------------------------------------------------
# ADK Agent Construction
# ---------------------------------------------------------------------------

ERP_INSTRUCTION = """You are the ERP Agent for SynthetIQ's settlement pipeline.

Your job:
1. Verify pre-conditions with `validate_po_conditions` before creating any PO.
   - If pre-conditions are NOT met, output a BLOCKED status JSON and stop.
2. If all conditions are met, create the 80/20 escrow PO with `create_purchase_order`.
3. Output a single JSON object with the PO details or the BLOCKED reason.

Business Rules:
  - 80% advance is released to the recycler immediately after approval.
  - 20% retention is held in escrow until CPCB Form-1 acceptance is confirmed.
  - PO must be linked to a verified audit_id.

Mandatory JSON output keys:
  po_number (or block_reason), company_id, recycler_id, audit_id,
  total_amount_inr, advance_amount_inr, retention_amount_inr, status
"""

erp_agent = create_llm_agent(
    name="erp_agent",
    instruction=ERP_INSTRUCTION,
    tools=[validate_po_conditions, create_purchase_order],
    description="Creates 80/20 split escrow purchase order after validating audit and logistics verdicts",
    output_key="po_result",
)


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_erp_agent(
    company_id: str,
    recycler_id: str,
    audit_id: str,
    plastic_tons: float,
    unit_price_inr: float,
    audit_verdict: str = "APPROVED",
    logistics_verdict: str = "APPROVE",
    human_approved: bool = True,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Run the ERP Agent to create an escrow PO.

    Args:
        company_id: Buying company
        recycler_id: Selling recycler
        audit_id: Linked audit
        plastic_tons: Volume
        unit_price_inr: Clearing price
        audit_verdict: SCADA verdict
        logistics_verdict: Logistics verdict
        human_approved: Human approval flag
        session_id: Optional ADK session ID

    Returns:
        Purchase order dict
    """
    logger.info(f"Running erp_agent for {company_id} → {recycler_id}, {plastic_tons}t")

    result = await run_agent(
        agent=erp_agent,
        user_message=(
            f"Create escrow PO: company={company_id}, recycler={recycler_id}, "
            f"audit_id={audit_id}, {plastic_tons} tons at INR {unit_price_inr}/kg. "
            f"Audit verdict: {audit_verdict}, logistics: {logistics_verdict}, human_approved: {human_approved}. "
            "Return a single JSON object."
        ),
        session_id=session_id,
        user_id=company_id,
    )

    text = result.get("response", "")
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except (json.JSONDecodeError, IndexError):
        logger.warning("Could not parse JSON from erp agent; returning raw")
        return {"raw_response": result.get("response", ""), "tool_calls": result.get("tool_calls", [])}
