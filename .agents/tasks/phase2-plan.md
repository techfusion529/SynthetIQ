# Phase 2 Implementation Plan — Temporal-First Execution Model

> Authoritative plan. FEAT artifacts live under `.agents/tasks/phase2-feats/`.
> The workflow has been restructured into 4 per-FEAT coder steps plus a convergence loop.

---

## Summary of Decisions

- **New unified `/runs` router** replaces `orchestrator.py`'s `/compliance/run-e2e` so the API only starts Temporal — no inline computation. The existing `/compliance/runs` list/get endpoints are kept as thin DB reads and consolidated into the new runs router.
- **`RunInput` Pydantic model** lives in `synthetiq_shared/models/runs.py` and is the single type passed to `MasterEPRComplianceWorkflow`. All five hardcoded positional args become named fields, and `org_id` is added so the worker can scope DB writes correctly.
- **Alembic migration** adds `input_params JSONB` and `hitl_required BOOL` to `workflow_runs`; the table already exists (created in Phase 1 initial migration) and `WorkflowRun` ORM is in `organization.py` — the migration extends it.
- **`HumanApprovalSignal` dataclass** is standardized in `worker/src/flows/workflows.py` replacing the ad-hoc `AuditDecisionInput`. The settlement `POST /approve` endpoint is wired to send this signal to the workflow identified by `run_id`.
- **Fail-closed gates**: every `or 0.0`, `or True`, `or PASS`/`"CPCB_ACCEPTED"` default in activities is replaced with an explicit `raise ApplicationError` so the workflow retries rather than silently passing bad data.
- **APScheduler removed** from both `api/src/services/scheduler_service.py` and `api/src/main.py`; schedules CRUD routes (`schedules.py`) are re-implemented to call `temporalio.client.Client.create_schedule`.
- **GET /runs/{run_id}** merges `WorkflowRun` DB row with a `temporal_service.get_workflow_description()` call to add live Temporal status.
- **Dashboard changes** are minimal: `compliance.service.ts` already calls `POST /api/v1/compliance/run-e2e`; the new router exposes `POST /api/v1/runs`, so update the service URL and type; `audit/page.tsx` default input values for recycler_id/plant_id need blanked (no hardcoded RECYC-DELHI-01).

---

## Implementation Plan

- [ ] 1. **Create `RunInput` Pydantic model** in `packages/synthetiq-shared/synthetiq_shared/models/runs.py`.
      Defines `RunInput(BaseModel)` with fields: `org_id: str`, `company_id: str`, `fiscal_year: str`, `category: str`, `volume_tons: float`, `simulate_spoof: bool = False`, `schedule_id: str | None = None`. Export from `synthetiq_shared/models/__init__.py`.
      Files:
        - `packages/synthetiq-shared/synthetiq_shared/models/runs.py` (create)
        - `packages/synthetiq-shared/synthetiq_shared/models/__init__.py` (add `RunInput` export)
      Verify: `python -c "from synthetiq_shared.models import RunInput; print(RunInput.model_fields)"` from repo root passes with no ImportError.

- [ ] 2. **Add `HumanApprovalSignal` dataclass to worker workflows and standardize signal name**.
      In `worker/src/flows/workflows.py`, rename `AuditDecisionInput` → `HumanApprovalSignal` (keep all fields). Update `@workflow.signal` handlers in `QuadCoreAuditWorkflow` and `MasterEPRComplianceWorkflow` to use the new name. The signal method name stays `resolve_audit_exception` for wire compatibility with the existing `settlement.py` endpoint until FEAT-002 rewires it.
      Files:
        - `worker/src/flows/workflows.py`
      Verify: `python -c "from flows.workflows import HumanApprovalSignal; print('ok')"` from `worker/src/` passes.

