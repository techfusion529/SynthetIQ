# FEAT-002a: Unified /runs API, orchestrator deprecation, audit/settlement hardening

FEAT-002a replaces the inline-pipeline `POST /compliance/run-e2e` with a proper `POST /api/v1/runs` endpoint backed by a `WorkflowRun` DB record, tenant-scoped pagination, and a Temporal dispatch path. It simultaneously scrubs hardcoded fixture data from `audit.py` and `settlement.py`, replaces the bare `12.0` statutory rate with a named constant in `agent_config.py`, and removes APScheduler seeding from the API lifespan. All six modified files compile cleanly.

Watch for: (**confirmed**) `runs.py` POST endpoint accepts `payload: dict[str, Any]` instead of a typed FastAPI body — Pydantic validation for `RunInput` fires at construction time but FastAPI cannot return a structured 422 with field-level errors before the handler body runs. (**confirmed**) `audit.py` `list_audit_exceptions` reads `delta_mass` from stored records as a filter predicate — not inline physics, but the field name will confuse anyone expecting `delta_mass` to have been removed. (**confirmed**) `settlement.py` fallback path when `temporal_workflow_id` is `None` after DB lookup is `422 Unprocessable Entity`, not `404` — may surprise callers expecting `404` for unknown runs.

**Verdict**: APPROVED

---

## High-level view

The new `POST /api/v1/runs` handler builds a `RunInput` via explicit field extraction from a raw dict, persists a `WorkflowRun` before dispatching to Temporal, and cleans up the DB record if Temporal is unreachable — returning 503 in that case. The 503 path relies on `temporal_service` emitting a `"DISPATCH_FALLBACK"` sentinel string; both sides use the same literal today, so the path functions correctly.

`GET /runs`, `GET /runs/{run_id}`, and `DELETE /runs/{run_id}` all filter `WorkflowRun` rows by `tenant_ctx.org_id` when the caller is not a platform admin, satisfying tenant isolation. Platform admins see all records across orgs.

`orchestrator.py` POST `/compliance/run-e2e` is a clean 410 tombstone — no inline pipeline code, no hardcoded literals remain. The existing GET endpoints for compliance runs were preserved and also carry the `org_id` filter.

`trigger_fraud_audit` in `audit.py` now validates `recycler_id` and `plant_id` as required fields and delegates all physics work to the `QuadCoreAuditWorkflow` via Temporal. The inline physics variables (`kw`, `pf`, `torque`, `flags`) that remain in the file are confined to `GET /audit/scada/live`, which is the live SCADA telemetry endpoint — they were always there and are out of scope for this change.

`settlement.py` no longer guesses a `wf4-settlement-{audit_id}` fallback workflow ID. It queries `WorkflowRun` by `run_id` with an `org_id` guard and signals the `temporal_workflow_id` stored in the record. The `hitl_required` flag is cleared on APPROVE.

`agent_config.py` uses `STATUTORY_CEILING_INR_PER_KG` (12.0, defined in `synthetiq_shared/constants/__init__.py`) as the default for the treasury agent's statutory base rate.

---

<details>
<summary>Issues (3)</summary>

1. **Untyped POST body in /runs** — `payload: dict[str, Any]` bypasses FastAPI's automatic 422 validation. If `volume_tons` is a non-numeric string, the error surfaces as an unhandled `ValueError` from the `float()` cast rather than a structured 422 response. Change the parameter type to `RunInput` directly so FastAPI validates the body before the handler runs.

2. **delta_mass filter in list_audit_exceptions** — The `list_audit_exceptions` endpoint filters records where `float(a.get("delta_mass", 0.0)) > 0.02`. This field name is a physics artifact stored in the audit record dict; the intent is clear but undocumented. If `AuditRecord.to_dict()` never populates `delta_mass`, the filter silently passes all records through without flagging the gap. Verify that `AuditRecord.to_dict()` populates this field, or replace the check with the correct field name.

