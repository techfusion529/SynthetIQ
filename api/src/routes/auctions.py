"""Workflow 2: Liquidity & Continuous Double Auction routes — DB-backed."""
from __future__ import annotations
import logging, time, uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service

router = APIRouter(prefix="/auctions", tags=["Workflow 2 - Auctions"])
logger = logging.getLogger(__name__)

_SEED_AUCTION: dict[str, Any] = {
    "auction_id": "AUC-2026-001", "id": "AUC-2026-001",
    "category": "cat_i_rigid", "target_tons": 5000.0, "statutory_rate_per_kg": 12.0,
    "floor_price_inr": 3.6, "ceiling_price_inr": 12.0, "clearing_price_inr": 7.8,
    "total_cleared_tons": 5000.0, "status": "ACTIVE", "company_id": "COMP-IN-001",
    "winning_recyclers": ["RECYC-DELHI-01", "RECYC-GUJ-04"], "created_at": "2026-10-01T08:00:00Z",
}
_SEED_BIDS: list[dict[str, Any]] = [
    {"bid_id":"BID-DEL-101","auction_id":"AUC-2026-001","recycler_id":"RECYC-DELHI-01",
     "recycler_name":"EcoMelt Solutions Ltd","plant_id":"PLANT-OKHLA-2",
     "plant_name":"Okhla Industrial Plant 2","category":"cat_i_rigid",
     "volume_tons":3000.0,"price_per_kg":7.8,"status":"MATCHED","timestamp":"2026-10-01T11:24:02Z"},
    {"bid_id":"BID-GUJ-204","auction_id":"AUC-2026-001","recycler_id":"RECYC-GUJ-04",
     "recycler_name":"Gujarat Poly-Recyclers","plant_id":"PLANT-SURAT-1",
     "plant_name":"Surat GIDC Extrusion Facility","category":"cat_i_rigid",
     "volume_tons":2000.0,"price_per_kg":7.8,"status":"MATCHED","timestamp":"2026-10-01T11:24:08Z"},
    {"bid_id":"BID-MAH-309","auction_id":"AUC-2026-001","recycler_id":"RECYC-MAH-09",
     "recycler_name":"Deccan Circular Plastics","plant_id":"PLANT-PUNE-1",
     "plant_name":"Pune Chakan Line 1","category":"cat_i_rigid",
     "volume_tons":2500.0,"price_per_kg":8.4,"status":"BIDDING","timestamp":"2026-10-01T11:24:15Z"},
    {"bid_id":"BID-TN-412","auction_id":"AUC-2026-001","recycler_id":"RECYC-TN-12",
     "recycler_name":"Chennai EcoProcessors","plant_id":"PLANT-SRIPERUMBUDUR-1",
     "plant_name":"Sriperumbudur Hub","category":"cat_i_rigid",
     "volume_tons":1500.0,"price_per_kg":13.5,"status":"OUT_OF_CORRIDOR","timestamp":"2026-10-01T11:24:20Z"},
]
_AUCTIONS_CACHE: dict[str, dict[str, Any]] = {}
_BIDS_CACHE: dict[str, list[dict[str, Any]]] = {}
_seeded = False

async def _seed_db_if_empty() -> None:
    global _seeded
    if _seeded:
        return
    try:
        from sqlalchemy import select, func as sqlfunc
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuctionRecord, BidRecord
        async with get_db_session() as session:
            cnt = (await session.execute(select(sqlfunc.count()).select_from(AuctionRecord))).scalar() or 0
            if cnt == 0:
                session.add(AuctionRecord(
                    auction_id="AUC-2026-001", category="cat_i_rigid", target_tons=5000.0,
                    statutory_rate_per_kg=12.0, floor_price_inr=3.6, ceiling_price_inr=12.0,
                    clearing_price_inr=7.8, total_cleared_tons=5000.0, status="ACTIVE",
                    company_id="COMP-IN-001", winning_recyclers=["RECYC-DELHI-01","RECYC-GUJ-04"],
                ))
                for b in _SEED_BIDS:
                    session.add(BidRecord(
                        bid_id=b["bid_id"], auction_id=b["auction_id"],
                        recycler_id=b["recycler_id"], recycler_name=b["recycler_name"],
                        plant_id=b["plant_id"], plant_name=b["plant_name"],
                        category=b["category"], volume_tons=b["volume_tons"],
                        price_per_kg=b["price_per_kg"], status=b["status"],
                    ))
                logger.info("Seeded auctions DB with AUC-2026-001 + 4 bids")
        _seeded = True
    except Exception as exc:
        logger.warning(f"Auction seed failed ({exc}); using in-memory")
        _AUCTIONS_CACHE["AUC-2026-001"] = _SEED_AUCTION
        _BIDS_CACHE["AUC-2026-001"] = _SEED_BIDS

