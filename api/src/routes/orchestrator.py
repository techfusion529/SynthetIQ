"""End-to-End Autonomous EPR Compliance & Anti-Fraud Orchestration Pipeline.

RBAC:
  POST /compliance/run-e2e   - workflows:execute (compliance_officer+)
  GET  /compliance/runs      - workflows:read    (viewer+)
  GET  /compliance/runs/{id} - workflows:read    (viewer+)
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service
from src.utils.tenant import TenantCtx, get_tenant_ctx

router = APIRouter(prefix="/compliance", tags=["Autonomous End-to-End Orchestrator"])
logger = logging.getLogger(__name__)


@router.post("/run-e2e")
async def execute_e2e_compliance_run(
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:execute")),
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Deprecated: use POST /api/v1/runs instead."""
    raise HTTPException(
        status_code=410,
        detail="Moved: use POST /api/v1/runs",
    )


@router.get("/runs")
async def list_compliance_runs(
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:read")),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    """Returns list of previous autonomous compliance runs scoped by tenant."""
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import WorkflowRun
        from sqlalchemy import select
        async with get_db_session() as session:
            query = select(WorkflowRun).order_by(WorkflowRun.started_at.desc())
            if not tenant_ctx.is_platform_admin and tenant_ctx.org_id:
                query = query.where(WorkflowRun.org_id == tenant_ctx.org_id)
            query = query.limit(limit).offset(offset)
            res = await session.execute(query)
            db_runs = res.scalars().all()
            return [
                {
                    "run_id": r.run_id,
                    "temporal_workflow_id": r.temporal_workflow_id,
                    "org_id": r.org_id,
                    "status": r.status,
                    "duration_seconds": r.duration_seconds,
                    "triggered_by": r.triggered_by,
                    **(r.result or {}),
                }
                for r in db_runs
            ]
    except Exception as exc:
        logger.warning(f"DB query for runs failed ({exc})")
    return []


@router.get("/runs/{run_id}/steps")
async def get_compliance_run_steps(
    run_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:read")),
) -> list[dict[str, Any]]:
    """Returns the ordered step list for a specific compliance run."""
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import WorkflowRun
        from sqlalchemy import select
        async with get_db_session() as session:
            res = await session.execute(
                select(WorkflowRun).where(WorkflowRun.run_id == run_id)
            )
            run_rec = res.scalar_one_or_none()
            if run_rec and run_rec.result:
                steps = run_rec.result.get("steps", [])
                return sorted(steps, key=lambda s: s.get("step", 0))
    except Exception as exc:
        logger.warning(f"DB lookup for run steps failed ({exc})")
    raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")


@router.get("/runs/{run_id}")
async def get_compliance_run(
    run_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:read")),
) -> dict[str, Any]:
    """Retrieves detailed log and cryptographic hashes of a compliance run."""
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import WorkflowRun
        from sqlalchemy import select
        async with get_db_session() as session:
            res = await session.execute(
                select(WorkflowRun).where(WorkflowRun.run_id == run_id)
            )
            run_rec = res.scalar_one_or_none()
            if run_rec:
                return {
                    "run_id": run_rec.run_id,
                    "temporal_workflow_id": run_rec.temporal_workflow_id,
                    "org_id": run_rec.org_id,
                    "status": run_rec.status,
                    "duration_seconds": run_rec.duration_seconds,
                    "triggered_by": run_rec.triggered_by,
                    **(run_rec.result or {}),
                }
    except Exception as exc:
        logger.warning(f"DB lookup for run failed ({exc})")
    raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
