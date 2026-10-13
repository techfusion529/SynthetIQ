# Implementation Plan — FEAT-002a: API Layer Cleanup (A1–A6)

> Concrete, file-grounded plan for the coding agent.
> Parent FEAT artifact: `.agents/tasks/phase2-feats/features/FEAT-002.json`
> Depends on FEAT-001 (RunInput Pydantic model and WorkflowRun migration already applied).

---

## Pre-flight: What Already Exists (do not re-create)

| Thing | Location | Status |
|---|---|---|
| `RunInput` Pydantic model | `packages/synthetiq-shared/synthetiq_shared/models/runs.py` | **EXISTS** — fields: `org_id`, `run_id`, `company_id`, `fiscal_year`, `category`, `volume_tons`, `recycler_id`, `plant_id`, `eway_bill_ref`, `regulatory_pack_version`, `simulate_spoof`, `schedule_id`, `params` |
| `WorkflowRun` ORM | `packages/synthetiq-shared/synthetiq_shared/models/organization.py` | **EXISTS** — columns include `run_id`, `workflow_type`, `temporal_workflow_id`, `org_id`, `status`, `result`, `triggered_by`, `started_at`, `input_params`, `hitl_required`, `temporal_run_id` |
| `temporal_service.start_workflow(workflow_name, workflow_id, args, task_queue)` | `api/src/services/temporal_service.py` — class `TemporalGatewayService`, singleton `temporal_service` | **EXISTS** — exact signature: `async def start_workflow(self, workflow_name: str, workflow_id: str, args: list[Any], task_queue: str = "synthetiq-main") -> dict[str, Any]` |
| `temporal_service.get_workflow_description(workflow_id)` | same file | **EXISTS** — `async def get_workflow_description(self, workflow_id: str) -> dict[str, Any]` — returns `{workflow_id, run_id, status, type, start_time, close_time}` or `{workflow_id, error}` |
| `temporal_service.signal_workflow(workflow_id, signal_name, signal_args)` | same file | **EXISTS** — `async def signal_workflow(self, workflow_id: str, signal_name: str, signal_args: list[Any]) -> dict[str, Any]` |
| `TenantCtx`, `get_tenant_ctx` | `api/src/utils/tenant.py` | **EXISTS** — `TenantCtx` has `org_id: str`, `user_id: str`, `role: str`, `is_platform_admin: bool` |
| `get_db_session` | `synthetiq_shared.database` | **EXISTS** — async context manager |
| `STATUTORY_CEILING_INR_PER_KG` constant | **MISSING** — must be added to `packages/synthetiq-shared/synthetiq_shared/constants/__init__.py` |

---

## Task A1 — Create `api/src/routes/runs.py`

### What to do
Create a new route file with four endpoints. This file does not exist yet. All four endpoints require `TenantCtx` via `Depends(get_tenant_ctx)`. No inline computation — all logic is DB + Temporal.

### Imports needed (all new, none carried over from another file)
```python
from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service
from src.utils.tenant import TenantCtx, get_tenant_ctx
from synthetiq_shared.database import get_db_session
from synthetiq_shared.models import RunInput, WorkflowRun
```

### Endpoint specifications

**POST /runs**
- Permission: `workflows:execute`
- Request body: validate as `RunInput` (FastAPI body param, type `RunInput`)
- Logic:
  1. `run_input.org_id = tenant_ctx.org_id`  (always override from token — do not trust client)
  2. `run_id = str(uuid4())`
  3. `run_input.run_id = run_id`
  4. `workflow_id = f"{tenant_ctx.org_id}/{run_input.params.get('type', 'compliance')}/{run_id}"`
  5. Create and `session.add()` a `WorkflowRun` row: `run_id=run_id, workflow_type="master_e2e_compliance", org_id=tenant_ctx.org_id, status="pending", input_params=run_input.model_dump(), triggered_by=user["email"]`
  6. Call `await temporal_service.start_workflow(workflow_name="MasterEPRComplianceWorkflow", workflow_id=workflow_id, args=[run_input.model_dump()], task_queue="synthetiq-main")`
  7. If `temporal_result` has `"error"` key (connection/RPC failure — the service returns `{"workflow_id":..., "status":"DISPATCH_FALLBACK", "error":...}` on exception): delete the WorkflowRun row from DB and `raise HTTPException(status_code=503, detail=f"Temporal unavailable: {temporal_result['error']}")`
  8. On success: update `run.status = "running"`, `run.temporal_run_id = workflow_id` (note: the ORM column is `temporal_run_id`, the Temporal run_id returned by start_workflow is `temporal_result.get("run_id")` — set `run.temporal_workflow_id = workflow_id` and `run.temporal_run_id = temporal_result.get("run_id")`)
  9. Return HTTP 202: `{"run_id": run_id, "workflow_id": workflow_id, "status": "running"}`

