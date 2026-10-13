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
        from synthetiq_shared.models import BidRecord
        async with get_db_session() as session:
            query = select(BidRecord).where(BidRecord.auction_id == auction_id).order_by(BidRecord.created_at.asc())
            if org_id is not None:
                query = query.where(BidRecord.org_id == org_id)
            rows = (await session.execute(query)).scalars().all()
            return [r.to_dict() for r in rows]
    except Exception as exc:
        logger.warning(f"DB bids query failed ({exc})")
    return []


@router.post("/rfp")
async def broadcast_rfp(
    payload: dict[str, Any],
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
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
                auction_id=auction_id,
                category=category,
                target_tons=target_tons,
                statutory_rate_per_kg=12.0,
                floor_price_inr=3.6,
                ceiling_price_inr=12.0,
                status="ACTIVE",
                company_id=company_id,
                winning_recyclers=[],
                org_id=tenant_ctx.org_id or None,
            ))
        logger.info(f"Persisted auction {auction_id}")
    except Exception as exc:
        logger.warning(f"Could not persist auction ({exc})")
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
    # platform_admin and brand_owner see all bids; recycler sees only their own
    if tenant_ctx.is_platform_admin or tenant_ctx.role == "brand_owner":
        return await _get_bids(auction_id)
    elif tenant_ctx.role == "recycler":
        return await _get_bids(auction_id, org_id=tenant_ctx.org_id)
    # fallback: return own bids only
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