async def _get_all_auctions() -> list[dict[str, Any]]:
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuctionRecord
        async with get_db_session() as session:
            rows = (await session.execute(select(AuctionRecord).order_by(AuctionRecord.created_at.desc()))).scalars().all()
            if rows:
                return [r.to_dict() for r in rows]
    except Exception as exc:
        logger.warning(f"DB auctions query failed ({exc})")
    if not _AUCTIONS_CACHE:
        _AUCTIONS_CACHE["AUC-2026-001"] = _SEED_AUCTION
    return list(_AUCTIONS_CACHE.values())

async def _get_bids(auction_id: str) -> list[dict[str, Any]]:
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import BidRecord
        async with get_db_session() as session:
            rows = (await session.execute(
                select(BidRecord).where(BidRecord.auction_id == auction_id).order_by(BidRecord.created_at.asc())
            )).scalars().all()
            if rows:
                return [r.to_dict() for r in rows]
    except Exception as exc:
        logger.warning(f"DB bids query failed ({exc})")
    if auction_id == "AUC-2026-001":
        return _SEED_BIDS
    return _BIDS_CACHE.get(auction_id, [])

@router.post("/rfp")
async def broadcast_rfp(payload: dict[str, Any], user: CurrentUser, _: Any = Depends(require_permission("workflows:execute"))) -> dict[str, Any]:
    company_id = payload.get("company_id", "COMP-IN-001")
    category = payload.get("category", "cat_i_rigid")
    target_tons = float(payload.get("target_tons", 1000.0))
    auction_id = f"AUC-{uuid.uuid4().hex[:8].upper()}"
    workflow_id = f"wf2-auction-{uuid.uuid4().hex[:8]}"
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuctionRecord
        async with get_db_session() as session:
            session.add(AuctionRecord(
                auction_id=auction_id, category=category, target_tons=target_tons,
                statutory_rate_per_kg=12.0, floor_price_inr=3.6, ceiling_price_inr=12.0,
                status="ACTIVE", company_id=company_id, winning_recyclers=[],
            ))
        logger.info(f"Persisted auction {auction_id}")
    except Exception as exc:
        logger.warning(f"Could not persist auction ({exc})")
        _AUCTIONS_CACHE[auction_id] = {"auction_id": auction_id, "id": auction_id,
            "category": category, "target_tons": target_tons, "status": "ACTIVE",
            "statutory_rate_per_kg": 12.0, "floor_price_inr": 3.6, "ceiling_price_inr": 12.0,
            "clearing_price_inr": 0.0, "total_cleared_tons": 0.0, "company_id": company_id,
            "winning_recyclers": [], "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        _BIDS_CACHE[auction_id] = []
    res = await temporal_service.start_workflow(workflow_name="AuctionLiquidityWorkflow", workflow_id=workflow_id, args=[company_id, category, target_tons])
    return {"status": "auction_broadcast", "auction_id": auction_id, "workflow_id": workflow_id, "triggered_by": user["email"], "details": res}

@router.get("/active")
async def list_active_auctions(user: CurrentUser, _: Any = Depends(require_permission("workflows:read")), company_id: str | None = Query(default=None)) -> list[dict[str, Any]]:
    await _seed_db_if_empty()
    return [a for a in await _get_all_auctions() if a.get("status") in ("ACTIVE", "MATCHING")]

@router.get("/")
async def list_auctions(user: CurrentUser, _: Any = Depends(require_permission("workflows:read"))) -> list[dict[str, Any]]:
    await _seed_db_if_empty()
    return await _get_all_auctions()

@router.get("/{auction_id}/bids")
async def list_auction_bids(auction_id: str, user: CurrentUser, _: Any = Depends(require_permission("workflows:read"))) -> list[dict[str, Any]]:
    return await _get_bids(auction_id)

@router.get("/{auction_id}")
async def get_auction(auction_id: str, user: CurrentUser, _: Any = Depends(require_permission("workflows:read"))) -> dict[str, Any]:
    await _seed_db_if_empty()
    match = next((a for a in await _get_all_auctions() if a.get("auction_id") == auction_id), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Auction not found: {auction_id}")
    return match