- [ ] 3. **Update `MasterEPRComplianceWorkflow.run()` signature to accept `RunInput`**.
      Change the `run()` method to accept a single `RunInput` argument instead of five positional args. Extract fields from `run_input`. Pass `run_input.org_id` into `audit_scada_telemetry_activity` and `create_escrow_split_po_activity` args so DB writes are org-scoped. Remove the two hardcoded literals `"RECYC-DELHI-01"` and `"PLANT-OKHLA-2"` from this file — replace with `run_input.recycler_id` (add that field to `RunInput` with `default=""`) and `run_input.plant_id` (same). Remove hardcoded `"EWB-2026-99210"` from `QuadCoreAuditWorkflow` and `MasterEPRComplianceWorkflow` — replace with `eway_bill_ref: str` parameter passed through `RunInput`.
      Files:
        - `worker/src/flows/workflows.py`
        - `packages/synthetiq-shared/synthetiq_shared/models/runs.py` (add `recycler_id`, `plant_id`, `eway_bill_ref` fields)
      Depends on: item 1, item 2
      Verify: Worker starts without ImportError: `python -c "from flows.workflows import MasterEPRComplianceWorkflow"` from `worker/src/`.

- [ ] 4. **Alembic migration: extend `workflow_runs` table**.
      Create `packages/synthetiq-shared/alembic/versions/<rev>_phase2_runs.py` (revision chained from `a3f9c8e1d42b`). Add: `input_params JSON nullable`, `hitl_required BOOLEAN NOT NULL DEFAULT FALSE`, `temporal_run_id VARCHAR(256) nullable`. Update `WorkflowRun` ORM model in `organization.py` to add the three mapped columns. Enable RLS on `workflow_runs` matching the pattern from `a3f9c8e1d42b` (PostgreSQL only, degrades on SQLite).
      Files:
        - `packages/synthetiq-shared/alembic/versions/<rev>_phase2_runs.py` (create)
        - `packages/synthetiq-shared/synthetiq_shared/models/organization.py` (add 3 columns to `WorkflowRun`)
      Depends on: item 1
      Verify: `alembic upgrade head` from repo root exits 0 on a fresh SQLite dev DB.

- [ ] 5. **Create `api/src/routes/runs.py` — unified run endpoint**.
      `POST /runs` (permission: `workflows:execute`): validate request body as `RunInput`, write a `WorkflowRun` row with `status="RUNNING"`, dispatch `MasterEPRComplianceWorkflow` via `temporal_service.start_workflow(args=[run_input.model_dump()])`, return `{"run_id", "temporal_workflow_id", "temporal_ui_url", "status": "RUNNING"}`. No inline computation — zero stages executed here.
      `GET /runs` (permission: `workflows:read`): query `WorkflowRun` filtered by `tenant_ctx.org_id`, return list. Mirror existing list logic from `orchestrator.py` but remove `**(r.result or {})` blob expansion — return only typed fields.
      `GET /runs/{run_id}` (permission: `workflows:read`): fetch `WorkflowRun` from DB, call `temporal_service.get_workflow_description(r.temporal_workflow_id)` (swallow exception), merge `temporal_status` field into response.
      `DELETE /runs/{run_id}` (permission: `workflows:execute`): set `WorkflowRun.status = "CANCELLED"`, call `temporal_service.signal_workflow` with a cancel request (or use `handle.cancel()`).
      Files:
        - `api/src/routes/runs.py` (create)
      Depends on: items 1, 4
      Verify: `uvicorn src.main:app --port 8001` (or `python -c "from api.src.routes.runs import router"`) produces no ImportError.

- [ ] 6. **Register the new runs router; deprecate orchestrator router in `main.py`**.
      Add `runs_router` import and `app.include_router(runs_router, prefix=API_V1_STR)` in `api/src/main.py`. Remove the APScheduler startup block (the seeded `ORG-DEV-001`/`COMP-IN-001` schedule) from the lifespan. Keep `orchestrator_router` registered for now but mark it deprecated — it will be deleted in item 8.
      Files:
        - `api/src/routes/__init__.py` (add `runs_router`)
        - `api/src/main.py`
      Depends on: item 5
      Verify: `python -c "from src.main import app; print([r.path for r in app.routes])"` includes `/api/v1/runs`.

