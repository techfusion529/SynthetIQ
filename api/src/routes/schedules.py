"""Schedule management API — Temporal-backed cron schedule CRUD.

RBAC:
  GET    /schedules   - schedules:read   (compliance_officer+)
  POST   /schedules   - schedules:write  (admin only)
  DELETE /schedules/{id} - schedules:delete (admin only)
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.middleware.rbac import require_permission
from src.utils.tenant import TenantCtx, get_tenant_ctx

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/schedules", tags=["Schedules"])


# ---------------------------------------------------------------------------
# Service accessor
# ---------------------------------------------------------------------------

def get_schedule_svc(request: Request):
    """Read TemporalScheduleService from app.state; raise 503 if not ready."""
    svc = getattr(request.app.state, "schedule_svc", None)
    if svc is None:
        raise HTTPException(503, "Schedule service unavailable")
    return svc


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class CreateScheduleBody(BaseModel):
    cron: str
    workflow_type: str
    params: dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/")
async def create_schedule(
    body: CreateScheduleBody,
    request: Request,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("schedules:write")),
) -> dict[str, Any]:
    """Create a Temporal Schedule that fires MasterEPRComplianceWorkflow on a cron."""
    svc = get_schedule_svc(request)
    schedule_id = str(uuid.uuid4())
    temporal_id = await svc.create_schedule(
        tenant_ctx.org_id,
        schedule_id,
        body.cron,
        body.workflow_type,
        body.params,
    )
    return {
        "schedule_id": schedule_id,
        "temporal_schedule_id": temporal_id,
        "status": "created",
    }


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    request: Request,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("schedules:delete")),
) -> dict[str, Any]:
    """Delete an existing Temporal Schedule by ID."""
    svc = get_schedule_svc(request)
    try:
        await svc.delete_schedule(tenant_ctx.org_id, schedule_id)
    except Exception as exc:
        # Temporal raises RPCError / not-found errors; treat them as 404
        raise HTTPException(
            status_code=404,
            detail=f"Schedule {schedule_id!r} not found or could not be deleted: {exc}",
        )
    return {"schedule_id": schedule_id, "status": "deleted"}


@router.get("/")
async def list_schedules(
    request: Request,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("schedules:read")),
) -> list[dict[str, Any]]:
    """List all Temporal Schedules for the caller's organisation."""
    svc = get_schedule_svc(request)
    return await svc.list_schedules(tenant_ctx.org_id)
