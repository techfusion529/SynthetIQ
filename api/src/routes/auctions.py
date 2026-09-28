"""Workflow 2: Liquidity & Continuous Double Auction routes."""

from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter

from src.services.temporal_service import temporal_service

router = APIRouter(prefix="/auctions", tags=["Workflow 2 - Auctions"])

_AUCTIONS_DB: dict[str, dict[str, Any]] = {
    "AUC-2026-001": {
        "auction_id": "AUC-2026-001",
        "category": "cat_i_rigid",
        "target_tons": 5000.0,
        "statutory_rate_per_kg": 12.0,
        "floor_price_inr": 3.6,  # 30% corridor floor
        "ceiling_price_inr": 12.0,  # 100% corridor ceiling
        "clearing_price_inr": 7.8,
        "total_cleared_tons": 5000.0,
        "status": "COMPLETED",
        "winning_recyclers": ["RECYC-DELHI-01", "RECYC-GUJ-04"],
    }
}


@router.post("/rfp")
async def broadcast_rfp(payload: dict[str, Any]) -> dict[str, Any]:
    """Triggers Temporal Workflow 2: Liquidity & Dual-Mode Auction."""
    company_id = payload.get("company_id", "COMP-IN-001")
    category = payload.get("category", "cat_i_rigid")
    target_tons = float(payload.get("target_tons", 1000.0))
    workflow_id = f"wf2-auction-{uuid.uuid4().hex[:8]}"

    res = await temporal_service.start_workflow(
        workflow_name="AuctionLiquidityWorkflow",
        workflow_id=workflow_id,
        args=[company_id, category, target_tons],
    )
    return {
        "status": "auction_broadcast",
        "workflow_id": workflow_id,
        "details": res,
    }


@router.get("/")
async def list_auctions() -> list[dict[str, Any]]:
    """Lists all active and completed market auctions."""
    return list(_AUCTIONS_DB.values())


@router.get("/{auction_id}")
async def get_auction(auction_id: str) -> dict[str, Any]:
    """Retrieves specific auction result and bid matching ledger."""
    return _AUCTIONS_DB.get(
        auction_id,
        {"auction_id": auction_id, "status": "UNKNOWN"},
    )
