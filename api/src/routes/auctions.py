"""Workflow 2: Liquidity & Continuous Double Auction routes.

RBAC:
  POST /auctions/rfp              → workflows:execute (compliance_officer+)
  GET  /auctions/                 → workflows:read    (viewer+)
  GET  /auctions/active           → workflows:read    (viewer+)
  GET  /auctions/{id}             → workflows:read    (viewer+)
  GET  /auctions/{id}/bids        → workflows:read    (viewer+)
"""

from __future__ import annotations

import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service

router = APIRouter(prefix="/auctions", tags=["Workflow 2 - Auctions"])

_AUCTIONS_DB: dict[str, dict[str, Any]] = {
    "AUC-2026-001": {
        "auction_id": "AUC-2026-001",
        "id": "AUC-2026-001",
        "category": "cat_i_rigid",
        "target_tons": 5000.0,
        "statutory_rate_per_kg": 12.0,
        "floor_price_inr": 3.6,
        "ceiling_price_inr": 12.0,
        "clearing_price_inr": 7.8,
        "total_cleared_tons": 5000.0,
        "status": "ACTIVE",
        "winning_recyclers": ["RECYC-DELHI-01", "RECYC-GUJ-04"],
        "created_at": "2026-10-01T08:00:00Z",
    }
}

# Bids per auction
_BIDS_DB: dict[str, list[dict[str, Any]]] = {
    "AUC-2026-001": [
        {
            "bid_id": "BID-DEL-101",
            "recycler_id": "RECYC-DELHI-01",
            "recycler_name": "EcoMelt Solutions Ltd",
            "plant_id": "PLANT-OKHLA-2",
            "plant_name": "Okhla Industrial Plant 2",
            "category": "cat_i_rigid",
            "volume_tons": 3000.0,
            "price_per_kg": 7.8,
            "status": "MATCHED",
            "timestamp": "2026-10-01T11:24:02Z",
        },
        {
            "bid_id": "BID-GUJ-204",
            "recycler_id": "RECYC-GUJ-04",
            "recycler_name": "Gujarat Poly-Recyclers",
            "plant_id": "PLANT-SURAT-1",
            "plant_name": "Surat GIDC Extrusion Facility",
            "category": "cat_i_rigid",
            "volume_tons": 2000.0,
            "price_per_kg": 7.8,
            "status": "MATCHED",
            "timestamp": "2026-10-01T11:24:08Z",
        },
        {
            "bid_id": "BID-MAH-309",
            "recycler_id": "RECYC-MAH-09",
            "recycler_name": "Deccan Circular Plastics",
            "plant_id": "PLANT-PUNE-1",
            "plant_name": "Pune Chakan Line 1",
            "category": "cat_i_rigid",
            "volume_tons": 2500.0,
            "price_per_kg": 8.4,
            "status": "BIDDING",
            "timestamp": "2026-10-01T11:24:15Z",
        },
        {
            "bid_id": "BID-TN-412",
            "recycler_id": "RECYC-TN-12",
            "recycler_name": "Chennai EcoProcessors",
            "plant_id": "PLANT-SRIPERUMBUDUR-1",
            "plant_name": "Sriperumbudur Hub",
            "category": "cat_i_rigid",
            "volume_tons": 1500.0,
            "price_per_kg": 13.5,
            "status": "OUT_OF_CORRIDOR",
            "timestamp": "2026-10-01T11:24:20Z",
        },
    ]
}


@router.post("/rfp")
async def broadcast_rfp(
    payload: dict[str, Any],
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    """Triggers Temporal Workflow 2: Liquidity & Dual-Mode Auction."""
    company_id = payload.get("company_id", "COMP-IN-001")
    category = payload.get("category", "cat_i_rigid")
    target_tons = float(payload.get("target_tons", 1000.0))
    workflow_id = f"wf2-auction-{uuid.uuid4().hex[:8]}"

    # Create a new auction record
    auction_id = f"AUC-{uuid.uuid4().hex[:8].upper()}"
    _AUCTIONS_DB[auction_id] = {
        "auction_id": auction_id,
        "id": auction_id,
        "category": category,
        "target_tons": target_tons,
        "statutory_rate_per_kg": 12.0,
        "floor_price_inr": 3.6,
        "ceiling_price_inr": 12.0,
        "clearing_price_inr": 0.0,
        "total_cleared_tons": 0.0,
        "status": "ACTIVE",
        "winning_recyclers": [],
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _BIDS_DB[auction_id] = []

    res = await temporal_service.start_workflow(
        workflow_name="AuctionLiquidityWorkflow",
        workflow_id=workflow_id,
        args=[company_id, category, target_tons],
    )
    return {
        "status": "auction_broadcast",
        "auction_id": auction_id,
        "workflow_id": workflow_id,
        "triggered_by": user["email"],
        "details": res,
    }


@router.get("/active")
async def list_active_auctions(
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:read")),
    company_id: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    """Returns auctions with status ACTIVE or MATCHING, optionally filtered by company."""
    active = [
        a for a in _AUCTIONS_DB.values()
        if a.get("status") in ("ACTIVE", "MATCHING")
    ]
    return sorted(active, key=lambda x: x.get("created_at", ""), reverse=True)


@router.get("/")
async def list_auctions(
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:read")),
) -> list[dict[str, Any]]:
    """Lists all active and completed market auctions sorted by created_at descending."""
    return sorted(
        _AUCTIONS_DB.values(),
        key=lambda x: x.get("created_at", ""),
        reverse=True,
    )


@router.get("/{auction_id}/bids")
async def list_auction_bids(
    auction_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:read")),
) -> list[dict[str, Any]]:
    """Returns live bid list for a specific auction."""
    if auction_id not in _AUCTIONS_DB:
        raise HTTPException(status_code=404, detail=f"Auction '{auction_id}' not found.")
    return _BIDS_DB.get(auction_id, [])


@router.get("/{auction_id}")
async def get_auction(
    auction_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:read")),
) -> dict[str, Any]:
    """Retrieves specific auction result and bid matching ledger."""
    auction = _AUCTIONS_DB.get(auction_id)
    if not auction:
        raise HTTPException(status_code=404, detail=f"Auction '{auction_id}' not found.")
    return auction