- [ ] 7. **Wire settlement `POST /approve` to the new `HumanApprovalSignal` via run_id**.
      In `api/src/routes/settlement.py`, change the `approve_audit_and_settle` endpoint: accept `run_id` in the payload (in addition to `audit_id`), derive `temporal_workflow_id` by querying `WorkflowRun` by `run_id`, signal that workflow with `HumanApprovalSignal` data. Remove the fallback `workflow_id = f"wf4-settlement-{audit_id}"` pattern which was guessing a workflow ID. Update `WorkflowRun.hitl_required = False` on approval.
      Files:
        - `api/src/routes/settlement.py`
      Depends on: items 2, 4
      Verify: Module imports cleanly: `python -c "from src.routes.settlement import router"`.

- [ ] 8. **Delete the inline simulation pipeline from `orchestrator.py`**.
      Remove the entire `execute_e2e_compliance_run` function body (Stages 1–5 inline computation, all `httpx` calls, the `push_event` calls, the hardcoded `clearing_price = 7.80`, `statutory_ceiling = 12.0`, `awarded_recycler = "RECYC-DELHI-01"`, `"PLANT-OKHLA-2"`, `"CPCB_ACCEPTED"`, etc.). Replace it with a single `HTTPException(410, "Moved: use POST /api/v1/runs")`. Retain only `GET /compliance/runs` and `GET /compliance/runs/{run_id}` as thin shims that delegate to the same DB queries as `runs.py` (or simply redirect). The router stays registered so existing clients get a 410 instead of 404.
      Files:
        - `api/src/routes/orchestrator.py`
      Depends on: item 6 (new runs endpoint must be live first)
      Verify: `python -c "from src.routes.orchestrator import router"` succeeds; no `httpx`, no `clearing_price`, no `simulate_spoof` remain in the file.

- [ ] 9. **Remove inline simulation from `audit.py` trigger endpoint**.
      In `api/src/routes/audit.py`, `POST /audit/trigger`: delete the full inline SCADA physics computation (all `kw`, `pf`, `torque` local variables, `sec_constants` dict, `delta_mass` calculation, `flags` construction). The endpoint should accept the payload and dispatch `QuadCoreAuditWorkflow` via `temporal_service.start_workflow` using a `RunInput`-like struct; return `{"audit_id", "temporal_workflow_id", "status": "RUNNING"}`. The `GET /audit/scada/live` endpoint is read-only telemetry with no inline pipeline — keep it. Remove `simulate_spoof` default from `trigger_fraud_audit`. Remove `"RECYC-DELHI-01"` and `"PLANT-OKHLA-2"` defaults (use empty string or require from payload).
      Files:
        - `api/src/routes/audit.py`
      Depends on: item 2
      Verify: `python -c "from src.routes.audit import router"` succeeds; no `clearing_price`, no `sec_constants`, no `simulate_spoof` default remain.

- [ ] 10. **Remove inline simulation from `agent_config.py` test endpoint**.
       In `api/src/routes/agent_config.py`, `POST /{agent_name}/test`: the `treasury` branch hardcodes `base_rate = float(agent_cfg.parameters.get("statutory_base_rate_inr", 12.0))`. Replace `12.0` with a config-sourced constant from `synthetiq_shared.constants` (`STATUTORY_CEILING_INR_PER_KG`). Remove `DISPATCH_FALLBACK` string if present. The agent test endpoint stays (it does not inline a pipeline) — only the magic number defaults need replacing with constants.
       Files:
         - `api/src/routes/agent_config.py`
         - `packages/synthetiq-shared/synthetiq_shared/constants/__init__.py` (add `STATUTORY_CEILING_INR_PER_KG: float = 12.0`)
       Depends on: none (independent)
       Verify: `python -c "from src.routes.agent_config import router"` succeeds.

