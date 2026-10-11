from __future__ import annotations
import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service
from src.utils.tenant import TenantCtx, get_tenant_ctx

router = APIRouter(prefix="/settlement", tags=["Workflow 4 - Settlement"])
logger = logging.getLogger(__name__)


async def _get_all_pos(org_id: str | None = None, is_platform_admin: bool = False, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import EscrowPORecord
        async with get_db_session() as session:
            query = select(EscrowPORecord).order_by(EscrowPORecord.created_at.desc())
            if not is_platform_admin and org_id:
                query = query.where(EscrowPORecord.org_id == org_id)
            query = query.limit(limit).offset(offset)
            rows = (await session.execute(query)).scalars().all()
            return [r.to_dict() for r in rows]
    except Exception as exc:
        logger.warning(f"DB PO query failed ({exc})")
    return []

@router.post("/approve")
async def approve_audit_and_settle(
    payload: dict[str, Any], user: CurrentUser,
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    audit_id = payload.get("audit_id")
    if not audit_id:
        raise HTTPException(status_code=400, detail="audit_id required")
    workflow_id = payload.get("workflow_id", f"wf4-settlement-{audit_id}")
    action = payload.get("action", "APPROVE")
    signal_res = await temporal_service.signal_workflow(
        workflow_id=workflow_id,
        signal_name="HumanApprovalSignal",
        signal_args=[{"approver": user["email"], "decision": action}],
    )
    if action == "APPROVE":
        try:
            from synthetiq_shared.database import get_db_session
            from synthetiq_shared.models import EscrowPORecord
            from sqlalchemy import select
            async with get_db_session() as session:
                row = (await session.execute(
                    select(EscrowPORecord).where(EscrowPORecord.audit_id == audit_id)
                )).scalar_one_or_none()
                if row:
                    row.status = "advance_released"
        except Exception as exc:
            logger.warning(f"Could not update PO status ({exc})")
    return {"status": "approved" if action == "APPROVE" else "rejected",
            "audit_id": audit_id, "approved_by": user["email"], "signal_result": signal_res}

@router.get("/pos")
async def list_escrow_pos(
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("audits:read")),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    return await _get_all_pos(
        org_id=tenant_ctx.org_id,
        is_platform_admin=tenant_ctx.is_platform_admin,
        limit=limit,
        offset=offset,
    )

@router.get("/pos/{po_number}")
async def get_escrow_po(
    po_number: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("audits:read")),
) -> dict[str, Any]:
    all_pos = await _get_all_pos(
        org_id=tenant_ctx.org_id,
        is_platform_admin=tenant_ctx.is_platform_admin,
        limit=200,
        offset=0,
    )
    match = next((p for p in all_pos if p.get("po_number") == po_number), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"PO not found: {po_number}")
    return match

@router.post("/form1/dispatch")
async def dispatch_form1_statutory(
    payload: dict[str, Any], user: CurrentUser,
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    """CPCB dispatch integration is not yet available."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="CPCB dispatch not yet integrated",
    )

@router.get("/form1")
async def list_form1_records(
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("audits:read")),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import Form1Record
        async with get_db_session() as session:
            query = select(Form1Record).order_by(Form1Record.created_at.desc())
            if not tenant_ctx.is_platform_admin and tenant_ctx.org_id:
                query = query.where(Form1Record.org_id == tenant_ctx.org_id)
            query = query.limit(limit).offset(offset)
            rows = (await session.execute(query)).scalars().all()
            if rows:
                return [r.to_dict() for r in rows]
    except Exception as exc:
        logger.warning(f"DB form1 query failed ({exc})")
    return []

@router.get("/form1/{form_id}")
async def get_form1(
    form_id: str, user: CurrentUser, _: Any = Depends(require_permission("audits:read"))
) -> dict[str, Any]:
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import Form1Record
        async with get_db_session() as session:
            row = (await session.execute(
                select(Form1Record).where(Form1Record.form_id == form_id)
            )).scalar_one_or_none()
            if row:
                return row.to_dict()
    except Exception:
        pass
    raise HTTPException(status_code=404, detail=f"Form-1 not found: {form_id}")
