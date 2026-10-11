# FEAT-002a Implementation Report — API Layer Cleanup (A1–A6)

**Commit:** `c758c77` — `feat: API layer cleanup A1-A6 (runs router, orchestrator 410, audit slim, settlement rewire, STATUTORY_CEILING constant)`
**Branch:** `dev`
**Review verdict:** **APPROVED** (see `phase2-feat002a-review.json`)

---

## Task Summary

### A1 — Create `api/src/routes/runs.py` (new file)

Created a full CRUD route module for `POST/GET/DELETE /api/v1/runs` backed by the existing `WorkflowRun` ORM and `temporal_service`. All endpoints require `TenantCtx` via `get_tenant_ctx`; platform admins see all org rows, other callers are filtered to their own `org_id`. The POST handler creates a `WorkflowRun` DB row before dispatching to Temporal, deletes it and returns 503 if Temporal is unreachable, and updates `temporal_workflow_id`/`temporal_run_id` on success (HTTP 202). The DELETE endpoint signals a `"cancel"` to Temporal and marks the row `cancelled`.

**Files changed:** `api/src/routes/runs.py` *(created)*

---

### A2 — Register `runs_router` in `main.py`; remove APScheduler seed

Added `runs_router` to `api/src/routes/__init__.py` and wired it into `app` at the `API_V1_STR` prefix in `api/src/main.py`. Removed the entire APScheduler startup/shutdown block from the `lifespan` context manager, including the hardcoded `ORG-DEV-001` / `COMP-IN-001` seed schedule.

**Files changed:** `api/src/routes/__init__.py`, `api/src/main.py`

---

### A3 — Deprecate `POST /compliance/run-e2e` with 410 tombstone

Replaced the entire inline-pipeline body of `execute_e2e_compliance_run` in `orchestrator.py` with `raise HTTPException(status_code=410, detail="Moved: use POST /api/v1/runs")`. Removed now-unused imports (`hashlib`, `time`, `httpx`, `uuid`, `get_runtime_config`, `push_event`, `MCP_URL`/`MOCKS_URL`/`SIMULATOR_URL`). All three GET handlers (`list_compliance_runs`, `get_compliance_run_steps`, `get_compliance_run`) were left completely untouched.

**Files changed:** `api/src/routes/orchestrator.py`

---

### A4 — Slim `trigger_fraud_audit` in `audit.py`

Replaced the physics-heavy inline body of `trigger_fraud_audit` with a thin Temporal dispatch to `QuadCoreAuditWorkflow`. `recycler_id` and `plant_id` are now required fields (400 if missing); the old silent defaults `"RECYC-DELHI-01"` and `"PLANT-OKHLA-2"` are gone. Removed `import hashlib` (the only unused import after the rewrite). All other functions in the file (`get_live_scada_stream`, `list_audit_verdicts`, `list_audit_exceptions`, etc.) are untouched.

**Files changed:** `api/src/routes/audit.py`

---

### A5 — Add `STATUTORY_CEILING_INR_PER_KG` constant; use in `agent_config.py`

Added `STATUTORY_CEILING_INR_PER_KG: float = 12.0` to `packages/synthetiq-shared/synthetiq_shared/constants/__init__.py`. Imported it in `api/src/routes/agent_config.py` and replaced the bare `12.0` literal in the `treasury` branch of `test_agent_with_dynamic_data` with the named constant.

**Files changed:** `packages/synthetiq-shared/synthetiq_shared/constants/__init__.py`, `api/src/routes/agent_config.py`

---

### A6 — Wire `settlement.py` POST /approve to `WorkflowRun` via `run_id`

Rewrote `approve_audit_and_settle` to accept `run_id` (required) from the request body, look up the matching `WorkflowRun` row with an `org_id` guard, and derive `temporal_workflow_id` from the DB record. The old guessed fallback `f"wf4-settlement-{audit_id}"` is removed. On APPROVE, a second session clears `run_rec.hitl_required = False` and updates any linked `EscrowPORecord.status` to `"advance_released"`. `TenantCtx` was added as a new dependency parameter.

**Files changed:** `api/src/routes/settlement.py`

---

## Verification Results

### py_compile — all eight changed files

