"""Unified workflow run management endpoint.

RBAC:
  POST   /runs           - workflows:execute (compliance_officer+)
  GET    /runs           - workflows:read    (viewer+)
  GET    /runs/{run_id}  - workflows:read    (viewer+)
  DELETE /runs/{run_id}  - workflows:execute (compliance_officer+)
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service
from src.utils.tenant import TenantCtx, get_tenant_ctx
from synthetiq_shared.models import RunInput, WorkflowRun

router = APIRouter(prefix="/runs", tags=["Workflow Runs"])
logger = logging.getLogger(__name__)


@router.post("", status_code=202)
async def create_run(
    payload: dict[str, Any],
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    """Create a WorkflowRun record, start MasterEPRComplianceWorkflow via Temporal, return 202."""
    # Build run_id and merge org_id
    run_id = f"RUN-{uuid.uuid4().hex[:12].upper()}"
    org_id = tenant_ctx.org_id or user.get("org_id", "")

    run_input = RunInput(
        org_id=org_id,
        run_id=run_id,
        company_id=payload.get("company_id", org_id),
        fiscal_year=payload.get("fiscal_year", ""),
        category=payload.get("category", ""),
        volume_tons=float(payload.get("volume_tons", 0.0)),
        recycler_id=payload.get("recycler_id", ""),
        plant_id=payload.get("plant_id", ""),
        eway_bill_ref=payload.get("eway_bill_ref", ""),
        regulatory_pack_version=payload.get("regulatory_pack_version", "default"),
        simulate_spoof=bool(payload.get("simulate_spoof", False)),
        schedule_id=payload.get("schedule_id"),
        params=payload.get("params", {}),
    )

    workflow_type = "master_e2e_compliance"
    temporal_workflow_id = f"{org_id}/{workflow_type}/{run_id}"

    # Persist WorkflowRun with RUNNING status before dispatching
    try:
        from synthetiq_shared.database import get_db_session
        async with get_db_session() as session:
            wf_run = WorkflowRun(
                run_id=run_id,
                workflow_type=workflow_type,
                temporal_workflow_id=temporal_workflow_id,
                org_id=org_id,
                status="RUNNING",
                triggered_by=user.get("email", "api"),
                started_at=datetime.now(timezone.utc),
                input_params=run_input.model_dump(),
                hitl_required=False,
            )
            session.add(wf_run)
    except Exception as exc:
        logger.warning(f"Could not persist WorkflowRun pre-dispatch ({exc})")

    # Dispatch to Temporal
    dispatch_result = await temporal_service.start_workflow(
        workflow_name="MasterEPRComplianceWorkflow",
        workflow_id=temporal_workflow_id,
        args=[run_input.model_dump()],
        task_queue="synthetiq-main",
    )

    # If Temporal is unreachable, clean up the DB record and return 503
    if dispatch_result.get("status") == "DISPATCH_FALLBACK":
        try:
            from sqlalchemy import select, delete as sa_delete
            from synthetiq_shared.database import get_db_session
            async with get_db_session() as session:
                await session.execute(
                    sa_delete(WorkflowRun).where(WorkflowRun.run_id == run_id)
                )
        except Exception as exc:
            logger.warning(f"Could not delete WorkflowRun after dispatch failure ({exc})")
        raise HTTPException(
            status_code=503,
            detail=f"Temporal unavailable: {dispatch_result.get('error', 'unknown')}",
        )

    # Store temporal_run_id on the record
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        async with get_db_session() as session:
            from sqlalchemy import select as sa_select
            result = await session.execute(
                sa_select(WorkflowRun).where(WorkflowRun.run_id == run_id)
            )
            wf_run = result.scalar_one_or_none()
            if wf_run:
                wf_run.temporal_run_id = dispatch_result.get("run_id")
    except Exception as exc:
        logger.warning(f"Could not update temporal_run_id ({exc})")

    return {
        "run_id": run_id,
        "temporal_workflow_id": temporal_workflow_id,
        "temporal_run_id": dispatch_result.get("run_id"),
        "temporal_ui_url": dispatch_result.get("temporal_ui_url"),
        "status": "RUNNING",
        "org_id": org_id,
    }


@router.get("")
async def list_runs(
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:read")),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    """Paginated list of WorkflowRun records filtered by tenant org_id."""
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        async with get_db_session() as session:
            query = select(WorkflowRun).order_by(WorkflowRun.started_at.desc())
            if not tenant_ctx.is_platform_admin and tenant_ctx.org_id:
                query = query.where(WorkflowRun.org_id == tenant_ctx.org_id)
            query = query.limit(limit).offset(offset)
            rows = (await session.execute(query)).scalars().all()
            return [
                {
                    "run_id": r.run_id,
                    "workflow_type": r.workflow_type,
                    "temporal_workflow_id": r.temporal_workflow_id,
                    "temporal_run_id": r.temporal_run_id,
                    "org_id": r.org_id,
                    "status": r.status,
                    "hitl_required": r.hitl_required,
                    "triggered_by": r.triggered_by,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "duration_seconds": r.duration_seconds,
                }
                for r in rows
            ]
    except Exception as exc:
        logger.warning(f"DB query for runs failed ({exc})")
    return []


@router.get("/{run_id}")
async def get_run(
    run_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:read")),
) -> dict[str, Any]:
    """Fetch WorkflowRun from DB and merge live Temporal status."""
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        async with get_db_session() as session:
            query = select(WorkflowRun).where(WorkflowRun.run_id == run_id)
            if not tenant_ctx.is_platform_admin and tenant_ctx.org_id:
                query = query.where(WorkflowRun.org_id == tenant_ctx.org_id)
            row = (await session.execute(query)).scalar_one_or_none()
    except Exception as exc:
        logger.warning(f"DB lookup failed ({exc})")
        row = None

    if not row:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")

    result: dict[str, Any] = {
        "run_id": row.run_id,
        "workflow_type": row.workflow_type,
        "temporal_workflow_id": row.temporal_workflow_id,
        "temporal_run_id": row.temporal_run_id,
        "org_id": row.org_id,
        "status": row.status,
        "hitl_required": row.hitl_required,
        "input_params": row.input_params,
        "triggered_by": row.triggered_by,
        "started_at": row.started_at.isoformat() if row.started_at else None,
        "completed_at": row.completed_at.isoformat() if row.completed_at else None,
        "duration_seconds": row.duration_seconds,
        "error_message": row.error_message,
    }

    # Merge live Temporal status (best-effort)
    if row.temporal_workflow_id:
        temporal_desc = await temporal_service.get_workflow_description(row.temporal_workflow_id)
        if "error" not in temporal_desc:
            result["temporal_status"] = temporal_desc.get("status")
            result["temporal_start_time"] = temporal_desc.get("start_time")
            result["temporal_close_time"] = temporal_desc.get("close_time")

    return result


@router.delete("/{run_id}")
async def cancel_run(
    run_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    """Cancel a running workflow and set its status to CANCELLED."""
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        async with get_db_session() as session:
            query = select(WorkflowRun).where(WorkflowRun.run_id == run_id)
            if not tenant_ctx.is_platform_admin and tenant_ctx.org_id:
                query = query.where(WorkflowRun.org_id == tenant_ctx.org_id)
            row = (await session.execute(query)).scalar_one_or_none()
            if not row:
                raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")

            temporal_workflow_id = row.temporal_workflow_id

            # Cancel in Temporal
            cancel_result: dict[str, Any] = {}
            if temporal_workflow_id:
                try:
                    client = await temporal_service.get_client()
                    handle = client.get_workflow_handle(temporal_workflow_id)
                    await handle.cancel()
                    cancel_result = {"cancelled": True}
                except Exception as exc:
                    logger.warning(f"Temporal cancel failed ({exc})")
                    cancel_result = {"cancelled": False, "error": str(exc)}

            row.status = "CANCELLED"
            row.completed_at = datetime.now(timezone.utc)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"Cancel run failed ({exc})")
        raise HTTPException(status_code=500, detail=f"Failed to cancel run: {exc}")

    return {
        "run_id": run_id,
        "status": "CANCELLED",
        "cancelled_by": user.get("email", ""),
        "temporal_cancel": cancel_result,
    }
