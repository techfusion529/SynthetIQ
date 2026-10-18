"""Workflow 2: Liquidity & Continuous Double Auction routes  -  DB-backed."""
from __future__ import annotations
import logging
import uuid
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service
from src.utils.tenant import TenantCtx, get_tenant_ctx

router = APIRouter(prefix="/auctions", tags=["Workflow 2 - Auctions"])
logger = logging.getLogger(__name__)


class BidSubmitRequest(BaseModel):
    volume_tons: float
    price_per_kg: float


async def _get_all_auctions(org_id: str | None = None, is_platform_admin: bool = False, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuctionRecord
        async with get_db_session() as session:
            query = select(AuctionRecord).order_by(AuctionRecord.created_at.desc())
            if not is_platform_admin and org_id:
                query = query.where(AuctionRecord.org_id == org_id)
            query = query.limit(limit).offset(offset)
            rows = (await session.execute(query)).scalars().all()
            return [r.to_dict() for r in rows]
    except Exception as exc:
        logger.warning(f"DB auctions query failed ({exc})")
    return []


async def _get_bids(auction_id: str, org_id: str | None = None) -> list[dict[str, Any]]:
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import BidRecord, AuctionRecord
        from synthetiq_shared.utils.auction_simulator import simulate_and_persist_bids
        async with get_db_session() as session:
            query = select(BidRecord).where(BidRecord.auction_id == auction_id).order_by(BidRecord.created_at.asc())
            if org_id is not None:
                query = query.where(BidRecord.org_id == org_id)
            rows = (await session.execute(query)).scalars().all()

            if not rows:
                # If no bids exist for this auction, auto-simulate from accredited recyclers
                auc = (await session.execute(
                    select(AuctionRecord).where(AuctionRecord.auction_id == auction_id)
                )).scalar_one_or_none()
                if auc:
                    eff_floor = auc.corridor_min if auc.corridor_min is not None else auc.floor_price_inr
                    eff_ceil = auc.corridor_max if auc.corridor_max is not None else auc.ceiling_price_inr
                    sim_rows = await simulate_and_persist_bids(
                        auction_id=auction_id,
                        category=auc.category,
                        target_tons=auc.target_tons or 100.0,
                        floor_price=eff_floor or 3.6,
                        ceiling_price=eff_ceil or 12.0,
                        org_id=auc.org_id,
                    )
                    if org_id is not None:
                        return [b.to_dict() for b in sim_rows if b.org_id == org_id]
                    return [b.to_dict() for b in sim_rows]

            return [r.to_dict() for r in rows]
    except Exception as exc:
        logger.warning(f"DB bids query failed ({exc})")
    return []


DEFAULT_STATUTORY_RATES: dict[str, float] = {
    "cat_i_rigid": 12.0,
    "cat_ii_flexible": 10.0,
    "cat_iii_mlp": 8.0,
    "cat_iv_compostable": 15.0,
}


@router.post("/rfp")
async def broadcast_rfp(
    payload: dict[str, Any],
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    company_id = payload.get("company_id") or tenant_ctx.org_id
    if not company_id:
        raise HTTPException(status_code=400, detail="company_id required")
    category = payload.get("category", "cat_i_rigid")

    target_tons_raw = payload.get("target_tons")
    if target_tons_raw is None:
        raise HTTPException(
            status_code=422,
            detail="target_tons is required",
        )
    try:
        target_tons = float(target_tons_raw)
        if target_tons <= 0:
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=422,
            detail="target_tons must be a positive number",
        )

    # Statutory rate & price corridor defaults (floor 30%, ceiling 100%)
    statutory_rate_raw = payload.get("statutory_rate_per_kg")
    if statutory_rate_raw is None:
        statutory_rate = DEFAULT_STATUTORY_RATES.get(category, 12.0)
    else:
        try:
            statutory_rate = float(statutory_rate_raw)
        except (ValueError, TypeError):
            statutory_rate = DEFAULT_STATUTORY_RATES.get(category, 12.0)

    floor_price_raw = payload.get("floor_price_inr")
    if floor_price_raw is None:
        floor_price = round(statutory_rate * 0.30, 2)
    else:
        try:
            floor_price = float(floor_price_raw)
        except (ValueError, TypeError):
            floor_price = round(statutory_rate * 0.30, 2)

    ceiling_price_raw = payload.get("ceiling_price_inr")
    if ceiling_price_raw is None:
        ceiling_price = round(statutory_rate * 1.00, 2)
    else:
        try:
            ceiling_price = float(ceiling_price_raw)
        except (ValueError, TypeError):
            ceiling_price = round(statutory_rate * 1.00, 2)

    if floor_price > ceiling_price:
        floor_price, ceiling_price = ceiling_price, floor_price

    # CFG-03: fetch corridor from active regulatory pack; fall back to request body values
    _corridor_min: float = floor_price
    _corridor_max: float = ceiling_price
    try:
        from synthetiq_shared.database import get_db_session as _get_db
        from synthetiq_shared.models.dynamic_config import RegulatoryPack as _RPack
        from sqlalchemy import select as _select
        async with _get_db() as _s:
            _pack = (await _s.execute(
                _select(_RPack)
                .where(_RPack.status == "active")
                .order_by(_RPack.approved_at.desc())
                .limit(1)
            )).scalar_one_or_none()
            if _pack and _pack.payload:
                _payload = _pack.payload
                _corridor_min = float(_payload.get("price_corridor_min", floor_price))
                _corridor_max = float(_payload.get("price_corridor_max", ceiling_price))
    except Exception as _pack_exc:
        logger.warning(f"Could not fetch pack corridor ({_pack_exc}); using request values")

    auction_id = f"AUC-{uuid.uuid4().hex[:8].upper()}"
    workflow_id = f"wf2-auction-{uuid.uuid4().hex[:8]}"
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuctionRecord
        from synthetiq_shared.utils.auction_simulator import simulate_and_persist_bids

        async with get_db_session() as session:
            session.add(AuctionRecord(
                auction_id=auction_id,
                category=category,
                target_tons=target_tons,
                statutory_rate_per_kg=statutory_rate,
                floor_price_inr=floor_price,
                ceiling_price_inr=ceiling_price,
                corridor_min=_corridor_min,
                corridor_max=_corridor_max,
                status="ACTIVE",
                company_id=company_id,
                winning_recyclers=[],
                org_id=tenant_ctx.org_id or None,
            ))
            await session.commit()
        logger.info(f"Persisted auction {auction_id}")

        # Simulate bids from accredited Recycler Bidders within statutory corridor
        sim_bids = await simulate_and_persist_bids(
            auction_id=auction_id,
            category=category,
            target_tons=target_tons,
            floor_price=_corridor_min,
            ceiling_price=_corridor_max,
            org_id=tenant_ctx.org_id,
        )
        logger.info(f"Simulated {len(sim_bids)} recycler bids for auction {auction_id}")
    except Exception as exc:
        logger.warning(f"Could not persist auction or simulate bids ({exc})")

    res = await temporal_service.start_workflow(
        workflow_name="AuctionLiquidityWorkflow",
        workflow_id=workflow_id,
        args=[
            company_id,
            category,
            float(target_tons),
            float(statutory_rate),
            auction_id,
            tenant_ctx.org_id or "",
            float(_corridor_min),
            float(_corridor_max),
        ],
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
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:read")),
    company_id: str | None = Query(default=None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    auctions = await _get_all_auctions(
        org_id=tenant_ctx.org_id,
        is_platform_admin=tenant_ctx.is_platform_admin,
        limit=limit,
        offset=offset,
    )
    return [a for a in auctions if a.get("status") in ("ACTIVE", "MATCHING")]


@router.get("/")
async def list_auctions(
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:read")),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    return await _get_all_auctions(
        org_id=tenant_ctx.org_id,
        is_platform_admin=tenant_ctx.is_platform_admin,
        limit=limit,
        offset=offset,
    )


@router.get("/{auction_id}/bids")
async def list_auction_bids(
    auction_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:read")),
) -> list[dict[str, Any]]:
    # platform_admin, brand_owner, and all non-recycler auditors/admins see all bids
    # recycler sees only their own organization's bids
    if tenant_ctx.is_platform_admin or tenant_ctx.role != "recycler":
        return await _get_bids(auction_id)
    return await _get_bids(auction_id, org_id=tenant_ctx.org_id)


@router.post("/{auction_id}/bids")
async def submit_bid(
    auction_id: str,
    body: BidSubmitRequest,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:execute")),
) -> JSONResponse:
    if tenant_ctx.role != "recycler":
        raise HTTPException(status_code=403, detail="recycler role required")

    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuctionRecord, BidRecord
        async with get_db_session() as session:
            result = await session.execute(
                select(AuctionRecord).where(AuctionRecord.auction_id == auction_id)
            )
            auction = result.scalar_one_or_none()
            if auction is None:
                raise HTTPException(status_code=404, detail=f"Auction not found: {auction_id}")
            if auction.status != "ACTIVE":
                raise HTTPException(status_code=400, detail=f"Auction is not active (status={auction.status})")

            # Corridor validation: prefer corridor_min/max, fall back to floor/ceiling
            effective_min = auction.corridor_min if auction.corridor_min is not None else auction.floor_price_inr
            effective_max = auction.corridor_max if auction.corridor_max is not None else auction.ceiling_price_inr
            if not (effective_min <= body.price_per_kg <= effective_max):
                raise HTTPException(
                    status_code=422,
                    detail=f"price_per_kg {body.price_per_kg} outside corridor [{effective_min}, {effective_max}]",
                )

            bid = BidRecord(
                bid_id=f"BID-{uuid4().hex[:8].upper()}",
                auction_id=auction_id,
                recycler_id=tenant_ctx.org_id,
                org_id=tenant_ctx.org_id,
                volume_tons=body.volume_tons,
                price_per_kg=body.price_per_kg,
                category=auction.category,
                status="BIDDING",
            )
            session.add(bid)
            await session.commit()
            await session.refresh(bid)
            return JSONResponse(status_code=201, content=bid.to_dict())
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to submit bid for auction {auction_id}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to submit bid")


@router.get("/{auction_id}")
async def get_auction(
    auction_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:read")),
) -> dict[str, Any]:
    auctions = await _get_all_auctions(
        org_id=tenant_ctx.org_id,
        is_platform_admin=tenant_ctx.is_platform_admin,
        limit=200,
        offset=0,
    )
    match = next((a for a in auctions if a.get("auction_id") == auction_id), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Auction not found: {auction_id}")
    return match
