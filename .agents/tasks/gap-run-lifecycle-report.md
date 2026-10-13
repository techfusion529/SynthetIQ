# Gap Run Lifecycle — Implementation Report

**Commit:** d6f8ed6  
**Date:** first iteration (no prior review JSON found)  
**All 9 gaps implemented from scratch per gap-run-lifecycle-plan.md**

---

## Verification Results

### py_compile checks

| File | Result |
|---|---|
| `api/src/routes/runs.py` | ✅ OK |
| `worker/src/flows/workflows.py` | ✅ OK |
| `worker/src/activities/config_activities.py` | ✅ OK |
| `packages/synthetiq-shared/synthetiq_shared/models/organization.py` | ✅ OK |
| `worker/src/activities/agent_activities.py` | ✅ OK |

### pytest api/tests/

```
14 passed, 1 warning in 13.82s
```
All 14 existing API tests pass.

### Pattern search (SUCCESS_FULLY_COMPLIANT | COMP-IN-001 | human_approved=True)

- `COMP-IN-001` — **zero hits** in `worker/src/flows` and `api/src/routes` ✅
- `human_approved=True` — **zero hits** ✅
- `SUCCESS_FULLY_COMPLIANT` — 3 hits, all benign:
  - `worker/src/flows/workflows.py` — `_final_status = "SUCCESS_FULLY_COMPLIANT"` (computed status for genuinely successful run, per RUN-08 plan)
  - `api/src/routes/liability.py` — read-only DB query filter for WorkflowRun status
  - `api/src/routes/stream.py` — status comparison for SSE streaming (not modified, not in scope)

---

## Gap-by-gap summary

### RUN-01 — ORM missing columns ✅
- Added `mapping: Mapped[Optional[dict]]` and `secret_ref: Mapped[Optional[str]]` to `DataSource`
- Added `ingestion_run_id: Mapped[Optional[str]]` to `AuditRecord`
- Updated `AuditRecord.to_dict()` to include `ingestion_run_id`
- Migration `e7f8a9b0c1d2` already covers the DB columns — no migration changes needed

### RUN-02 — POST /runs request shape ✅
- Added `CreateRunRequest(BaseModel)` with `type: str` and `params: dict = {}`
- `create_run` signature changed from `payload: dict` to `body: CreateRunRequest`
- `org_id` always taken from `tenant_ctx`, never from body
- `RunInput` populated from `body.params`
- `dashboard/app/lib/api.ts` already sends `{ type, params }` — no changes needed

### RUN-03 — Optional result model fields ✅
- Added `from typing import Optional` import
- `LiabilityResult`: `gross_liability_tons` and `category` are `Optional = None`; `net_liability_tons` required
- `AuctionResult`: `total_volume_tons` is `Optional = None`; `clearing_price` and `winner_org_id` required
- `AuditResult`: `physical_melt_verified` and `audit_id` are `Optional = None`; `delta_percent` and `verdict` required
- `POResult`: `po_number` and `audit_verdict` are `Optional = None`; `po_id` and `escrow_amount` required
- `Form1Result`: `portal_status` is `Optional = None`; `form1_id` required
- Removed `_require()` gates for now-Optional fields

### RUN-04 — Write run status back ✅
- Added `update_workflow_run_activity` to `config_activities.py`
- Called from `MasterEPRComplianceWorkflow.run()` at: post-config (RUNNING), HITL pause, fraud halt, successful completion, and in except block
- Registered in `worker/src/main.py` activities list
- `GET /runs/{run_id}` now includes `result` field in response

### RUN-05 — Chain workflow stages ✅
- After Stage 1: `auction_target_tons = float(liability.get("net_liability_tons") or volume_tons)`
- After Stage 2b: `effective_recycler_id = auction.get("winner_org_id") or recycler_id`; clearing_price checked, no fallback 7.8
- After Stage 3: `_audit_verdict = audit.get("verdict") or audit.get("audit_verdict", "")` — raises if missing, no hardcoded "APPROVED"

### RUN-06 — Temporal-down branch ✅
- Fixed `temporal_service.py` fallback status from `"TEMPORAL_UNAVAILABLE"` to `"DISPATCH_FALLBACK"`
- The existing handler in `runs.py` now correctly triggers, deletes the orphaned RUNNING record, and returns HTTP 503

### RUN-07 — Pack version "default" handling ✅
- `fetch_run_config_activity` now uses `approved_at.desc()` query for `"default"` or empty version
- Explicit version strings still query by exact match
- Error message updated to include version in parens

### RUN-08 — Remove hardcoded return value ✅
- `final_result` built from actual stage outputs: `verdict`, `form1_id`, `clearing_price`, `net_liability_tons`, `audit_id`, `po_id`
- Status is `"SUCCESS_FULLY_COMPLIANT"` only when `physical_melt_verified` is truthy; otherwise `"FAILED"` with `failed_stage`
- HITL-halt path returns `status: "FAILED"` with `halt_reason: "HALTED_DUE_TO_FRAUD"` for consistency
- `update_workflow_run_activity` receives this structured result

### RUN-09 — Remove standalone route hardcoded defaults ✅
- `liability.py`: `company_id` falls back to `tenant_ctx.org_id`; raises HTTP 400 if both absent; `TenantCtx` dependency added
- `auctions.py`: `company_id` falls back to `tenant_ctx.org_id`; `statutory_rate_per_kg`, `floor_price_inr`, `ceiling_price_inr`, `target_tons` are all required (HTTP 422 if absent); no hardcoded numeric defaults
- `audit.py`: `recycler_id` and `plant_id` already validated with HTTP 400 — no changes needed

---

## Files changed

| File | Gaps |
|---|---|
| `packages/synthetiq-shared/synthetiq_shared/models/organization.py` | RUN-01 |
| `api/src/routes/runs.py` | RUN-02, RUN-04 |
| `worker/src/activities/agent_activities.py` | RUN-03 |
| `worker/src/activities/config_activities.py` | RUN-04, RUN-07 |
| `worker/src/flows/workflows.py` | RUN-04, RUN-05, RUN-08 |
| `worker/src/main.py` | RUN-04 |
| `api/src/services/temporal_service.py` | RUN-06 |
| `api/src/routes/liability.py` | RUN-09 |
| `api/src/routes/auctions.py` | RUN-09 |
