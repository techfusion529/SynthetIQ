"""Regulatory Packs Router — platform-admin managed CPCB parameter versioning.

RBAC:
  POST /regulatory-packs                     -> platform_admin only
  POST /regulatory-packs/{pack_id}/submit    -> platform_admin only
  POST /regulatory-packs/{pack_id}/approve   -> platform_admin only (maker-checker)
  GET  /regulatory-packs                     -> any authenticated user
  GET  /regulatory-packs/{pack_id}           -> any authenticated user
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_platform_admin
from synthetiq_shared.constants import RegulatoryPackStatus
from synthetiq_shared.database import get_db_session
from synthetiq_shared.models import RegulatoryPack
from synthetiq_shared.models.dynamic_config import RegulatoryPackPayload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/regulatory-packs", tags=["Regulatory Packs"])


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CreateRegulatoryPackRequest(BaseModel):
    version: str
    jurisdiction: str = "IN"
    effective_from: date
    effective_to: date | None = None
    payload: RegulatoryPackPayload


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _pack_summary(pack: RegulatoryPack) -> dict[str, Any]:
    return {
        "id": pack.id,
        "version": pack.version,
        "jurisdiction": pack.jurisdiction,
        "effective_from": pack.effective_from.isoformat() if pack.effective_from else None,
        "effective_to": pack.effective_to.isoformat() if pack.effective_to else None,
        "status": pack.status,
        "approved_by": pack.approved_by,
        "approved_at": pack.approved_at.isoformat() if pack.approved_at else None,
        "created_by": pack.created_by,
        "created_at": pack.created_at.isoformat() if pack.created_at else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_regulatory_pack(
    body: CreateRegulatoryPackRequest,
    user: dict[str, Any] = Depends(require_platform_admin()),
) -> dict[str, Any]:
    """Create a new regulatory pack in draft status. platform_admin only."""
    async with get_db_session() as session:
        pack = RegulatoryPack(
            version=body.version,
            jurisdiction=body.jurisdiction,
            effective_from=body.effective_from,
            effective_to=body.effective_to,
            status=RegulatoryPackStatus.draft.value,
            created_by=user["uid"],
            payload=body.payload.model_dump(),
        )
        session.add(pack)
        try:
            await session.flush()
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Regulatory pack with version {body.version!r} already exists",
            )
        logger.info(f"Created regulatory pack {pack.version!r} by {user['email']}")
        return _pack_summary(pack)


@router.post("/{pack_id}/submit")
async def submit_regulatory_pack(
    pack_id: str,
    user: dict[str, Any] = Depends(require_platform_admin()),
) -> dict[str, Any]:
    """Move a draft pack to pending_approval. platform_admin only."""
    async with get_db_session() as session:
        res = await session.execute(
            select(RegulatoryPack).where(RegulatoryPack.id == pack_id)
        )
        pack = res.scalar_one_or_none()
        if not pack:
            raise HTTPException(status_code=404, detail="Regulatory pack not found")
        if pack.status != RegulatoryPackStatus.draft.value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Pack must be in 'draft' status to submit; current status: {pack.status!r}",
            )
        pack.status = RegulatoryPackStatus.pending_approval.value
        logger.info(f"Submitted regulatory pack {pack.version!r} for approval by {user['email']}")
        return _pack_summary(pack)


@router.post("/{pack_id}/approve")
async def approve_regulatory_pack(
    pack_id: str,
    user: dict[str, Any] = Depends(require_platform_admin()),
) -> dict[str, Any]:
    """Approve a pending_approval pack. Maker-checker: approver must differ from creator. platform_admin only."""
    async with get_db_session() as session:
        res = await session.execute(
            select(RegulatoryPack).where(RegulatoryPack.id == pack_id)
        )
        pack = res.scalar_one_or_none()
        if not pack:
            raise HTTPException(status_code=404, detail="Regulatory pack not found")
        if pack.status != RegulatoryPackStatus.pending_approval.value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Pack must be in 'pending_approval' status to approve; current: {pack.status!r}",
            )
        # Maker-checker: approver must differ from creator
        if pack.created_by == user["uid"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Maker-checker violation: the approver must differ from the creator",
            )

        # Supersede any currently active pack for the same jurisdiction
        active_res = await session.execute(
            select(RegulatoryPack)
            .where(RegulatoryPack.jurisdiction == pack.jurisdiction)
            .where(RegulatoryPack.status == RegulatoryPackStatus.active.value)
        )
        for active_pack in active_res.scalars().all():
            active_pack.status = RegulatoryPackStatus.superseded.value
            logger.info(f"Superseded regulatory pack {active_pack.version!r}")

        pack.status = RegulatoryPackStatus.active.value
        pack.approved_by = user["uid"]
        pack.approved_at = datetime.now(timezone.utc)
        logger.info(f"Approved regulatory pack {pack.version!r} by {user['email']}")
        return _pack_summary(pack)


@router.get("")
async def list_regulatory_packs(
    user: CurrentUser,
) -> list[dict[str, Any]]:
    """List all regulatory packs ordered by creation date (newest first). Any authenticated user."""
    async with get_db_session() as session:
        res = await session.execute(
            select(RegulatoryPack).order_by(RegulatoryPack.created_at.desc())
        )
        packs = res.scalars().all()
        return [_pack_summary(p) for p in packs]


@router.get("/{pack_id}")
async def get_regulatory_pack(
    pack_id: str,
    user: CurrentUser,
) -> dict[str, Any]:
    """Get a single regulatory pack including full payload. Any authenticated user."""
    async with get_db_session() as session:
        res = await session.execute(
            select(RegulatoryPack).where(RegulatoryPack.id == pack_id)
        )
        pack = res.scalar_one_or_none()
        if not pack:
            raise HTTPException(status_code=404, detail="Regulatory pack not found")
        result = _pack_summary(pack)
        result["payload"] = pack.payload
        return result