```
python -m py_compile \
  api/src/routes/runs.py \
  api/src/main.py \
  api/src/routes/orchestrator.py \
  api/src/routes/audit.py \
  api/src/routes/agent_config.py \
  api/src/routes/settlement.py \
  packages/synthetiq-shared/synthetiq_shared/constants/__init__.py \
  packages/synthetiq-shared/synthetiq_shared/models/runs.py
```

**Result:** `ALL FILES: py_compile OK` (exit 0)

### pytest — `api/tests/`

```
pytest api/tests/ --tb=short -q
```

**Result:** `14 passed, 1 warning in 9.25s` (exit 0)

> Note: three test collection errors exist for `mcp/tests/`, `simulator/tests/`, and `worker/tests/` — all pre-existing import failures (`ModuleNotFoundError: src.generators`, `src.activities`) unrelated to FEAT-002a. They are not regressions introduced by this change.

### Literal removal checks (Select-String / Python assertions)

| Check | Result |
|---|---|
| `ORG-DEV-001` in `api/src/main.py` | **not present** ✓ |
| `COMP-IN-001` in `api/src/main.py` | **not present** ✓ |
| `clearing_price = 7.80` in `orchestrator.py` | **not present** ✓ |
| `RECYC-DELHI-01` in `orchestrator.py` | **not present** ✓ |
| `RECYC-DELHI-01` in `audit.py` | **not present** (count: 0) ✓ |
| `wf4-settlement-` in `settlement.py` | **not present** ✓ |
| `12.0` bare literal in `agent_config.py` treasury branch | replaced with `STATUTORY_CEILING_INR_PER_KG` ✓ |

Note: `orchestrator.py` still contains the string `"/run-e2e"` as the route path decorator on the 410 tombstone function — this is expected; the route must exist to return 410. It does not contain the old inline pipeline code.

### Route registration

```python
from src.main import app
[r.path for r in app.routes if 'runs' in r.path]
# → ['/api/v1/runs', '/api/v1/runs', '/api/v1/runs/{run_id}', '/api/v1/runs/{run_id}']
```

`/api/v1/runs` is live alongside the legacy `/api/v1/compliance/runs` paths. ✓

### Constant value

```
from synthetiq_shared.constants import STATUTORY_CEILING_INR_PER_KG
# → 12.0
```

✓

---

## Review Findings Summary

The review (verdict: **APPROVED**) raised four findings, all noted as informational / low-severity:

1. **Untyped POST body in `/runs`** — `payload: dict[str, Any]` means FastAPI cannot return a structured 422 before the handler runs; a bad `volume_tons` surfaces as 500 rather than a field-level 422. *Recommended fix:* change the body parameter type to `RunInput` directly and drop manual field extraction. This is a follow-up item.

2. **`delta_mass` filter in `list_audit_exceptions`** — The predicate `float(a.get("delta_mass", 0.0)) > 0.02` silently passes all records if `AuditRecord.to_dict()` does not populate that field. FEAT-002a removed the inline physics that computed `delta_mass` in `trigger_fraud_audit`; the filter in `list_audit_exceptions` was not in scope but deserves a cross-check against `AuditRecord.to_dict()`. This is a follow-up verification item.

3. **422 vs 409/500 in `settlement.py` on null `temporal_workflow_id`** — When a `WorkflowRun` is found in DB but has no `temporal_workflow_id`, the endpoint returns `422`. HTTP 422 implies bad client input; `409 Conflict` or `500 Internal Server Error` would be semantically correct for a data-integrity gap. This is a minor API contract issue and a follow-up item.

4. **TOCTOU `hitl_required` update in `settlement.py`** — The APPROVE path opens a second DB session without repeating the `org_id` guard. Safe today (UUID `run_id` is not guessable), but inconsistent. A future single-session refactor could silently drop the guard.

---

## Follow-up Items

| ID | Finding | Action needed |
|---|---|---|
| FU-1 | Untyped POST body in `runs.py` | Change `payload: dict[str, Any]` to `body: RunInput` as FastAPI body param; remove manual field extraction |
| FU-2 | `delta_mass` field in `list_audit_exceptions` | Verify `AuditRecord.to_dict()` emits `delta_mass`; rename or document if field name differs |
| FU-3 | `settlement.py` 422 on null `temporal_workflow_id` | Change to `HTTPException(status_code=409, ...)` or `500` |
| FU-4 | TOCTOU `hitl_required` update | Consolidate to a single DB session with the `org_id` guard included |
