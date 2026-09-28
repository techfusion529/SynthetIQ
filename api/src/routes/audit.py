"""Workflow 3: Quad-Core Fraud Audit routes."""

from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter

from src.services.temporal_service import temporal_service

router = APIRouter(prefix="/audit", tags=["Workflow 3 - Fraud Audit"])

_AUDITS_DB: dict[str, dict[str, Any]] = {
    "AUD-2026-881": {
        "audit_id": "AUD-2026-881",
        "recycler_id": "RECYC-DELHI-01",
        "plant_id": "PLANT-OKHLA-2",
        "plastic_category": "cat_i_rigid",
        "reported_volume_tons": 250.0,
        "verified_physical_melt_tons": 248.6,
        "physical_melt_verified": True,
        "confidence_score": 0.965,
        "eway_bill_verified": True,
        "audit_verdict": "APPROVED",
        "rejection_reasons": [],
        "audit_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    }
}


@router.post("/trigger")
async def trigger_fraud_audit(payload: dict[str, Any]) -> dict[str, Any]:
    """Triggers Temporal Workflow 3: Quad-Core Fraud Audit on SCADA stream."""
    recycler_id = payload.get("recycler_id", "RECYC-DELHI-01")
    plant_id = payload.get("plant_id", "PLANT-OKHLA-2")
    category = payload.get("category", "cat_i_rigid")
    volume_tons = float(payload.get("volume_tons", 250.0))
    workflow_id = f"wf3-audit-{uuid.uuid4().hex[:8]}"

    res = await temporal_service.start_workflow(
        workflow_name="QuadCoreAuditWorkflow",
        workflow_id=workflow_id,
        args=[recycler_id, plant_id, category, volume_tons],
    )
    return {
        "status": "audit_initiated",
        "workflow_id": workflow_id,
        "recycler_id": recycler_id,
        "details": res,
    }


@router.get("/verdicts")
async def list_audit_verdicts() -> list[dict[str, Any]]:
    """Lists recent audit verdicts and anti-fraud evaluations."""
    return list(_AUDITS_DB.values())


@router.get("/verdict/{audit_id}")
async def get_audit_verdict(audit_id: str) -> dict[str, Any]:
    """Retrieves specific audit verdict and physical thermodynamic proof."""
    return _AUDITS_DB.get(
        audit_id,
        {"audit_id": audit_id, "audit_verdict": "PENDING", "physical_melt_verified": False},
    )
