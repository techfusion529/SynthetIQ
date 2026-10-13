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
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service
from src.utils.tenant import TenantCtx, get_tenant_ctx
from synthetiq_shared.models import RunInput, WorkflowRun

router = APIRouter(prefix="/runs", tags=["Workflow Runs"])


class CreateRunRequest(BaseModel):
    type: str = "master_e2e_compliance"
    params: dict = {}
logger = logging.getLogger(__name__)


async def _run_preflight_checks(tenant_ctx, org_id: str) -> dict:
    """Run all preflight checks and return {ready, checks}."""
    from sqlalchemy import text, select
    from sqlalchemy.exc import OperationalError
    from synthetiq_shared.database import get_db_session

    checks = []

    # 1. active_regulatory_pack
    try:
        async with get_db_session() as session:
            result = await session.execute(
                text("SELECT 1 FROM regulatory_packs WHERE status = 'active' LIMIT 1")
            )
            found = result.fetchone() is not None
        checks.append({"name": "active_regulatory_pack", "ok": found,
                       "message": "Active regulatory pack found." if found else "No active regulatory pack."})
    except OperationalError:
        checks.append({"name": "active_regulatory_pack", "ok": False,
                       "message": "regulatory_packs table not yet migrated."})
    except Exception as exc:
        checks.append({"name": "active_regulatory_pack", "ok": False, "message": str(exc)})

    # 2. data_source_configured
    try:
        from synthetiq_shared.models import DataSource
        async with get_db_session() as session:
            result = await session.execute(
                select(DataSource).where(DataSource.org_id == org_id).limit(1)
            )
            found = result.scalar_one_or_none() is not None
        checks.append({"name": "data_source_configured", "ok": found,
                       "message": "Data source configured." if found else "No data source configured for this org."})
    except Exception as exc:
        checks.append({"name": "data_source_configured", "ok": False, "message": str(exc)})

    # 3. column_mapping_valid
    try:
        from synthetiq_shared.models import DataSource
        async with get_db_session() as session:
            result = await session.execute(
                select(DataSource).where(
                    DataSource.org_id == org_id,
                    DataSource.mapping.isnot(None)
                ).limit(1)
            )
            found = result.scalar_one_or_none() is not None
        checks.append({"name": "column_mapping_valid", "ok": found,
                       "message": "Column mapping present." if found else "No column mapping configured."})
    except Exception as exc:
        checks.append({"name": "column_mapping_valid", "ok": False, "message": str(exc)})

    # 4. plant_calibration
    try:
        async with get_db_session() as session:
            result = await session.execute(
                text("SELECT 1 FROM plant_calibrations WHERE org_id = :oid LIMIT 1"),
                {"oid": org_id}
            )
            found = result.fetchone() is not None
        checks.append({"name": "plant_calibration", "ok": found,
                       "message": "Plant calibration found." if found else "No plant calibration for this org."})
    except OperationalError:
        checks.append({"name": "plant_calibration", "ok": False,
                       "message": "plant_calibrations table not yet migrated."})
    except Exception as exc:
        checks.append({"name": "plant_calibration", "ok": False, "message": str(exc)})

    # 5. obligation_ledger
    try:
        async with get_db_session() as session:
            result = await session.execute(
                text("SELECT 1 FROM obligation_ledger WHERE org_id = :oid LIMIT 1"),
                {"oid": org_id}
            )
            found = result.fetchone() is not None
        checks.append({"name": "obligation_ledger", "ok": found,
                       "message": "Obligation ledger entry found." if found else "No obligation ledger entry for this org."})
    except OperationalError:
        checks.append({"name": "obligation_ledger", "ok": False,
                       "message": "obligation_ledger table not yet migrated."})
    except Exception as exc:
        checks.append({"name": "obligation_ledger", "ok": False, "message": str(exc)})

    ready = all(c["ok"] for c in checks)
    return {"ready": ready, "checks": checks}


@router.get("/preflight")
async def get_preflight(
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:read")),
) -> dict[str, Any]:
    """Check preconditions before starting a run."""
    org_id = tenant_ctx.org_id or user.get("org_id", "")
    return await _run_preflight_checks(tenant_ctx, org_id)


@router.post("", status_code=202)
async def create_run(
    body: CreateRunRequest,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    """Create a WorkflowRun record, start MasterEPRComplianceWorkflow via Temporal, return 202."""
    org_id_check = tenant_ctx.org_id or user.get("org_id", "")
    preflight = await _run_preflight_checks(tenant_ctx, org_id_check)
    if not preflight["ready"]:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Preflight checks failed", "checks": preflight["checks"]},
        )

    # Build run_id and merge org_id — always from tenant context, never from body
    run_id = f"RUN-{uuid.uuid4().hex[:12].upper()}"
    org_id = tenant_ctx.org_id or user.get("org_id", "")

    params = body.params
    run_input = RunInput(
        org_id=org_id,
        run_id=run_id,
        company_id=params.get("company_id", org_id),
        fiscal_year=params.get("fiscal_year", ""),
        category=params.get("category", ""),
        volume_tons=float(params.get("volume_tons", 0.0)),
        recycler_id=params.get("recycler_id", ""),
        plant_id=params.get("plant_id", ""),
        eway_bill_ref=params.get("eway_bill_ref", ""),
        regulatory_pack_version=params.get("regulatory_pack_version", "default"),
        simulate_spoof=bool(params.get("simulate_spoof", False)),
        schedule_id=params.get("schedule_id"),
        params=params,
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
            await session.commit()
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
    hitl_required: Optional[bool] = Query(None),
) -> list[dict[str, Any]]:
    """Paginated list of WorkflowRun records filtered by tenant org_id."""
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        async with get_db_session() as session:
            query = select(WorkflowRun).order_by(WorkflowRun.started_at.desc())
            if not tenant_ctx.is_platform_admin and tenant_ctx.org_id:
                query = query.where(WorkflowRun.org_id == tenant_ctx.org_id)
            if hitl_required is not None:
                query = query.where(WorkflowRun.hitl_required == hitl_required)
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
        "result": row.result,
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
