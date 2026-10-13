# RUN-01 through RUN-09 Gap Fixes — Implementation Review

This change implements nine targeted fixes to the run lifecycle in SynthetIQ, addressing missing ORM columns, a broken request shape contract, Optional result model fields, write-back of workflow status from the worker, inter-stage data chaining, a Temporal-down error path, regulatory pack version resolution, structured workflow return values, and removal of hardcoded tenant identifiers from standalone routes. The fixes span the API layer, the Temporal worker, the shared ORM models, and the dashboard client. Per the verification report, all 14 API tests pass and py_compile passes on all five changed Python files.

**Watch for:** (1) **confirmed** — `create_run` opens a DB session to write the `WorkflowRun` record but never calls `session.commit()`, so the record is never actually persisted before Temporal dispatch; the cleanup path and the `temporal_run_id` update path both re-open a fresh session that will never find the row. (2) **confirmed** — the `_human_approved` fallback in the workflow defaults to `True` when `auditor_approved is None`, silently bypassing the human-approval gate for non-HITL runs. (3) **confirmed** — `SettlementDispatchWorkflow` still passes `"audit_verdict": "APPROVED"` as a hardcoded literal to the PDF activity — not fixed by RUN-05. (4) **confirmed** — `broadcast_rfp` validates `statutory_rate_per_kg` but does not pass it to the Temporal dispatch call; the auction workflow runs with the default `12.0`.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The `WorkflowRun` write in `create_run` (RUN-02) opens an `async with get_db_session()` block, calls `session.add()`, and exits without `await session.commit()`. SQLAlchemy's async context manager does not auto-commit; the transaction is rolled back on exit. The row is never persisted. Every downstream path — the DISPATCH_FALLBACK cleanup, the `temporal_run_id` update, and the worker's `update_workflow_run_activity` — operates on a row that does not exist, so `GET /runs/{run_id}` returns 404 for every run and RUN-04's status write-back silently no-ops for all runs.

RUN-05 stage chaining is structurally correct in `MasterEPRComplianceWorkflow`: `auction_target_tons` uses `liability["net_liability_tons"]`, `effective_recycler_id` uses `auction["winner_org_id"]`, and `_audit_verdict` reads from `audit["verdict"]` with a fail-closed raise if missing. One confirmed gap remains: `SettlementDispatchWorkflow.run()` still passes `"audit_verdict": "APPROVED"` as a literal into the PDF activity args dict. This sub-workflow was not in scope for RUN-05 per the plan, but it stamps every PDF report with "APPROVED" regardless of actual audit outcome.

RUN-08 introduces a behavioral security gap: `_human_approved` defaults to `True` when `auditor_approved is None`. For any run that never enters the HITL branch, `auditor_approved` stays `None` and the PO activity receives `human_approved=True` without any human having approved anything. The PO activity guards against `None` but not against `True` on a non-HITL path.

RUN-09's `auctions.py` fix validates all four rate parameters but does not thread `statutory_rate` through to the Temporal dispatch call. `broadcast_rfp` passes `args=[company_id, category, float(target_tons)]` — `AuctionLiquidityWorkflow` accepts `statutory_base_rate: float = 12.0` as a defaulted parameter. The `AuctionRecord` row gets the caller-supplied rate, but the workflow activity runs with the hardcoded default `12.0` regardless. This partially re-introduces the numeric default the fix was meant to eliminate.

RUN-01, RUN-03, RUN-04 (activity and registration), RUN-06, and RUN-07 are correctly implemented with no blocking concerns.

---

<details>
<summary>Issues (4)</summary>

1. **WorkflowRun never committed** — `create_run` calls `session.add(wf_run)` inside an `async with get_db_session()` block but never calls `await session.commit()`. The row is rolled back on context-manager exit. Fix: add `await session.commit()` before the block closes. This breaks RUN-04 end-to-end because the worker's `update_workflow_run_activity` SELECT finds no row and silently no-ops, and `GET /runs/{run_id}` returns 404 for every run.

2. **`_human_approved` defaults to `True` for non-HITL runs** — In `workflows.py`, `_human_approved: bool = bool(self.auditor_approved) if self.auditor_approved is not None else True`. For runs that never trigger HITL, `auditor_approved` stays `None` and `_human_approved` is `True`. The PO activity receives `human_approved=True` without any human approval. Fix: the default should be `False`, or the PO activity should receive a sentinel indicating "HITL not required" rather than treating it as approved.

3. **`SettlementDispatchWorkflow` retains hardcoded `"audit_verdict": "APPROVED"`** — `SettlementDispatchWorkflow.run()` passes `"audit_verdict": "APPROVED"` as a literal to `generate_audit_report_pdf_activity`. RUN-05 fixed this in `MasterEPRComplianceWorkflow` but not in this sub-workflow. Fix: thread the `audit_verdict` parameter through to the PDF activity args.

4. **`auctions.py` does not pass `statutory_rate` to Temporal dispatch** — `broadcast_rfp` passes `args=[company_id, category, float(target_tons)]` to `AuctionLiquidityWorkflow`, which accepts `statutory_base_rate: float = 12.0` as a default. The caller-supplied rate is validated and stored in `AuctionRecord` but never forwarded to the workflow; the activity runs with the hardcoded default. Fix: add `float(statutory_rate)` as the fourth positional arg in the `start_workflow` call.

