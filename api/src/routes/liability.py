"""Workflow 1: Upstream Liability & Sourcing Planning routes."""

from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, HTTPException

from src.services.temporal_service import temporal_service

router = APIRouter(prefix="/liability", tags=["Workflow 1 - Liability"])


@router.post("/calculate")
async def trigger_liability_calculation(payload: dict[str, Any]) -> dict[str, Any]:
    """Triggers Temporal Workflow 1: Upstream Liability & Sourcing Planning."""
    company_id = payload.get("company_id", "COMP-IN-001")
    fiscal_year = payload.get("fiscal_year", "FY2026-27")
    workflow_id = f"wf1-liability-{company_id}-{uuid.uuid4().hex[:8]}"

    res = await temporal_service.start_workflow(
        workflow_name="UpstreamLiabilityWorkflow",
        workflow_id=workflow_id,
        args=[company_id, fiscal_year],
    )
    return {
        "status": "initiated",
        "workflow_id": workflow_id,
        "company_id": company_id,
        "fiscal_year": fiscal_year,
        "details": res,
    }


@router.get("/report/{company_id}")
async def get_liability_report(company_id: str, fiscal_year: str = "FY2026-27") -> dict[str, Any]:
    """Retrieves calculated physical & digital compliance liability breakdown."""
    # Pre-calculated demo/cached response
    return {
        "company_id": company_id,
        "fiscal_year": fiscal_year,
        "current_year_liability_tons": 18500.0,
        "historic_debt_tons": 3600.0,
        "amortized_debt_tons": 1200.0,  # 1/3 amortization rule
        "already_fulfilled_tons": 2500.0,
        "net_liability_tons": 17200.0,
        "breakdown_by_category": {
            "cat_i_rigid": 7500.0,
            "cat_ii_flexible": 6200.0,
            "cat_iii_mlp": 2500.0,
            "cat_iv_compostable": 1000.0,
        },
        "confidence_score": 0.98,
        "status": "calculated",
    }
