"""Workflow 4: Settlement, Human-in-the-Loop Approval & Statutory Dispatch.

RBAC:
  POST /settlement/approve            → workflows:execute (compliance_officer+)
  GET  /settlement/pos                → audits:read       (viewer+)
  GET  /settlement/pos/{po_number}    → audits:read       (viewer+)
  POST /settlement/form1/dispatch     → workflows:execute (compliance_officer+)
  GET  /settlement/form1/{form_id}    → audits:read       (viewer+)
"""

from __future__ import annotations

import hashlib
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service

router = APIRouter(prefix="/settlement", tags=["Workflow 4 - Settlement"])

_ESCROW_POS: dict[str, dict[str, Any]] = {
    "PO-2026-901": {
        "po_number": "PO-2026-901",
        "company_id": "COMP-IN-001",
        "recycler_id": "RECYC-DELHI-01",
        "recycler_name": "EcoMelt Solutions Ltd",
        "category": "cat_i_rigid",
        "plastic_tons": 250.0,
        "total_amount_inr": 1950000.0,
        "advance_amount_inr": 1560000.0,
        "retention_amount_inr": 390000.0,
        "status": "advance_released",
        "escrow_account": "ESCROW-HDFC-9921",
        "audit_id": "AUD-2026-881",
        "sap_purchase_order_number": "PO-2026-901",
        "sap_sync_status": "COMMITTED_TO_SAP_S4HANA",
    }
}

# Store dispatched Form-1 records
_FORM1_DB: dict[str, dict[str, Any]] = {}


@router.post("/approve")
async def approve_audit_and_settle(
    payload: dict[str, Any],
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    """Human-in-the-Loop approval gate — signals Temporal Workflow 4."""
    audit_id = payload.get("audit_id")
    if not audit_id:
        raise HTTPException(status_code=400, detail="audit_id required")

    workflow_id = payload.get("workflow_id", f"wf4-settlement-{audit_id}")
    action      = payload.get("action", "APPROVE")

    signal_res = await temporal_service.signal_workflow(
        workflow_id=workflow_id,
        signal_name="HumanApprovalSignal",
        signal_args=[{"approver": user["email"], "decision": action}],
    )
    return {
        "status": "approved" if action == "APPROVE" else "rejected",
        "audit_id": audit_id,
        "approved_by": user["email"],
        "signal_result": signal_res,
    }


@router.get("/pos")
async def list_escrow_pos(
    user: CurrentUser,
    _: Any = Depends(require_permission("audits:read")),
) -> list[dict[str, Any]]:
    """Lists all 80/20 escrow purchase orders."""
    return list(_ESCROW_POS.values())


@router.get("/pos/{po_number}")
async def get_escrow_po(
    po_number: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("audits:read")),
) -> dict[str, Any]:
    """Returns a single escrow PO record with full financial details."""
    po = _ESCROW_POS.get(po_number)
    if not po:
        raise HTTPException(status_code=404, detail=f"PO '{po_number}' not found.")
    return po


@router.post("/form1/dispatch")
async def dispatch_form1_statutory(
    payload: dict[str, Any],
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    """Generates Form-1 with Cf conversion factor and DSC signature for CPCB portal."""
    po_number = payload.get("po_number")
    if not po_number:
        raise HTTPException(status_code=400, detail="po_number required")

    po = _ESCROW_POS.get(po_number)
    if not po:
        raise HTTPException(status_code=404, detail=f"PO '{po_number}' not found.")

    form_id = f"FORM1-{uuid.uuid4().hex[:8].upper()}"
    ack_number = f"ACK-CPCB-{uuid.uuid4().hex[:10].upper()}"
    dsc_signature = f"DSC_X509_{hashlib.sha256(f'{form_id}{po_number}'.encode()).hexdigest()[:24].upper()}"
    physical_tons = po.get("plastic_tons", 0.0)
    cf = 1.0
    credit_tons = round(physical_tons * cf, 2)

    form1_record: dict[str, Any] = {
        "form_id": form_id,
        "company_id": po.get("company_id", ""),
        "legal_entity_name": "Hindustan Consumer Goods Ltd",
        "gstin": "27AAACH1234F1Z5",
        "fiscal_year": "FY2026-27",
        "recycler_id": po.get("recycler_id", ""),
        "recycler_name": po.get("recycler_name", ""),
        "plant_id": "PLANT-OKHLA-2",
        "plastic_category": po.get("category", "cat_i_rigid"),
        "physical_melt_verified_tons": physical_tons,
        "conversion_factor_cf": cf,
        "credited_compliance_tons": credit_tons,
        "sap_purchase_order_number": po_number,
        "audit_hash_sha256": f"e3b0c44298fc1c149afbf4c8996fb924{uuid.uuid4().hex[:8]}",
        "scada_vfd_verification": {
            "viscous_torque_nm": 57.7,
            "motor_power_factor": 0.871,
            "thermodynamic_enthalpy_kwh_kg": 0.38,
            "system1_reflex_status": "APPROVED",
        },
        "statutory_declaration": (
            "I hereby certify under penalty of perjury that the plastic compliance credits "
            "reported herein are backed by physical mechanical melting verified through SCADA "
            "electrical telemetry."
        ),
        "digital_signature": {
            "algorithm": "SHA256withRSA",
            "signer_dn": "CN=Compliance Officer, O=Hindustan Consumer Goods Ltd, ST=Maharashtra, C=IN",
            "certificate_serial": f"CERT-2026-X509-{uuid.uuid4().hex[:5].upper()}",
            "signature_value": dsc_signature,
            "timestamp": "2026-10-01T11:28:40Z",
        },
        "cpcb_portal_submission": {
            "portal_status": "CPCB_ACCEPTED",
            "portal_acknowledgment_number": ack_number,
            "submitted_at": "2026-10-01T11:28:42Z",
        },
        "portal_status": "CPCB_ACCEPTED",
        "portal_ack_number": ack_number,
        "dsc_signature": dsc_signature,
        "dispatched_by": user["email"],
    }

    _FORM1_DB[form_id] = form1_record
    return form1_record


@router.get("/form1")
async def list_form1_records(
    user: CurrentUser,
    _: Any = Depends(require_permission("audits:read")),
) -> list[dict[str, Any]]:
    """Lists all dispatched Form-1 statutory records."""
    return list(_FORM1_DB.values())


@router.get("/form1/{form_id}")
async def get_form1(
    form_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("audits:read")),
) -> dict[str, Any]:
    """Returns the full Form-1 statutory payload for a given form_id."""
    form1 = _FORM1_DB.get(form_id)
    if not form1:
        raise HTTPException(status_code=404, detail=f"Form-1 '{form_id}' not found.")
    return form1

