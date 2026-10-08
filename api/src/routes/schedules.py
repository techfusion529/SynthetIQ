"""Schedule management API  -  CRUD for per-org APScheduler cron jobs.

RBAC:
  GET  /schedules/               - ' schedules:read   (compliance_officer+)
  POST /schedules/               - ' schedules:write  (admin only)
  GET  /schedules/{id}           - ' schedules:read   (compliance_officer+)
  POST /schedules/{id}/pause     - ' schedules:write  (admin only)
  POST /schedules/{id}/resume    - ' schedules:write  (admin only)
  DELETE /schedules/{id}         - ' schedules:delete (admin only)
  GET  /schedules/jobs           - ' schedules:read   (compliance_officer+)
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/schedules", tags=["Schedules"])


# ---------------------------------------------------------------------------
# Lazy import helper  -  scheduler lives in the worker process; the API uses
# an HTTP shim in production.  For local dev / single-process mode the
# scheduler_service is imported directly.
# ---------------------------------------------------------------------------

def _get_scheduler():  # type: ignore[return]
    """Lazy-import the global SchedulerService."""
    try:
        from src.services.scheduler_service import get_scheduler_service
        return get_scheduler_service()
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Scheduler service is not available in this deployment",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/")
async def list_schedules(
    user: CurrentUser,
    _: Any = Depends(require_permission("schedules:read")),
    org_id: str | None = None,
) -> list[dict[str, Any]]:
    """List all schedules, optionally filtered to a single organisation."""
    svc = _get_scheduler()
    # Non-admins can only see their own org's schedules
    effective_org = org_id
    if user.get("role") != "admin":
        effective_org = user.get("org_id")
    return svc.list_schedules(org_id=effective_org)


@router.post("/")
async def create_schedule(
    payload: dict[str, Any],
    user: CurrentUser,
    _: Any = Depends(require_permission("schedules:write")),
) -> dict[str, Any]:
    """Create a new cron schedule for an organisation.

    Example payload:
    ```json
    {
        "org_id": "ORG-ABC-01",
        "workflow_type": "master_e2e",
        "cron_expression": "0 2 * * *",
        "name": "Daily EPR audit",
        "workflow_params": {
            "company_id": "COMP-IN-001",
            "volume_tons": 250,
            "category": "cat_i_rigid"
        }
    }
    ```
    """
    org_id = payload.get("org_id") or user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="org_id is required")

    workflow_type = payload.get("workflow_type")
    if not workflow_type:
        raise HTTPException(status_code=400, detail="workflow_type is required")

    cron_expression = payload.get("cron_expression")
    if not cron_expression:
        raise HTTPException(status_code=400, detail="cron_expression is required")

    svc = _get_scheduler()
    try:
        record = svc.add_schedule(
            org_id=org_id,
            workflow_type=workflow_type,
            cron_expression=cron_expression,
            workflow_params=payload.get("workflow_params", {}),
            name=payload.get("name"),
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid schedule: {exc}")

    record["created_by"] = user["email"]
    return record


@router.get("/jobs")
async def list_scheduler_jobs(
    user: CurrentUser,
    _: Any = Depends(require_permission("schedules:read")),
) -> list[dict[str, Any]]:
    """Return raw APScheduler job metadata for diagnostics."""
    svc = _get_scheduler()
    return svc.list_all_jobs()


@router.get("/{schedule_id}")
async def get_schedule(
    schedule_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("schedules:read")),
) -> dict[str, Any]:
    """Retrieve a single schedule by ID."""
    svc = _get_scheduler()
    record = svc.get_schedule(schedule_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Schedule {schedule_id!r} not found")

    # Non-admins can only read schedules belonging to their org
    if user.get("role") != "admin" and record.get("org_id") != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied  -  wrong organisation")

    return record


@router.post("/{schedule_id}/pause")
async def pause_schedule(
    schedule_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("schedules:write")),
) -> dict[str, Any]:
    """Pause a scheduled job without removing it."""
    svc = _get_scheduler()
    success = svc.pause_schedule(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Schedule {schedule_id!r} not found")
    return {"schedule_id": schedule_id, "status": "paused", "paused_by": user["email"]}


@router.post("/{schedule_id}/resume")
async def resume_schedule(
    schedule_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("schedules:write")),
) -> dict[str, Any]:
    """Resume a paused scheduled job."""
    svc = _get_scheduler()
    success = svc.resume_schedule(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Schedule {schedule_id!r} not found")
    record = svc.get_schedule(schedule_id) or {}
    return {
        "schedule_id": schedule_id,
        "status": "resumed",
        "next_run_at": record.get("next_run_at"),
        "resumed_by": user["email"],
    }


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("schedules:delete")),
) -> dict[str, Any]:
    """Permanently remove a schedule."""
    svc = _get_scheduler()
    success = svc.remove_schedule(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Schedule {schedule_id!r} not found")
    return {"schedule_id": schedule_id, "status": "deleted", "deleted_by": user["email"]}