**GET /runs**
- Permission: `workflows:read`
- Query params: `limit: int = Query(50, le=200)`, `offset: int = Query(0, ge=0)`
- Logic: `select(WorkflowRun).where(WorkflowRun.org_id == tenant_ctx.org_id).order_by(WorkflowRun.started_at.desc()).limit(limit).offset(offset)` — if `tenant_ctx.is_platform_admin` skip the org filter
- Return: list of dicts with fields: `run_id`, `workflow_type`, `temporal_workflow_id`, `org_id`, `status`, `triggered_by`, `started_at` (isoformat), `duration_seconds`, `hitl_required`
- Wrap in try/except; on DB error return `[]` with a logger.warning

**GET /runs/{run_id}**
- Permission: `workflows:read`
- Logic:
  1. Fetch `WorkflowRun` where `run_id == run_id AND org_id == tenant_ctx.org_id` (skip org filter if platform_admin); raise `HTTPException(404)` if missing
  2. `try: td = await temporal_service.get_workflow_description(run.temporal_workflow_id or run.temporal_run_id)` — swallow all exceptions (catch `Exception`)
  3. If `td` has no `"error"` key and `td.get("status")` in `{"COMPLETED", "FAILED"}`: update `run.status = td["status"].lower()` and commit
  4. Return: all WorkflowRun fields + `temporal_status: td.get("status")` merged in

**DELETE /runs/{run_id}**
- Permission: `workflows:execute`
- Logic:
  1. Fetch `WorkflowRun` by `run_id AND org_id == tenant_ctx.org_id`; raise `HTTPException(404)` if missing
  2. Try `await temporal_service.signal_workflow(run.temporal_workflow_id, "cancel", [])` — swallow all exceptions (the service already catches internally, but add outer try/except too)
  3. `run.status = "cancelled"`; commit
  4. Return `{"run_id": run_id, "status": "cancelled"}`

### Router declaration
```python
router = APIRouter(prefix="/runs", tags=["Workflow Runs"])
```

### Files to create/modify
- **Create**: `api/src/routes/runs.py`

### Verify
```
cd api && python -c "from src.routes.runs import router; print('ok')"
```
Expected: `ok` with no ImportError.

---

## Task A2 — Register runs router in `main.py` and remove APScheduler seed

### What to do
Two changes in two files.

**Change 1 — `api/src/routes/__init__.py`**

Current exports do not include `runs_router`. Add it:
- Add line: `from .runs import router as runs_router`
- Add `"runs_router"` to `__all__`

**Change 2 — `api/src/main.py`**

*Add runs router:*
- In the import block at the top of the file, add `runs_router` alongside the existing import from `src.routes`:
  ```python
  from src.routes import (
      ...
      runs_router,   # add this
      ...
  )
  ```
- After `app.include_router(agent_config_router, prefix=API_V1_STR)`, add:
  ```python
  app.include_router(runs_router, prefix=API_V1_STR)
  ```

*Remove APScheduler startup/shutdown:*