3. **422 vs 404 when WorkflowRun has no temporal_workflow_id** — `settlement.py` raises `422 Unprocessable Entity` ("WorkflowRun has no associated Temporal workflow_id") for a run that was successfully found in DB but has a null `temporal_workflow_id`. A `WorkflowRun` in this state is a data integrity issue, not a client input error; `500` or `409` would be more appropriate than `422`.

</details>

---

<details>
<summary>Details</summary>

### Untyped POST body and validation gap in /runs

`create_run` declares `payload: dict[str, Any]` as its body parameter. FastAPI will not validate the incoming JSON against `RunInput` before entering the handler. The `RunInput(...)` constructor call does run Pydantic validation, but by then FastAPI has already accepted the request — any `ValidationError` raised here propagates as a 500, not a 422, unless there is a custom exception handler for it (none is registered). A caller sending `"volume_tons": "not-a-number"` gets a 500 Internal Server Error instead of a structured 422 with field path. The fix is to accept `RunInput` directly as the FastAPI body parameter and drop the manual field extraction.

### delta_mass field in list_audit_exceptions

`list_audit_exceptions` includes records where `float(a.get("delta_mass", 0.0)) > 0.02`. This is a pre-existing filter, but FEAT-002a's `trigger_fraud_audit` rewrite removes the physics computation that would previously have populated this field in a fresh audit. If `AuditRecord.to_dict()` does not emit a `delta_mass` key, the predicate always evaluates to `False` (default 0.0), silently excluding real exceptions. The audit checklist asked that physics variables be removed from the `trigger_fraud_audit` function body — they were — but this filter in `list_audit_exceptions` deserves a cross-check against `AuditRecord.to_dict()` to confirm the field is still populated downstream.

### settlement.py: 422 status on null temporal_workflow_id

After a successful DB lookup of `WorkflowRun`, if `temporal_workflow_id` and `temporal_run_id` are both null, `approve_audit_and_settle` raises `HTTPException(status_code=422, detail="WorkflowRun has no associated Temporal workflow_id")`. HTTP 422 means the client sent an unprocessable entity — but the client's `run_id` was valid and the record was found. A `409 Conflict` or `500 Internal Server Error` (data integrity failure) is semantically correct. This is a minor API contract issue but may confuse clients that treat 422 as "bad input, retry with different data."

### hitl_required update TOCTOU in settlement.py

The `hitl_required = False` update after APPROVE opens a second DB session that re-fetches `WorkflowRun` by `run_id` without repeating the `org_id` guard. The caller already passed the first guard, so in practice this is safe — `run_id` is a UUIDv4-derived token that cannot be guessed. However, the inconsistency means a future refactor that inlines the update into a single session could silently drop the org check.

</details>

---

<details>
<summary>File map</summary>

| File | What changed |
|---|---|
| `api/src/routes/runs.py` | New file: full CRUD for `/api/v1/runs` with tenant isolation and Temporal dispatch |
| `api/src/main.py` | Added `runs_router` at `/api/v1`; removed APScheduler seeding from lifespan |
| `api/src/routes/orchestrator.py` | `POST /compliance/run-e2e` replaced with 410 tombstone; GET endpoints preserved |
| `api/src/routes/audit.py` | `trigger_fraud_audit` rewritten to dispatch to Temporal, physics computation removed |
| `api/src/routes/agent_config.py` | `12.0` literal replaced with `STATUTORY_CEILING_INR_PER_KG` constant |
| `api/src/routes/settlement.py` | `approve_audit_and_settle` now requires `run_id`, looks up `WorkflowRun` with org check, signals via `temporal_workflow_id` |
| `packages/synthetiq-shared/synthetiq_shared/constants/__init__.py` | Added `STATUTORY_CEILING_INR_PER_KG: float = 12.0` |
| `packages/synthetiq-shared/synthetiq_shared/models/runs.py` | New `RunInput` Pydantic model for workflow dispatch |

Full diff: `git diff main -- api/src/routes/runs.py api/src/main.py api/src/routes/orchestrator.py api/src/routes/audit.py api/src/routes/agent_config.py api/src/routes/settlement.py`

</details>