</details>

<details>
<summary>Details</summary>

## WorkflowRun write in `create_run` never commits

In `api/src/routes/runs.py`, the initial `WorkflowRun` persistence block reads:

```python
async with get_db_session() as session:
    wf_run = WorkflowRun(...)
    session.add(wf_run)
```

There is no `await session.commit()` before the `async with` block exits. SQLAlchemy's async session context manager does not auto-commit; it only closes the session (and rolls back any uncommitted transaction). The row is never written to the database.

The downstream effects cascade through most of RUN-04:
- The DISPATCH_FALLBACK cleanup `sa_delete` executes against a non-existent row (silent no-op).
- The `temporal_run_id` update later in `create_run` opens a fresh session, `SELECT`s the row, finds nothing, and skips the update.
- The worker's `update_workflow_run_activity` opens its own session, `SELECT`s `WorkflowRun.run_id`, finds nothing, logs a warning, and returns — so no status is ever written back from the worker side either.
- `GET /runs/{run_id}` returns 404 for every run.

The fix is a single `await session.commit()` after `session.add(wf_run)`. This is confirmed by reading the code; there is no `commit()` call anywhere in that `async with` block.

## `_human_approved` silent gate bypass

In `MasterEPRComplianceWorkflow.run()`:

```python
_human_approved: bool = bool(self.auditor_approved) if self.auditor_approved is not None else True
```

`self.auditor_approved` is initialized to `None` in `__init__` and is only set when a `human_approval` signal arrives. For any run where `is_fraudulent` is `False`, the HITL block is skipped entirely and `auditor_approved` remains `None`. The expression resolves to `True`, so `create_escrow_split_po_activity` receives `human_approved=True`.

The PO activity explicitly requires `human_approved` to be non-None:

```python
if human_approved is None:
    raise ApplicationError("FAIL_CLOSED: human_approved not provided to PO activity", ...)
```

It does not guard against `human_approved=True` when no human actually approved anything. The gate is bypassed silently. The semantically correct default for non-HITL runs is either `False` (most conservative — treat unreviewed runs as not human-approved) or a third value that the PO activity interprets as "HITL not required for this run". The current default of `True` defeats the purpose of the gate.

## `SettlementDispatchWorkflow` residual hardcoded verdict

`SettlementDispatchWorkflow.run()` at the PDF activity call:

```python
args=[{
    ...
    "audit_verdict": "APPROVED",
}],
```

This was not modified by the RUN-05 fix, which targeted only `MasterEPRComplianceWorkflow`. The standalone settlement sub-workflow will always stamp "APPROVED" on PDF audit reports regardless of the actual audit outcome passed into it via the `audit_verdict` parameter. The `audit_verdict` parameter is accepted by `SettlementDispatchWorkflow.run()` and forwarded to the PO activity correctly, but the PDF activity gets the hardcoded string.

## RUN-09 `auctions.py` missing `statutory_rate_per_kg` in Temporal dispatch args

`broadcast_rfp` passes `args=[company_id, category, float(target_tons)]` to `AuctionLiquidityWorkflow`. The `AuctionLiquidityWorkflow.run()` signature accepts `statutory_base_rate: float = 12.0` as a defaulted parameter. The validated `statutory_rate` from the payload is not threaded through to the Temporal dispatch. The `AuctionRecord` receives the correct value, but the workflow activity runs with the default `12.0` as the base rate regardless of what the caller supplied. The corridor computation and reserve price in the treasury agent both derive from `statutory_base_rate`, so the live clearing logic ignores the tenant-supplied rate entirely.

</details>

---

<details>
<summary>File map</summary>

| File | What changed |
|---|---|
| `packages/synthetiq-shared/synthetiq_shared/models/organization.py` | Added `mapping` and `secret_ref` to `DataSource`; added `ingestion_run_id` to `AuditRecord` with `to_dict()` coverage |
| `api/src/routes/runs.py` | Added `CreateRunRequest` model, nested params, `org_id` from tenant; added `result` to GET response; DISPATCH_FALLBACK 503 path |
| `worker/src/activities/agent_activities.py` | Result model fields made Optional; `_require()` gates preserved for gate-critical fields |
| `worker/src/activities/config_activities.py` | Added `"default"` branch for pack version; added `update_workflow_run_activity` |
| `worker/src/flows/workflows.py` | Stage chaining (RUN-05); `update_workflow_run_activity` calls at all lifecycle points (RUN-04); structured `final_result` (RUN-08); `_audit_verdict` from actual audit output |
| `worker/src/main.py` | `update_workflow_run_activity` added to activities list |
| `api/src/routes/liability.py` | `company_id` falls back to `tenant_ctx.org_id`; HTTP 400 guard; `TenantCtx` dependency added |
| `api/src/routes/auctions.py` | All four rate params required (HTTP 422); hardcoded numeric defaults removed; `company_id` from tenant |
| `api/src/routes/audit.py` | No changes in scope — `recycler_id` and `plant_id` validation pre-existed |
| `dashboard/app/lib/api.ts` | No changes — `{ type, params }` shape was already correct |

Full diff: `git diff main -- packages/synthetiq-shared api/src/routes/runs.py worker/src`

</details>