- [ ] 11. **Replace APScheduler with Temporal Schedules in `api/src/routes/schedules.py`**.
       Rewrite the schedule CRUD to use `temporalio.client.Client.create_schedule` / `delete_schedule` / `list_schedules`. Each `POST /schedules` call creates a Temporal Schedule that fires `MasterEPRComplianceWorkflow` at the given cron. Each `DELETE /schedules/{id}` calls `handle.delete()`. `GET /schedules` calls `client.list_schedules()`. Remove all `SchedulerService` / APScheduler imports from `schedules.py`. Remove `apscheduler` usage from `api/src/services/scheduler_service.py` — replace the class body with a thin `TemporalScheduleService` that delegates to the Temporal client. Remove the APScheduler startup/shutdown from `api/src/main.py` lifespan (already started in item 6; finish the removal here).
       Files:
         - `api/src/routes/schedules.py`
         - `api/src/services/scheduler_service.py`
         - `api/src/main.py` (complete lifespan cleanup)
       Depends on: item 6
       Verify: `python -c "from src.routes.schedules import router"` succeeds; no `apscheduler` import remains in routes or services.

- [ ] 12. **Deterministic activity contracts: Pydantic output models + fail-closed gates**.
       In `worker/src/activities/agent_activities.py`:
       - Define `ActivityResult` base Pydantic model and per-activity result models (`LiabilityResult`, `AuctionResult`, `EWayResult`, `AuditResult`, `POResult`, `Form1Result`, `PDFResult`) validated before return.
       - Replace every `result.setdefault("...", 0.0)`, `result.setdefault("physical_melt_verified", not result.get("is_spoofed", False))` with explicit field extraction that raises `temporalio.exceptions.ApplicationError("ACTIVITY_RESULT_MISSING_FIELD: <field>", non_retryable=False)` if a required key is absent.
       - In `create_escrow_split_po_activity`: replace `audit_verdict="APPROVED"` and `human_approved=True` hardcoded kwargs with values derived from `AuditResult`; if not passed, raise `ApplicationError("FAIL_CLOSED: audit_verdict not provided")`.
       - In `generate_and_dispatch_form1_activity`: replace `result.setdefault("cpcb_portal_status", result.get("portal_status", "CPCB_ACCEPTED"))` — remove the `"CPCB_ACCEPTED"` default; raise `ApplicationError("FAIL_CLOSED: portal_status absent")` if missing.
       - In `generate_audit_report_pdf_activity`: add missing `import hashlib` (currently absent — the file references `hashlib.sha256` without importing it).
       Files:
         - `worker/src/activities/agent_activities.py`
       Depends on: items 1, 3
       Verify: `python -c "from activities.agent_activities import audit_scada_telemetry_activity"` from `worker/src/` succeeds (no NameError on `hashlib`).

- [ ] 13. **Thread `org_id` through activity DB writes in worker**.
       The worker activities that write to DB (`create_escrow_split_po_activity`, `generate_and_dispatch_form1_activity`) currently hardcode `recycler_id="RECYC-DELHI-01"` and `plant_id="PLANT-OKHLA-2"`. These come from args passed by the workflow (after item 3 changes). Ensure every DB write in activities uses `org_id` from the `RunInput` passed through workflow args. Update `audit_scada_telemetry_activity` to write `AuditRecord.org_id = org_id` (add `org_id: str` parameter to the activity signature).
       Files:
         - `worker/src/activities/agent_activities.py`
         - `worker/src/flows/workflows.py` (pass `org_id` to relevant activity calls)
       Depends on: items 3, 12
       Verify: `python -c "from flows.workflows import MasterEPRComplianceWorkflow"` from `worker/src/` succeeds.

