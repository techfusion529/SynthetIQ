"""Workflow 2: Liquidity & Continuous Double Auction routes  -  DB-backed."""
from __future__ import annotations
import logging
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service
from src.utils.tenant import TenantCtx, get_tenant_ctx

router = APIRouter(prefix="/auctions", tags=["Workflow 2 - Auctions"])
logger = logging.getLogger(__name__)


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


async def _get_bids(auction_id: str) -> list[dict[str, Any]]:
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import BidRecord
        async with get_db_session() as session:
            rows = (await session.execute(
                select(BidRecord).where(BidRecord.auction_id == auction_id).order_by(BidRecord.created_at.asc())
            )).scalars().all()
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
    _: Any = Depends(require_permission("workflows:read")),
) -> list[dict[str, Any]]:
    return await _get_bids(auction_id)


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
