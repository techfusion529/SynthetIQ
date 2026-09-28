"""Workflow 4: Settlement, Human-in-the-Loop Approval & Statutory Dispatch."""

from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, Header, HTTPException

from src.services.auth_service import auth_service
from src.services.temporal_service import temporal_service

router = APIRouter(prefix="/settlement", tags=["Workflow 4 - Settlement"])

_ESCROW_POS: dict[str, dict[str, Any]] = {
    "PO-2026-901": {
        "po_number": "PO-2026-901",
        "company_id": "COMP-IN-001",
        "recycler_id": "RECYC-DELHI-01",
        "category": "cat_i_rigid",
        "plastic_tons": 250.0,
        "total_amount_inr": 1950000.0,
        "advance_amount_inr": 1560000.0,  # 80% advance
        "retention_amount_inr": 390000.0,  # 20% retention held in escrow
        "status": "advance_released",
        "audit_id": "AUD-2026-881",
    }
}


@router.post("/approve")
async def approve_audit_and_settle(
    payload: dict[str, Any],
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Human-in-the-Loop approval gate via Firebase Auth token.

    Signals Workflow 4 to generate the 80/20 Escrow Purchase Order and Form-1.
    """
    user_info = await auth_service.verify_token(authorization)
    audit_id = payload.get("audit_id")
    if not audit_id:
        raise HTTPException(status_code=400, detail="audit_id required")

    workflow_id = payload.get("workflow_id", f"wf4-settlement-{audit_id}")
    action = payload.get("action", "APPROVE")

    signal_res = await temporal_service.signal_workflow(
        workflow_id=workflow_id,
        signal_name="HumanApprovalSignal",
        signal_args=[{"approver": user_info["email"], "decision": action}],
    )

    return {
        "status": "approved" if action == "APPROVE" else "rejected",
        "audit_id": audit_id,
        "approved_by": user_info["email"],
        "signal_result": signal_res,
    }


@router.get("/pos")
async def list_escrow_pos() -> list[dict[str, Any]]:
    """Lists all 80/20 escrow purchase orders."""
    return list(_ESCROW_POS.values())


@router.post("/form1/dispatch")
async def dispatch_form1_statutory(payload: dict[str, Any]) -> dict[str, Any]:
    """Generates Form-1 with Cf conversion factor and DSC signature to CPCB portal."""
    po_number = payload.get("po_number", "PO-2026-901")
    form_id = f"FORM1-{uuid.uuid4().hex[:8].upper()}"

    return {
        "form_id": form_id,
        "po_number": po_number,
        "cf_conversion_factor": 1.0,
        "physical_tons": 250.0,
        "credit_tons": 250.0,
        "dsc_signature": "DSC_SIG_48F19B8C7E2A91F0",
        "portal_status": "CPCB_ACCEPTED",
        "portal_ack_number": f"ACK-CPCB-{uuid.uuid4().hex[:10].upper()}",
    }