In `lifespan`, remove the entire block that starts with `# 3. APScheduler`. Specifically remove:
```python
    # 3. APScheduler - start the per-org schedule engine
    try:
        from src.services.scheduler_service import get_scheduler_service
        scheduler = get_scheduler_service()
        scheduler.start()
        logger.info("[Scheduler] APScheduler started")
        # Seed a default daily compliance run for the dev organisation
        scheduler.add_schedule(
            org_id="ORG-DEV-001",
            workflow_type="master_e2e",
            cron_expression="0 2 * * *",
            name="Daily E2E compliance (dev org)",
            workflow_params={
                "company_id": "COMP-IN-001",
                "volume_tons": 250,
                "category": "cat_i_rigid",
            },
        )
    except Exception as exc:
        logger.warning(f"Scheduler start skipped ({type(exc).__name__}: {exc})")
```

Also remove the shutdown block:
```python
    try:
        from src.services.scheduler_service import get_scheduler_service
        get_scheduler_service().shutdown(wait=False)
    except Exception:
        pass
```

Keep the DB init and Firebase init blocks intact.

### Files to modify
- `api/src/routes/__init__.py`
- `api/src/main.py`

### Verify
```
cd api && python -c "from src.main import app; paths=[r.path for r in app.routes]; print([p for p in paths if 'runs' in p])"
```
Expected: output includes `/api/v1/runs` paths.

---

## Task A3 — Deprecate `orchestrator.py` POST /compliance/run-e2e

### What to do
Replace the entire body of `execute_e2e_compliance_run` with a single 410 response. Keep the GET endpoints (`list_compliance_runs`, `get_compliance_run_steps`, `get_compliance_run`) **completely untouched**.

**Exact replacement for the function body:**

Replace everything inside `async def execute_e2e_compliance_run(...)` after the docstring, i.e. all lines from `config = get_runtime_config()` down to `return final_result` at end of function, with:
```python
    raise HTTPException(
        status_code=410,
        detail="Moved: use POST /api/v1/runs",
    )
```

**Remove now-unused imports** (only remove these — do not touch imports used by GET handlers):
- `import hashlib` — used only in the POST body (GET handlers do not use it) → **remove**
- `import time` — used only in the POST body → **remove**
- `import httpx` — used only in the POST body → **remove**
- `from src.constants import MCP_URL, MOCKS_URL, SIMULATOR_URL` — used only in POST body → **remove**
- `from src.routes.config import get_runtime_config` — used only in POST body → **remove**
- `from src.routes.stream import push_event` — used only in POST body → **remove**

