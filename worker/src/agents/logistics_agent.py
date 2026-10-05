"""Logistics Agent — ADK LlmAgent that verifies material origin via E-Way bills and QR codes."""

from __future__ import annotations

import json
import logging
from typing import Any

from .base_adk import create_llm_agent, run_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Functions
# ---------------------------------------------------------------------------

def verify_eway_bill(eway_bill_number: str) -> dict[str, Any]:
    """Verify a GST E-Way bill against the national GST ledger.

    Args:
        eway_bill_number: E-Way bill number (format: EWB-YYYY-NNNNN)

    Returns:
        Verification result dict
    """
    # In production: calls the official GST E-Way Bill API
    return {
        "eway_bill_number": eway_bill_number,
        "status": "VERIFIED",
        "origin_gstin": "27AAACH1234F1Z5",
        "destination_gstin": "07BBBCH5678G2Z4",
        "origin_state": "Maharashtra",
        "destination_state": "Delhi",
        "material_description": "Plastic Waste (Category I Rigid)",
        "gross_weight_kg": 252_450,
        "tare_weight_kg": 1_200,
        "net_weight_kg": 251_250,
        "vehicle_number": "MH-04-AB-1234",
        "generated_at": "2026-09-28T06:00:00Z",
        "validity_date": "2026-10-05",
        "origin_verified": True,
        "destination_verified": True,
        "tare_weight_match": True,
        "fraud_risk": "LOW",
    }


def scan_qr_packaging_ledger(qr_code_id: str) -> dict[str, Any]:
    """Scan the national QR-code packaging ledger to establish material origin chain.

    Args:
        qr_code_id: QR code identifier printed on the plastic packaging

    Returns:
        Provenance chain dict
    """
    # In production: queries the CPCB Extended Producer Responsibility Packaging Ledger
    return {
        "qr_code_id": qr_code_id,
        "brand_pibo": "COMP-IN-001",
        "product_category": "cat_i_rigid",
        "manufacture_date": "2024-03-15",
        "manufacture_state": "Maharashtra",
        "collection_point": "Delhi Municipal MRF",
        "collection_date": "2026-09-20",
        "chain_of_custody": ["Brand → Retailer → Consumer → MRF → Recycler"],
        "provenance_verified": True,
        "tamper_detected": False,
    }


def assess_logistics_risk(eway_result: dict[str, Any], qr_result: dict[str, Any]) -> dict[str, Any]:
    """Aggregate logistics verification signals into a risk score.

    Args:
        eway_result: Result from verify_eway_bill
        qr_result: Result from scan_qr_packaging_ledger

    Returns:
        Aggregated risk assessment
    """
    flags: list[str] = []
    risk_score = 0.0

    if not eway_result.get("origin_verified"):
        flags.append("E-WAY: Origin not verified")
        risk_score += 0.4

    if not eway_result.get("tare_weight_match"):
        flags.append("E-WAY: Tare weight discrepancy")
        risk_score += 0.3

    if qr_result.get("tamper_detected"):
        flags.append("QR: Tamper detected on packaging")
        risk_score += 0.5

    if not qr_result.get("provenance_verified"):
        flags.append("QR: Provenance chain incomplete")
        risk_score += 0.3

    risk_score = min(1.0, risk_score)
    verdict = "APPROVE" if risk_score < 0.3 else ("MANUAL_REVIEW" if risk_score < 0.6 else "REJECT")

    return {
        "overall_risk_score": round(risk_score, 2),
        "verdict": verdict,
        "flags": flags,
        "eway_status": eway_result.get("status"),
        "provenance_verified": qr_result.get("provenance_verified"),
    }


# ---------------------------------------------------------------------------
# ADK Agent Construction
# ---------------------------------------------------------------------------

LOGISTICS_INSTRUCTION = """You are the Logistics Agent for SynthetIQ's EPR fraud detection pipeline.

Your job:
1. Verify the GST E-Way bill using `verify_eway_bill`.
2. Scan the QR-code packaging ledger using `scan_qr_packaging_ledger`.
3. Aggregate the signals into an overall risk score using `assess_logistics_risk`.
4. Flag any inconsistencies and recommend APPROVE / MANUAL_REVIEW / REJECT.
5. Output a single JSON object with the logistics verification result.

Key fraud signals to detect:
  - Origin/destination mismatch vs reported plant location
  - Tare weight discrepancies (possible volume inflation)
  - Broken chain of custody (QR not registered in packaging ledger)
  - Tampered QR codes

Mandatory JSON output keys:
  eway_bill_number, overall_risk_score, verdict, flags,
  origin_verified, destination_verified, provenance_verified, recommendation
"""

logistics_agent = create_llm_agent(
    name="logistics_agent",
    instruction=LOGISTICS_INSTRUCTION,
    tools=[verify_eway_bill, scan_qr_packaging_ledger, assess_logistics_risk],
    description="Verifies material origin and transportation via E-Way bills and QR packaging ledger",
    output_key="logistics_result",
)


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_logistics_agent(
    eway_bill_number: str,
    qr_code_id: str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Run the Logistics Agent for a shipment.

    Args:
        eway_bill_number: GST E-Way bill number
        qr_code_id: Optional packaging QR code
        session_id: Optional ADK session ID

    Returns:
        Logistics verification result
    """
    logger.info(f"Running logistics_agent for E-Way bill: {eway_bill_number}")

    qr_part = f" and QR code '{qr_code_id}'" if qr_code_id else ""
    result = await run_agent(
        agent=logistics_agent,
        user_message=(
            f"Verify the logistics for E-Way bill '{eway_bill_number}'{qr_part}. "
            "Use all tools and return a single JSON object."
        ),
        session_id=session_id,
        user_id="system",
    )

    text = result.get("response", "")
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except (json.JSONDecodeError, IndexError):
        logger.warning("Could not parse JSON from logistics agent; returning raw")
        return {"raw_response": result.get("response", ""), "tool_calls": result.get("tool_calls", [])}