- [ ] 14. **Literals scan: remove all forbidden hardcoded values**.
       Search and remove/replace every occurrence of: `RECYC-DELHI-01`, `PLANT-OKHLA-2`, `EWB-2026-99210`, `COMP-IN-001`, `ORG-DEV-001`, `7.80`, `4.5` (historic debt multiplier), `12.0` (ceiling, replaced by constant), `simulate_spoof` (as a data field default), `DISPATCH_FALLBACK` (in `temporal_service.py` fallback return), `CPCB_ACCEPTED` (as a hardcoded default).
       Specific replacements:
       - `RECYC-DELHI-01` / `PLANT-OKHLA-2` → removed; passed via `RunInput` (items 3, 13)
       - `EWB-2026-99210` → passed via `RunInput.eway_bill_ref` (item 3)
       - `COMP-IN-001`, `ORG-DEV-001` → removed from scheduler seed in `main.py` (items 6, 11)
       - `clearing_price = 7.80` → removed from orchestrator (item 8); in `SettlementDispatchWorkflow` replace `unit_price_inr: float = 7.5` default with `unit_price_inr: float` (required)
       - `4.5` (gross_liability multiplier in orchestrator Stage 1) → removed with orchestrator inline (item 8)
       - `12.0` → replaced with `STATUTORY_CEILING_INR_PER_KG` constant (item 10)
       - `simulate_spoof` as a payload field key → keep as workflow input field but remove `bool(p.get("simulate_spoof", False))` inline default in orchestrator (deleted in item 8)
       - `DISPATCH_FALLBACK` in `temporal_service.py` → change to `"TEMPORAL_UNAVAILABLE"` or raise a typed exception
       - `"CPCB_ACCEPTED"` default in activities → removed via fail-closed gate (item 12)
       Files:
         - `api/src/routes/orchestrator.py` (item 8 handles most)
         - `api/src/routes/audit.py` (item 9 handles)
         - `worker/src/flows/workflows.py` (items 3, 13 handle)
         - `worker/src/activities/agent_activities.py` (item 12 handles)
         - `api/src/services/temporal_service.py` (DISPATCH_FALLBACK → TEMPORAL_UNAVAILABLE)
         - `api/src/main.py` (ORG-DEV-001, COMP-IN-001 seed removal)
       Depends on: items 3, 6, 8, 9, 11, 12
       Verify: `Select-String -Path "api\src","worker\src" -Recurse -Pattern "RECYC-DELHI-01|PLANT-OKHLA-2|EWB-2026-99210|COMP-IN-001|ORG-DEV-001|DISPATCH_FALLBACK|simulate_spoof.*False|7\.80|CPCB_ACCEPTED"` returns no matches in changed files.

- [ ] 15. **Dashboard: update `compliance.service.ts` to call `POST /api/v1/runs`**.
       Change `runE2E()` to POST to `/api/v1/runs`. Change `listRuns()` to GET `/api/v1/runs`. Change `getRun()` to GET `/api/v1/runs/{id}`. Update `RunE2EParams` in `compliance.types.ts` to include `org_id?: string`. Update `E2ERunResult` to add `temporal_run_id?: string` and `hitl_required?: boolean`. The response shape from the new endpoint omits the `steps[]` blob (which was the inline computation result); update the type to make `steps` optional.
       Files:
         - `dashboard/app/lib/services/compliance.service.ts`
         - `dashboard/app/lib/types/compliance.types.ts`
       Depends on: item 5
       Verify: `cd dashboard && npx tsc --noEmit` exits 0.

- [ ] 16. **Dashboard: update `audit/page.tsx` — remove hardcoded default inputs**.
       Change `useState("RECYC-DELHI-01")` → `useState("")` and `useState("PLANT-OKHLA-2")` → `useState("")` for the `recyclerId` and `plantId` state variables. Add placeholder text to the corresponding `TextField` components so the user knows what format to enter. No other logic changes — the page already calls `auditSvc.triggerAudit()` which POSTs to `/api/v1/audit/trigger`.
       Files:
         - `dashboard/app/audit/page.tsx`
       Depends on: none (independent UI change)
       Verify: `cd dashboard && npx tsc --noEmit` exits 0.

---

## Dependency Graph

```
1 (RunInput)
├── 3 (workflow signature) ──> 12 (fail-closed) ──> 13 (org_id threading) ──> 14 (literals)
├── 4 (migration)  ──> 5 (runs router) ──> 6 (register) ──> 8 (delete inline)
│                                           └──> 7 (settlement signal)
│                                           └──> 11 (APScheduler→Temporal)
└── 2 (HumanApprovalSignal) ──> 7 (settlement signal)
                                └──> 9 (audit inline removal)
10 (agent_config constants)  — independent
15 (dashboard service)       — depends on 5
16 (audit page)              — independent
```

## FEAT Grouping

- **FEAT-001** (model/DB): items 1, 2, 3, 4
- **FEAT-002** (API layer): items 5, 6, 7, 8, 9, 10, 11
- **FEAT-003** (worker layer): items 12, 13, 14
- **FEAT-004** (dashboard): items 15, 16