**Keep these imports** (they are used by the GET handlers):
- `from __future__ import annotations`
- `import logging`
- `import uuid` (used in the POST for `run_id` generation — but since the body is now just `raise`, this can also be removed; be safe and check: GET handlers don't use `uuid` directly, so remove it)
- Actually `uuid` is only used in the old POST body → **remove**
- `from typing import Any`
- `from fastapi import APIRouter, Depends, HTTPException, Query`
- `from src.middleware.auth import CurrentUser`
- `from src.middleware.rbac import require_permission`
- `from src.services.temporal_service import temporal_service` (GET handlers do not use it, but leave it for now to avoid breaking anything)
- `from src.utils.tenant import TenantCtx, get_tenant_ctx`

The literals to confirm are gone after this change (do not verify by grep — verify by import):
- `volume_tons * 4.5`
- `clearing_price = 7.80`
- `awarded_recycler = 'RECYC-DELHI-01'`
- `'PLANT-OKHLA-2'`
- `'CPCB_ACCEPTED'`
- `httpx` calls
- All `step1`, `step2`, `step3`, `step4`, `step5` stage dicts

### Files to modify
- `api/src/routes/orchestrator.py`

### Verify
```
cd api && python -c "from src.routes.orchestrator import router; print('ok')"
```
Expected: `ok` with no ImportError.

---

## Task A4 — Slim down `audit.py` POST /audit/trigger

### What to do
Replace the body of `trigger_fraud_audit` with a thin Temporal dispatch. Keep **all other functions** (`get_live_scada_stream`, `list_audit_verdicts`, `get_audit_verdict`, `list_audit_exceptions`, `resolve_audit_exception`, `download_audit_report_pdf`, `get_audit_report_json`) completely untouched.

**New body for `trigger_fraud_audit`:**

```python
@router.post("/trigger")
async def trigger_fraud_audit(
    payload: dict[str, Any],
    user: CurrentUser,
    _: Any = Depends(require_permission("audits:write")),
) -> dict[str, Any]:
    recycler_id: str = payload.get("recycler_id", "")
    if not recycler_id:
        raise HTTPException(status_code=400, detail="recycler_id required")
    plant_id: str = payload.get("plant_id", "")
    if not plant_id:
        raise HTTPException(status_code=400, detail="plant_id required")

    category: str = payload.get("category", "cat_i_rigid")
    volume_tons: float = float(payload.get("volume_tons", 250.0))
    simulate_spoof: bool = bool(payload.get("simulate_spoof", False))

    audit_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
    workflow_id = f"wf3-audit-{audit_id}"

    await temporal_service.start_workflow(
        workflow_name="QuadCoreAuditWorkflow",
        workflow_id=workflow_id,
        args=[
            recycler_id,
            plant_id,
            volume_tons,
            category,
            simulate_spoof,
        ],
        task_queue="synthetiq-main",
    )
    return {
        "audit_id": audit_id,
        "status": "RUNNING",
        "workflow_id": workflow_id,
    }
```

**Imports to remove** (only from the ones currently at the top of audit.py that are no longer needed by `trigger_fraud_audit` after this change):
- `import hashlib` — was used only in the old trigger body (the GET handler `download_audit_report_pdf` does not use `hashlib` directly — confirm before removing)
- `import time` — was used only in the old trigger body; check `get_live_scada_stream` — it uses `time.time()` in its fallback data → **keep `import time`**
- `import httpx` — used by `get_live_scada_stream` → **keep `import httpx`**
- `from src.routes.config import get_runtime_config` — used by `get_live_scada_stream` and SCADA live endpoint → **keep**

So the only import to remove is `import hashlib` (check: only used in old trigger body for `audit_hash = hashlib.sha256(...)` which is deleted). **Remove `import hashlib`**.

**Literals confirmed removed** after this change:
- `sec_constants = {"cat_i_rigid": 0.45, ...}` — gone
- `kw`, `pf`, `torque` inline physics vars — gone
- `delta_mass` calculation — gone
- `flags` list construction — gone
- Inline `verdict` determination — gone
- `confidence` calculation — gone
- `"RECYC-DELHI-01"` default for `recycler_id` — gone (now raises 400)
- `"PLANT-OKHLA-2"` default for `plant_id` — gone (now raises 400)
- `simulate_spoof` as `bool(payload.get("simulate_spoof", False))` — kept as an explicit optional field read from payload (this is correct per the spec: "keep as explicit optional field")

### Files to modify
- `api/src/routes/audit.py`

### Verify
```
cd api && python -c "from src.routes.audit import router; print('ok')"
```
Expected: `ok` with no ImportError.

---

## Task A5 — Add `STATUTORY_CEILING_INR_PER_KG` to `agent_config.py`

### What to do
Two sub-changes.

**Sub-change 1 — Add constant to `synthetiq_shared/constants/__init__.py`**

The existing constants file already has `COMPENSATION_CORRIDOR_MIN_PCT = 0.30` and `COMPENSATION_CORRIDOR_MAX_PCT = 1.00`. There is **no** `STATUTORY_CEILING_INR_PER_KG` constant. Add it after the `DEBT_AMORTIZATION_FRACTION` line:
```python
# --- Statutory Rate Ceiling (INR/kg) ---
STATUTORY_CEILING_INR_PER_KG: float = 12.0
```

**Sub-change 2 — Use the constant in `agent_config.py`**

In the `treasury` branch of `test_agent_with_dynamic_data`, the current code is:
```python
base_rate = float(agent_cfg.parameters.get("statutory_base_rate_inr", 12.0))
```

Replace `12.0` with `STATUTORY_CEILING_INR_PER_KG`. To do this:

1. Add import at the top of `api/src/routes/agent_config.py` (after the existing `from synthetiq_shared.database import get_db_session` line):
   ```python
   from synthetiq_shared.constants import STATUTORY_CEILING_INR_PER_KG
   ```

2. In the `treasury` branch, change:
   ```python
   base_rate = float(agent_cfg.parameters.get("statutory_base_rate_inr", 12.0))
   ```
   to:
   ```python
   base_rate = float(agent_cfg.parameters.get("statutory_base_rate_inr", STATUTORY_CEILING_INR_PER_KG))
   ```

**`DISPATCH_FALLBACK` check**: `agent_config.py` does not contain the string `DISPATCH_FALLBACK` — no action needed here for that literal. (It lives in `temporal_service.py`.)

### Files to modify
- `packages/synthetiq-shared/synthetiq_shared/constants/__init__.py`
- `api/src/routes/agent_config.py`

### Verify
```
cd api && python -c "from src.routes.agent_config import router; print('ok')"
python -c "from synthetiq_shared.constants import STATUTORY_CEILING_INR_PER_KG; print(STATUTORY_CEILING_INR_PER_KG)"
```
Expected: `ok` then `12.0`.

---

## Task A6 — Wire `settlement.py` POST /approve to WorkflowRun via `run_id`

### What to do
Update `approve_audit_and_settle` to look up `WorkflowRun` by `run_id`, derive `temporal_workflow_id` from the DB row, signal Temporal using it, and clear `hitl_required`.

**Current function signature** (keep unchanged):
```python
@router.post("/approve")
async def approve_audit_and_settle(
    payload: dict[str, Any], user: CurrentUser,
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
```

**Add `TenantCtx` parameter** — the function currently does not accept `TenantCtx`. Add it:
```python
@router.post("/approve")
async def approve_audit_and_settle(
    payload: dict[str, Any],
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
```

`TenantCtx` and `get_tenant_ctx` are already imported in `settlement.py` (`from src.utils.tenant import TenantCtx, get_tenant_ctx`).

**New function body:**
```python
    run_id: str | None = payload.get("run_id")
    audit_id: str | None = payload.get("audit_id")

    if not run_id:
        raise HTTPException(status_code=400, detail="run_id required")

    # Look up WorkflowRun to get the actual Temporal workflow_id
    temporal_workflow_id: str | None = None
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import WorkflowRun
        from sqlalchemy import select
        async with get_db_session() as session:
            query = select(WorkflowRun).where(WorkflowRun.run_id == run_id)
            if not tenant_ctx.is_platform_admin:
                query = query.where(WorkflowRun.org_id == tenant_ctx.org_id)
            run_rec = (await session.execute(query)).scalar_one_or_none()
            if not run_rec:
                raise HTTPException(status_code=404, detail=f"WorkflowRun {run_id!r} not found")
            temporal_workflow_id = run_rec.temporal_workflow_id or run_rec.temporal_run_id
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"DB lookup for run {run_id} failed: {exc}")
        raise HTTPException(status_code=503, detail="DB unavailable")

    if not temporal_workflow_id:
        raise HTTPException(status_code=422, detail="WorkflowRun has no associated Temporal workflow_id")

    action: str = payload.get("action", "APPROVE")

    # Signal Temporal workflow with human approval
    signal_res = await temporal_service.signal_workflow(
        workflow_id=temporal_workflow_id,
        signal_name="human_approval",
        signal_args=[{
            "approved": action == "APPROVE",
            "approver": user["email"],
            "decision": action,
            "notes": payload.get("notes", ""),
            "audit_id": audit_id,
        }],
    )

    # On APPROVE: clear hitl_required flag and update PO status
    if action == "APPROVE":
        try:
            from synthetiq_shared.database import get_db_session
            from synthetiq_shared.models import WorkflowRun, EscrowPORecord
            from sqlalchemy import select
            async with get_db_session() as session:
                # Clear hitl_required
                run_rec2 = (await session.execute(
                    select(WorkflowRun).where(WorkflowRun.run_id == run_id)
                )).scalar_one_or_none()
                if run_rec2:
                    run_rec2.hitl_required = False
                # Update PO status if audit_id provided
                if audit_id:
                    po = (await session.execute(
                        select(EscrowPORecord).where(EscrowPORecord.audit_id == audit_id)
                    )).scalar_one_or_none()
                    if po:
                        po.status = "advance_released"
        except Exception as exc:
            logger.warning(f"Could not update WorkflowRun/PO on approval ({exc})")

    return {
        "status": "approved" if action == "APPROVE" else "rejected",
        "run_id": run_id,
        "audit_id": audit_id,
        "temporal_workflow_id": temporal_workflow_id,
        "approved_by": user["email"],
        "signal_result": signal_res,
    }
```

**What is removed:**
- `workflow_id = payload.get("workflow_id", f"wf4-settlement-{audit_id}")` — the old guessed fallback is gone
- The old `if not audit_id: raise HTTPException(400)` guard (replaced by `run_id` required check; `audit_id` remains optional for PO lookup)

**Imports already present in `settlement.py`** (no new top-level imports needed — `TenantCtx`, `get_tenant_ctx`, `temporal_service` are already imported at the top):
```python
from src.utils.tenant import TenantCtx, get_tenant_ctx   # already present ✓
from src.services.temporal_service import temporal_service # already present ✓
```
The `get_db_session`, `WorkflowRun`, `EscrowPORecord`, `select` imports are done inline inside the function (matching the existing pattern in the rest of `settlement.py`).

### Files to modify
- `api/src/routes/settlement.py`

### Verify
```
cd api && python -c "from src.routes.settlement import router; print('ok')"
```
Expected: `ok` with no ImportError.

---

## Dependency Order

```
A5 (constants + agent_config)  — independent, do first (no deps)
A1 (create runs.py)            — depends on FEAT-001 RunInput/WorkflowRun (already done)
A2 (register in main.py)       — depends on A1
A3 (orchestrator 410)          — depends on A2 (new /runs must be live before retiring old endpoint)
A4 (audit slim)                — independent of A1-A3 (only temporal_service already exists)
A6 (settlement run_id)         — independent of A1-A3 (only WorkflowRun DB, already in FEAT-001)
```

**Recommended execution order:** A5 → A1 → A2 → A3 → A4 → A6

---

## Final Verification Sequence

Run all six checks after completing all tasks:

```bash
# 1. Constants importable
python -c "from synthetiq_shared.constants import STATUTORY_CEILING_INR_PER_KG; assert STATUTORY_CEILING_INR_PER_KG == 12.0; print('A5-constants ok')"

# 2. All route modules import cleanly (run from api/)
cd api
python -c "from src.routes.runs import router; print('A1 ok')"
python -c "from src.routes.orchestrator import router; print('A3 ok')"
python -c "from src.routes.audit import router; print('A4 ok')"
python -c "from src.routes.agent_config import router; print('A5-route ok')"
python -c "from src.routes.settlement import router; print('A6 ok')"

# 3. App boots and /runs is registered
python -c "from src.main import app; paths=[r.path for r in app.routes]; assert any('/api/v1/runs' in p for p in paths), paths; print('A2 ok:', [p for p in paths if 'runs' in p])"

# 4. APScheduler seed literals gone from main.py
python -c "import pathlib; src=pathlib.Path('src/main.py').read_text(); assert 'ORG-DEV-001' not in src and 'COMP-IN-001' not in src; print('A2-scheduler ok')"

# 5. Old inline literals gone from orchestrator
python -c "import pathlib; src=pathlib.Path('src/routes/orchestrator.py').read_text(); assert 'clearing_price = 7.80' not in src and 'RECYC-DELHI-01' not in src; print('A3-literals ok')"

# 6. RECYC-DELHI-01 default gone from audit trigger
python -c "import pathlib; src=pathlib.Path('src/routes/audit.py').read_text(); assert src.count('RECYC-DELHI-01') == 0; print('A4-literals ok')"
```
