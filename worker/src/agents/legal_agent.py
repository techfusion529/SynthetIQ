"""Legal Agent — ADK LlmAgent that generates and dispatches CPCB Form-1."""

from __future__ import annotations

import json
import logging
import uuid
import hashlib
from typing import Any

from src.agents.base_adk import create_llm_agent, run_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Functions
# ---------------------------------------------------------------------------

def apply_conversion_factor(
    physical_melt_tons: float,
    category: str,
    recycling_method: str = "mechanical",
) -> dict[str, Any]:
    """Apply the statutory Cf conversion factor to compute net EPR credits.

    Args:
        physical_melt_tons: Verified physical melt volume
        category: Plastic category
        recycling_method: mechanical or co_processing

    Returns:
        Dict with net_credit_tons
    """
    _CF: dict[str, dict[str, float]] = {
        "cat_i_rigid":       {"mechanical": 1.0, "co_processing": 0.7},
        "cat_ii_flexible":   {"mechanical": 0.8, "co_processing": 0.6},
        "cat_iii_mlp":       {"mechanical": 0.5, "co_processing": 0.9},
        "cat_iv_compostable":{"mechanical": 1.0, "co_processing": 0.8},
    }
    cf = _CF.get(category, {}).get(recycling_method, 1.0)
    return {
        "physical_melt_tons": physical_melt_tons,
        "category": category,
        "recycling_method": recycling_method,
        "conversion_factor": cf,
        "net_credit_tons": round(physical_melt_tons * cf, 2),
    }


def sign_form1_dsc(
    form_id: str,
    po_number: str,
    net_credit_tons: float,
    organization_gstin: str,
) -> dict[str, Any]:
    """Apply Digital Signature Certificate (DSC) to the Form-1 payload.

    Args:
        form_id: Generated Form-1 identifier
        po_number: Linked purchase order
        net_credit_tons: EPR credits to register
        organization_gstin: Company GSTIN for DSC lookup

    Returns:
        Signed form dict with DSC signature hash
    """
    # In production: loads the PKCS#12 certificate from CPCB_DIGITAL_SIGNATURE_PATH
    # and signs the form payload using the cryptography library.
    payload = f"{form_id}:{po_number}:{net_credit_tons}:{organization_gstin}"
    dsc_signature = f"DSC_X509_{hashlib.sha256(payload.encode()).hexdigest()[:24].upper()}"
    return {
        "form_id": form_id,
        "po_number": po_number,
        "net_credit_tons": net_credit_tons,
        "organization_gstin": organization_gstin,
        "dsc_signature": dsc_signature,
        "signing_algorithm": "SHA256withRSA",
        "signed": True,
    }


def dispatch_to_cpcb_portal(signed_form: dict[str, Any]) -> dict[str, Any]:
    """Submit the signed Form-1 to the CPCB national portal.

    Args:
        signed_form: Signed form payload from sign_form1_dsc

    Returns:
        Portal acknowledgement
    """
    # In production: calls CPCB_PORTAL_URL with retry via Temporal's backoff
    ack_number = f"ACK-CPCB-2026-{uuid.uuid4().hex[:10].upper()}"
    return {
        "form_id": signed_form.get("form_id"),
        "portal_status": "CPCB_ACCEPTED",
        "ack_number": ack_number,
        "registered_credits_tons": signed_form.get("net_credit_tons"),
        "portal_url": "https://cpcb.nic.in/epr-portal",
        "submission_timestamp": "2026-10-01T10:00:00Z",
    }


# ---------------------------------------------------------------------------
# ADK Agent Construction
# ---------------------------------------------------------------------------

LEGAL_INSTRUCTION = """You are the Legal Agent (Form Serializer) for SynthetIQ's statutory dispatch pipeline.

Your job:
1. Apply the statutory Cf conversion factor with `apply_conversion_factor` to compute net EPR credits.
2. Sign the Form-1 payload with `sign_form1_dsc` using the organization's Digital Signature Certificate.
3. Submit the signed form to the CPCB portal with `dispatch_to_cpcb_portal`.
4. Output a single JSON object with the full Form-1 dispatch result.

Regulatory Context:
  - Form-1 is the official CPCB document for registering recycling credits.
  - Credits = physical_melt_tons × Cf (conversion factor).
  - DSC signing is mandatory — unsigned forms are rejected by the portal.
  - The portal uses Temporal exponential backoff for retries on network failures.

Mandatory JSON output keys:
  form_id, po_number, physical_melt_tons, conversion_factor, net_credit_tons,
  dsc_signature, portal_status, ack_number
"""

legal_agent = create_llm_agent(
    name="legal_agent",
    instruction=LEGAL_INSTRUCTION,
    tools=[apply_conversion_factor, sign_form1_dsc, dispatch_to_cpcb_portal],
    description="Generates, DSC-signs, and submits CPCB Form-1 for EPR credit registration",
    output_key="form1_result",
)


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_legal_agent(
    po_number: str,
    audit_id: str,
    physical_melt_tons: float,
    category: str = "cat_i_rigid",
    recycling_method: str = "mechanical",
    organization_gstin: str = "27AAACH1234F1Z5",
    session_id: str | None = None,
) -> dict[str, Any]:
    """Run the Legal Agent to dispatch Form-1.

    Args:
        po_number: Linked purchase order
        audit_id: Linked audit ID
        physical_melt_tons: Verified physical volume
        category: Plastic category for Cf lookup
        recycling_method: mechanical or co_processing
        organization_gstin: Company GSTIN
        session_id: Optional ADK session ID

    Returns:
        Form-1 dispatch result dict
    """
    form_id = f"FORM1-{uuid.uuid4().hex[:8].upper()}"
    logger.info(f"Running legal_agent — form_id={form_id}, PO={po_number}")

    result = await run_agent(
        agent=legal_agent,
        user_message=(
            f"Generate and dispatch Form-1 for PO '{po_number}' (audit: {audit_id}). "
            f"Physical melt: {physical_melt_tons} tons, category: {category}, "
            f"method: {recycling_method}, GSTIN: {organization_gstin}, form_id: {form_id}. "
            "Return a single JSON object."
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
        logger.warning("Could not parse JSON from legal agent; returning raw")
        return {"raw_response": result.get("response", ""), "tool_calls": result.get("tool_calls", [])}
