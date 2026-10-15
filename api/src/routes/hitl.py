"""Human-in-the-Loop (HITL) Router.

Provides dedicated endpoints for reviewing and resolving HITL exceptions:
  GET  /hitl/exceptions
  GET  /hitl/runs
  GET  /hitl/runs/{run_id}
  POST /hitl/resolve
  POST /hitl/exceptions/{run_id}/resolve
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.routes.audit import HITLResolveRequest, hitl_resolve, list_audit_exceptions
from src.utils.tenant import TenantCtx, get_tenant_ctx
from synthetiq_shared.database import get_db_session
from synthetiq_shared.models import WorkflowRun

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/hitl", tags=["Human-in-the-Loop"])


@router.get("/exceptions")
async def get_hitl_exceptions(
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    """Return all items awaiting human-in-the-loop review."""
    return await list_audit_exceptions(user=user, tenant_ctx=tenant_ctx, limit=limit, offset=offset)


@router.get("/runs")
async def list_hitl_runs(
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    limit: int = Query(50, le=200),
) -> list[dict[str, Any]]:
    """Return workflow runs requiring HITL approval."""
    org_id = tenant_ctx.org_id or user.get("org_id", "")
    async with get_db_session() as session:
        query = select(WorkflowRun).where(WorkflowRun.hitl_required.is_(True))
        if not tenant_ctx.is_platform_admin and org_id:
            query = query.where(WorkflowRun.org_id == org_id)
        query = query.order_by(WorkflowRun.started_at.desc()).limit(limit)
        res = await session.execute(query)
        runs = res.scalars().all()
        return [
            {
                "run_id": r.run_id,
                "workflow_type": r.workflow_type,
                "org_id": r.org_id,
                "status": r.status,
                "hitl_required": r.hitl_required,
                "triggered_by": r.triggered_by,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "input_params": r.input_params or {},
            }
            for r in runs
        ]


@router.get("/runs/{run_id}")
async def get_hitl_run(
    run_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
) -> dict[str, Any]:
    """Get single workflow run detail."""
    org_id = tenant_ctx.org_id or user.get("org_id", "")
    async with get_db_session() as session:
        res = await session.execute(select(WorkflowRun).where(WorkflowRun.run_id == run_id))
        r = res.scalar_one_or_none()
        if not r:
            raise HTTPException(status_code=404, detail=f"WorkflowRun {run_id!r} not found")
        if not tenant_ctx.is_platform_admin and r.org_id != org_id:
            raise HTTPException(status_code=403, detail="Cross-tenant access denied")
        return {
            "run_id": r.run_id,
            "workflow_type": r.workflow_type,
            "org_id": r.org_id,
            "status": r.status,
            "hitl_required": r.hitl_required,
            "triggered_by": r.triggered_by,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "temporal_workflow_id": r.temporal_workflow_id,
            "input_params": r.input_params or {},
        }


@router.post("/resolve")
async def resolve_hitl_exception(
    body: HITLResolveRequest,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
) -> dict[str, Any]:
    """Resolve a pending HITL review with audit log and reason code."""
    return await hitl_resolve(body=body, user=user, tenant_ctx=tenant_ctx)


@router.post("/exceptions/{run_id}/resolve")
async def resolve_hitl_by_id(
    run_id: str,
    body: HITLResolveRequest,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
) -> dict[str, Any]:
    """Resolve a pending HITL review by run_id path parameter."""
    if not body.run_id:
        body.run_id = run_id
    return await hitl_resolve(body=body, user=user, tenant_ctx=tenant_ctx)
