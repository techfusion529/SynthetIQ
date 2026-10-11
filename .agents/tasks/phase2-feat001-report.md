# Phase 2 FEAT-001 Implementation Report

**Date:** 2026-10-09  
**Scope:** Items 1, 2, 3, 4 from phase2-plan.md

---

## Summary

All four tasks in FEAT-001 (model/DB) have been implemented and verified.

---

## What Was Found (pre-existing state)

Most of FEAT-001 had been partially implemented before this step ran:

| Item | Pre-existing state |
|------|-------------------|
| `runs.py` | Existed but was missing `run_id`, `regulatory_pack_version`, `params` fields; had wrong defaults for `fiscal_year`/`category` |
| `models/__init__.py` | Already exported `RunInput` |
| `workflows.py` — `HumanApprovalSignal` | Already defined as a dataclass; no `_approval_received` flag; `@workflow.signal` lacked `name="human_approval"`; `wait_condition` checked `auditor_approved is not None` instead of `_approval_received` |
| `MasterEPRComplianceWorkflow.run()` | Already accepted `RunInput`; no hardcoded RECYC/PLANT/EWB literals in workflows.py |
| Alembic migration `c1d2e3f4a5b6` | Already fully written with 3 new columns + RLS |
| `WorkflowRun` ORM | Already had `input_params`, `hitl_required`, `temporal_run_id` mapped columns |

---

## Changes Made

### Task 1 — RunInput Pydantic model
**File:** `packages/synthetiq-shared/synthetiq_shared/models/runs.py`

- Added required field `run_id: str`
- Added `regulatory_pack_version: str = "default"`
- Added `params: dict = {}`
- Changed `fiscal_year` default from `"FY2026-27"` to `""` (no hardcoded default)
- Changed `category` default from `"cat_i_rigid"` to `""` (no hardcoded default)
- Changed `volume_tons` from required (no default) to `float = 0.0`
- Changed `company_id` from required to `str = ""`
- Added `from typing import Optional` for explicit `Optional[str]` annotation on `schedule_id`
- No change to `models/__init__.py` — `RunInput` was already exported

### Task 2 — Standardise HumanApprovalSignal
**File:** `worker/src/flows/workflows.py`

- Added `_approval_received: bool = False` instance flag to `QuadCoreAuditWorkflow.__init__`
- Added `_signal_input: HumanApprovalSignal | None = None` to both workflow `__init__` methods
- Changed `@workflow.signal` → `@workflow.signal(name="human_approval")` in both `QuadCoreAuditWorkflow` and `MasterEPRComplianceWorkflow`
- Signal handler now sets `self._approval_received = True` as final step
- `wait_condition` in `QuadCoreAuditWorkflow.run()` changed from `lambda: self.auditor_approved is not None` → `lambda: self._approval_received`
- Added module-level alias `AuditDecisionInput = HumanApprovalSignal` for wire compatibility with existing `settlement.py` endpoint

### Task 3 — MasterEPRComplianceWorkflow accepts RunInput
**File:** `worker/src/flows/workflows.py`

- Added `_approval_received: bool = False` and `_signal_input` to `MasterEPRComplianceWorkflow.__init__`
- `@workflow.signal(name="human_approval")` on `resolve_audit_exception`
- Signal handler sets `_approval_received = True`
- `wait_condition` updated to `lambda: self._approval_received`
- `run()` already accepted `RunInput` — no further signature change needed
- No hardcoded `RECYC-DELHI-01`, `PLANT-OKHLA-2`, or `EWB-2026-99210` in `workflows.py` (confirmed by grep — values appear in `seed.py`, `orchestrator.py`, `audit.py`, `pdf_generator.py` etc., which are FEAT-002/003 scope)

### Task 4 — Alembic migration
**File:** `packages/synthetiq-shared/alembic/versions/c1d2e3f4a5b6_phase2_runs.py` — already complete  
**File:** `packages/synthetiq-shared/synthetiq_shared/models/organization.py` — already complete

No changes needed. Migration chained from `a3f9c8e1d42b`, adds:
- `input_params JSON nullable`
- `hitl_required BOOLEAN NOT NULL DEFAULT FALSE`
- `temporal_run_id VARCHAR(256) nullable`
- RLS policy on `workflow_runs` (PostgreSQL; skipped silently on SQLite)

`WorkflowRun` ORM already had all three mapped columns.

---

## Verification Results

```
# Task 1
python -c "from synthetiq_shared.models import RunInput; print(list(RunInput.model_fields))"
# Output: ['org_id', 'run_id', 'company_id', 'fiscal_year', 'category', 'volume_tons',
#           'recycler_id', 'plant_id', 'eway_bill_ref', 'regulatory_pack_version',
#           'simulate_spoof', 'schedule_id', 'params']
# ✅ PASS

# Task 2 + 3
cd worker; python -c "from src.flows.workflows import MasterEPRComplianceWorkflow, HumanApprovalSignal; print('worker ok')"
# Output: worker ok
# ✅ PASS

# Task 4
python -c "from alembic.config import Config; cfg = Config('alembic.ini'); print('alembic ok')"
# Output: alembic ok
# ✅ PASS
```

---

## Remaining Hardcoded Values (out of FEAT-001 scope)

The following files still contain RECYC-DELHI-01 / PLANT-OKHLA-2 literals — they are addressed in FEAT-002 (API layer) and FEAT-003 (worker layer):

- `api/src/routes/audit.py` — Task 9
- `api/src/routes/orchestrator.py` — Task 8
- `packages/synthetiq-shared/synthetiq_shared/seed.py` — seed data (non-production)
- `packages/synthetiq-shared/synthetiq_shared/utils/pdf_generator.py` — Task 12/13
- `worker/src/services/pdf_generator.py` — Task 12/13
- `worker/src/agents/orchestrator.py` — Task 13
- `worker/src/agents/treasury_agent.py` — Task 12/13
- `simulator/src/generators/` — simulator defaults (out of plan scope)
- `mocks/tests/`, `mcp/tests/`, `worker/tests/`, `scripts/` — test fixtures (out of plan scope)
