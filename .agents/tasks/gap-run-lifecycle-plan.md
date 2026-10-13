# Implementation Plan — Gap Run Lifecycle (RUN-01 … RUN-09)

All gaps were grounded by reading the actual source files. No step requires the
implementer to re-read the codebase to resolve ambiguity.

---

## Pre-flight: what the migration already covers

Migration `e7f8a9b0c1d2_add_ingestion_runs.py`
(`packages/synthetiq-shared/alembic/versions/`) already adds:
- `data_sources.mapping` (JSON, nullable) ✓
- `data_sources.secret_ref` (String(256), nullable) ✓
- `audit_records.ingestion_run_id` (String, nullable) ✓

The migration is **correct**. The ORM model (`organization.py`) is **missing** those
three columns — that is the only database-layer work needed for RUN-01.

---

- [ ] 1. **RUN-01 — Add `mapping`, `secret_ref`, and `ingestion_run_id` to ORM models**

      The migration `e7f8a9b0c1d2` already covers the DB columns. The SQLAlchemy
      ORM models have not been updated to match, so any code that queries
      `DataSource.mapping` (e.g. `runs.py` preflight check at ~line 73) will
      raise an `AttributeError` at runtime.

      **`DataSource` class** (`packages/synthetiq-shared/synthetiq_shared/models/organization.py`,
      after the `last_sync_at` column, ~line 170):
      Add two new `Mapped` columns:
      ```python
      mapping: Mapped[dict | None] = mapped_column(JSON, nullable=True)
      secret_ref: Mapped[str | None] = mapped_column(String(256), nullable=True)
      ```

      **`AuditRecord` class** (same file, after the `triggered_by` column, ~line 286):
      Add:
      ```python
      ingestion_run_id: Mapped[str | None] = mapped_column(String(), nullable=True)
      ```

      Also update `AuditRecord.to_dict()` to include
      `"ingestion_run_id": self.ingestion_run_id` in the returned dict.

      Files:
      - `packages/synthetiq-shared/synthetiq_shared/models/organization.py`

      Verify: `cd packages/synthetiq-shared && python -c "from synthetiq_shared.models import DataSource, AuditRecord; ds = DataSource.__table__.columns; ar = AuditRecord.__table__.columns; assert 'mapping' in ds; assert 'secret_ref' in ds; assert 'ingestion_run_id' in ar; print('OK')"` — prints `OK`.

---

- [ ] 2. **RUN-02 — Nested `{type, params}` request shape and `org_id` from tenant**

      Currently `create_run` in `api/src/routes/runs.py` (~lines 125-180) reads
      flat keys directly from `payload` (`payload.get("company_id", …)` etc.) and
      allows `org_id` to come from the body. The dashboard `api.ts` at ~line 84
      already sends `{ type: "e2e_compliance", params: {...} }` — so the API and
      the client are **already misaligned**.

      **Step A — Add `CreateRunRequest` Pydantic model** near the top of
      `api/src/routes/runs.py` (before `router = APIRouter(…)`):
      ```python
      from pydantic import BaseModel

      class CreateRunRequest(BaseModel):
          type: str = "master_e2e_compliance"
          params: dict = {}
      ```

      **Step B — Replace `payload: dict[str, Any]` with `body: CreateRunRequest`**
      in the `create_run` signature. Derive params from `body.params`:
      ```python
      params = body.params
      run_input = RunInput(
          org_id=org_id,              # always from tenant_ctx, never body
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
      ```
      Remove the line `org_id = tenant_ctx.org_id or user.get("org_id", "")` that
      appears *after* `RunInput` construction (~line 155) — keep only the one that
      appears *before* it.

      **Step C — Dashboard `api.ts`** (~line 84, `runE2ECompliance`):
      The function body already sends `{ type: "e2e_compliance", params }` — this
      is correct. No change needed if the body already matches. Confirm and leave
      as-is; if any other caller still sends flat keys, update it to nest under
      `params`.

      Files:
      - `api/src/routes/runs.py`
      - `dashboard/app/lib/api.ts` (verify only — likely already correct)

      Verify: `cd api && python -m pytest tests/ -k "test_create_run" -q` — run
      creation tests pass. If no test exists, start the API with
      `uvicorn src.main:app --port 8000` and POST
      `{"type":"master_e2e_compliance","params":{"fiscal_year":"FY2025-26"}}`
      to `/api/v1/runs` with a valid token; confirm 202 response with `run_id`.

---

- [ ] 3. **RUN-03 — Make non-gate-critical Pydantic result fields Optional**

      In `worker/src/activities/agent_activities.py` the result models have
      required fields that LLM agents routinely omit, causing `ValidationError`
      and killing the workflow rather than surfacing a useful domain error.

      **`LiabilityResult`** (~line 28): make `gross_liability_tons` and `category`
      Optional with `None` default. `net_liability_tons` stays required (gate-critical).
      ```python
      class LiabilityResult(BaseModel):
          net_liability_tons: float
          gross_liability_tons: Optional[float] = None
          category: Optional[str] = None
      ```

      **`AuctionResult`** (~line 33): make `total_volume_tons` Optional.
      `clearing_price` and `winner_org_id` stay required.
      ```python
      class AuctionResult(BaseModel):
          clearing_price: float
          winner_org_id: str
          total_volume_tons: Optional[float] = None
      ```

      **`AuditResult`** (~line 38): make `physical_melt_verified`, `audit_id`,
      and `chain_head` Optional. `delta_percent` and `verdict` stay required.
      ```python
      class AuditResult(BaseModel):
          delta_percent: float
          verdict: Literal["PASS", "FAIL", "HITL"]
          physical_melt_verified: Optional[bool] = None
          audit_id: Optional[str] = None
          chain_head: str = ""
      ```

      **`POResult`** (~line 44): make `po_number`, `audit_verdict`,
      `advance_amount`, `holdback_amount` Optional. `po_id` and `escrow_amount`
      stay required.
      ```python
      class POResult(BaseModel):
          po_id: str
          escrow_amount: float
          po_number: Optional[str] = None
          audit_verdict: Optional[str] = None
          advance_amount: float = 0.0
          holdback_amount: float = 0.0
      ```

      **`Form1Result`** (~line 51): make `portal_status` and `pdf_path` Optional.
      `form1_id` stays required (gate-critical).
      ```python
      class Form1Result(BaseModel):
          form1_id: str
          signed: bool = False
          portal_status: Optional[str] = None
          pdf_path: str = ""
      ```

      Also add `from typing import Optional` at the top of the file if it isn't
      already imported (check: `Optional` is not currently imported there).

      Files:
      - `worker/src/activities/agent_activities.py`

      Verify: `cd worker && python -c "from activities.agent_activities import LiabilityResult, AuctionResult, AuditResult, POResult, Form1Result; LiabilityResult(net_liability_tons=10.0); AuditResult(delta_percent=0.01, verdict='PASS'); Form1Result(form1_id='F1'); print('OK')"` — prints `OK`.

---

- [ ] 4. **RUN-04 — Write back WorkflowRun status/result/hitl_required from the worker**

      `WorkflowRun` is written with `status="RUNNING"` by the API but is **never
      updated** by the worker. The worker has no activity that writes back to the
      DB. This means every run stays "RUNNING" forever in the dashboard.

      **Step A — Add `update_workflow_run_activity`** at the bottom of
      `worker/src/activities/config_activities.py`, after `fetch_run_config_activity`:
      ```python
      @activity.defn
      async def update_workflow_run_activity(
          run_id: str,
          status: str,
          result: dict | None = None,
          hitl_required: bool = False,
          error_message: str | None = None,
      ) -> None:
          """Write back WorkflowRun status, result, and hitl_required to the DB."""
          from datetime import datetime, timezone
          from sqlalchemy import select
          from synthetiq_shared.database import get_db_session
          from synthetiq_shared.models import WorkflowRun
          try:
              async with get_db_session() as session:
                  row = (await session.execute(
                      select(WorkflowRun).where(WorkflowRun.run_id == run_id)
                  )).scalar_one_or_none()
                  if row:
                      row.status = status
                      row.hitl_required = hitl_required
                      if result is not None:
                          row.result = result
                      if error_message is not None:
                          row.error_message = error_message
                      if status in ("SUCCESS_FULLY_COMPLIANT", "HALTED_DUE_TO_FRAUD",
                                    "FAILED", "CANCELLED"):
                          now = datetime.now(timezone.utc)
                          row.completed_at = now
                          if row.started_at:
                              row.duration_seconds = (now - row.started_at).total_seconds()
          except Exception as exc:
              # Log but don't fail the workflow over a DB write
              import logging
              logging.getLogger(__name__).warning(
                  f"update_workflow_run_activity failed for run_id={run_id}: {exc}"
              )
      ```

      **Step B — Call it from `MasterEPRComplianceWorkflow.run()`** in
      `worker/src/flows/workflows.py`. Add the import at the top of the
      `with workflow.unsafe.imports_passed_through():` block:
      ```python
      from activities.config_activities import (
          fetch_run_config_activity,
          update_workflow_run_activity,
      )
      ```
      Insert four calls to `update_workflow_run_activity` via
      `workflow.execute_activity(…, retry_policy=_RETRY, start_to_close_timeout=_TIMEOUT)`:

      1. **After Stage 0 config fetch** (just before Stage 1 comment, ~line 340):
         Call with `status="RUNNING", hitl_required=False`.
      2. **When `is_fraudulent` is True** (just after `self.current_status = "PENDING_HITL_REVIEW"`,
         ~line 403):
         Call with `status="PENDING_HITL_REVIEW", hitl_required=True`.
      3. **Inside the `not self.auditor_approved` early-return branch** (just before
         the `return {"status": "HALTED_DUE_TO_FRAUD", …}`, ~line 413):
         Call with `status="HALTED_DUE_TO_FRAUD", hitl_required=False,
         result=<the dict being returned>`.
      4. **At the very end of `run()`, just before `return {"status": "SUCCESS_FULLY_COMPLIANT", …}`**
         (~line 467): Call with `status="SUCCESS_FULLY_COMPLIANT", hitl_required=False,
         result=<the dict being returned>`.
      5. For failures, wrap the entire `run()` body in a `try/except ApplicationError`
         and in the except: call `update_workflow_run_activity` with
         `status="FAILED", error_message=str(exc)`, then re-raise.

      Note: the `run_id` is available as `run_input.run_id`.

      **Step C — Register the new activity in `worker/src/main.py`** in the
      `activities` list (~line 113):
      ```python
      from activities.config_activities import fetch_run_config_activity, update_workflow_run_activity
      # add to list:
      update_workflow_run_activity,
      ```

      Files:
      - `worker/src/activities/config_activities.py`
      - `worker/src/flows/workflows.py`
      - `worker/src/main.py`

      Verify: `cd worker && python -c "from activities.config_activities import update_workflow_run_activity; print('OK')"` — prints `OK`. Then confirm `update_workflow_run_activity` appears in the worker `activities` list by inspecting `main.py`.

---

- [ ] 5. **RUN-05 — Chain stage outputs (liability → auction → audit → PO gating)**

      In `MasterEPRComplianceWorkflow.run()` the stage outputs are collected but
      not threaded through downstream stages. Three specific breaks:

      **Break A — liability output not used for auction target volume**
      (~line 354, Stage 2b): `volume_tons` passed to the auction is the raw input
      value. Replace with `liability["net_liability_tons"] or volume_tons` so the
      auction targets the calculated net liability:
      ```python
      auction_target_tons = float(liability.get("net_liability_tons") or volume_tons)
      auction = await workflow.execute_activity(
          execute_double_auction_activity,
          args=[f"RFP-{company_id}", category, auction_target_tons,
                run_config.pack.base_rate_inr_per_kg],
          ...
      )
      ```

      **Break B — auction winner not passed to PO** (~line 430, Stage 4):
      `recycler_id` comes from `run_input.recycler_id` (the hard-coded or
      user-supplied value). Replace with auction winner:
      ```python
      effective_recycler_id = auction.get("winner_org_id") or recycler_id
      clearing_price = float(auction.get("clearing_price") or 7.8)
      po = await workflow.execute_activity(
          create_escrow_split_po_activity,
          args=[company_id, effective_recycler_id, audit["audit_id"],
                volume_tons, clearing_price, ...],
          ...
      )
      ```
      Also replace the existing `clearing_price = auction.get("clearing_price", 7.8)`
      line with the above (it already uses `auction.get` but keeps the hardcoded
      `7.8` default — remove that fallback; if clearing_price is None,
      `_require(auction, "clearing_price", "auction")` should have already raised).

      **Break C — audit verdict hardcoded as "APPROVED"** (~lines 438, 461):
      Two occurrences of the string literal `"APPROVED"`:
      1. `_audit_verdict: str = audit.get("audit_verdict", "APPROVED")` — this line
         is fine but should read from `audit["verdict"]` (the canonical AuditResult
         field) with no default fallback:
         ```python
         _audit_verdict: str = audit.get("verdict") or audit.get("audit_verdict", "")
         if not _audit_verdict:
             raise ApplicationError("FAIL_CLOSED: audit verdict missing", non_retryable=True)
         ```
      2. Inside the PDF activity args dict, `"audit_verdict": "APPROVED"` (~line 461)
         — replace with `"audit_verdict": _audit_verdict`.

      Files:
      - `worker/src/flows/workflows.py`

      Verify: Run the existing worker unit tests:
      `cd worker && python -m pytest tests/ -q` — all pass. If no tests cover the
      workflow, at minimum run `python -c "from flows.workflows import MasterEPRComplianceWorkflow; print('OK')"`.

---

- [ ] 6. **RUN-06 — HTTP 503 on Temporal unreachable, clean up orphan RUNNING record**

      `api/src/services/temporal_service.py` `start_workflow()` returns a dict
      with `"status": "TEMPORAL_UNAVAILABLE"` on any exception (~line 40). The
      `create_run` handler in `runs.py` already checks for
      `"DISPATCH_FALLBACK"` (~line 185) — but the service returns
      `"TEMPORAL_UNAVAILABLE"`, not `"DISPATCH_FALLBACK"`. The check never
      triggers, so an orphaned RUNNING record stays in the DB.

      **Step A — Fix the status string mismatch.** In
      `api/src/services/temporal_service.py` (~line 40), change the fallback
      status to match what `runs.py` checks:
      ```python
      return {
          "workflow_id": workflow_id,
          "status": "DISPATCH_FALLBACK",      # was "TEMPORAL_UNAVAILABLE"
          "error": str(e),
          "task_queue": task_queue,
      }
      ```

      **Step B — Verify the existing cleanup block in `runs.py` is complete.**
      The block at ~line 185-197 deletes the WorkflowRun and raises HTTP 503 — this
      logic is already correct. No further changes needed to `runs.py` once Step A
      is fixed.

      Alternative (if changing the service string is undesirable for other callers):
      In `runs.py` change the check from `"DISPATCH_FALLBACK"` to
      `"TEMPORAL_UNAVAILABLE"` instead. Either approach works; prefer fixing the
      service return value as it's the source of truth.

      Files:
      - `api/src/services/temporal_service.py`

      Verify: In a test environment with Temporal unreachable, POST to `/api/v1/runs`
      and confirm the response is HTTP 503 with `"Temporal unavailable"` in the
      detail, and that no RUNNING record exists in `workflow_runs` afterwards.

---

- [ ] 7. **RUN-07 — "default" pack version resolves to latest active pack**

      In `worker/src/activities/config_activities.py` `fetch_run_config_activity()`
      (~line 50), the query is:
      ```python
      select(RegulatoryPack)
      .where(RegulatoryPack.version == regulatory_pack_version)
      .where(RegulatoryPack.status == RegulatoryPackStatus.active.value)
      ```
      When `regulatory_pack_version == "default"` this query finds nothing and
      raises `ApplicationError("No active regulatory pack with version 'default'")`,
      blocking every run that doesn't specify an explicit version.

      **Replace** the pack query block (~lines 48-58) with:
      ```python
      if regulatory_pack_version == "default":
          pack_res = await session.execute(
              select(RegulatoryPack)
              .where(RegulatoryPack.status == RegulatoryPackStatus.active.value)
              .order_by(RegulatoryPack.approved_at.desc())
              .limit(1)
          )
      else:
          pack_res = await session.execute(
              select(RegulatoryPack)
              .where(RegulatoryPack.version == regulatory_pack_version)
              .where(RegulatoryPack.status == RegulatoryPackStatus.active.value)
          )
      pack = pack_res.scalar_one_or_none()
      if not pack:
          raise ApplicationError(
              f"No active regulatory pack found (version={regulatory_pack_version!r})",
              non_retryable=False,
          )
      ```

      Note: `RegulatoryPack` must have an `approved_at` column. Verify this exists
      in the model before adding the `order_by`. If `approved_at` is absent, fall
      back to ordering by `created_at` or the primary key.

      Files:
      - `worker/src/activities/config_activities.py`

      Verify: `cd worker && python -c "from activities.config_activities import fetch_run_config_activity; print('OK')"` — imports cleanly. Integration test: run the activity in a sandbox org where `regulatory_pack_version="default"` and confirm it returns a config rather than raising.

---

- [ ] 8. **RUN-08 — Workflow `run()` returns structured result from actual stage outputs**

      `MasterEPRComplianceWorkflow.run()` returns
      `{"status": "SUCCESS_FULLY_COMPLIANT", ...}` with all raw stage outputs
      nested, but no top-level structured summary that a caller (dashboard,
      `update_workflow_run_activity`, etc.) can read without digging into nested
      dicts. The `WorkflowRun.result` column also gets the full noisy dict.

      **At the end of `run()`, just before the final `return`** (~line 466):
      build a structured summary dict and use it as both the WorkflowRun result
      and the workflow return value:
      ```python
      # Determine overall status from stage outcomes
      _final_status = "SUCCESS_FULLY_COMPLIANT"
      if not audit.get("physical_melt_verified"):
          _final_status = "FAILED"

      summary = {
          "status": _final_status,
          "verdict": audit.get("verdict"),           # "PASS" / "FAIL" / "HITL"
          "form1_id": form1.get("form1_id"),
          "clearing_price": auction.get("clearing_price"),
          "net_liability_tons": liability.get("net_liability_tons"),
          "audit_id": audit.get("audit_id"),
          "po_id": po.get("po_id"),
      }
      ```
      Replace the existing final `return` dict's `"status"` hardcoded string
      with `summary["status"]`, and add the summary keys at the top level:
      ```python
      return {
          **summary,
          "message": "Master EPR Multi-Agent Saga completed.",
          "company_id": company_id, "category": category, "volume_tons": volume_tons,
          "liability": liability, "rules": rules, "auction": auction,
          "eway": eway, "audit": audit,
          "purchase_order": po, "statutory_form1": form1,
          "audit_report_pdf": pdf_res,
      }
      ```

      The `HALTED_DUE_TO_FRAUD` early-return path (~line 413) already returns a
      custom dict — change its `"status"` to `"FAILED"` for consistency with
      `_final_status` logic above (the existing `"HALTED_DUE_TO_FRAUD"` string can
      stay as a `"halt_reason"` key if desired, but `status` should be one of the
      known values the dashboard reads).

      Files:
      - `worker/src/flows/workflows.py`

      Verify: `cd worker && python -c "from flows.workflows import MasterEPRComplianceWorkflow; print('OK')"` — imports without error.

---

- [ ] 9. **RUN-09 — Remove hardcoded defaults from standalone routes**

      Three standalone routes have hardcoded defaults that bypass multi-tenancy:

      **A. `api/src/routes/liability.py`** `trigger_liability_calculation()`
      (~line 14):
      ```python
      company_id = payload.get("company_id", "COMP-IN-001")
      ```
      - Add `tenant_ctx: TenantCtx = Depends(get_tenant_ctx)` to the function
        signature (add matching imports at the top: `from src.utils.tenant import TenantCtx, get_tenant_ctx`).
      - Replace the `company_id` line with:
        ```python
        company_id = payload.get("company_id") or tenant_ctx.org_id
        if not company_id:
            raise HTTPException(status_code=400, detail="company_id required")
        ```

      **B. `api/src/routes/auctions.py`** `broadcast_rfp()` (~lines 62-65):
      Three hardcoded values passed to `AuctionRecord`:
      ```python
      statutory_rate_per_kg=12.0,
      floor_price_inr=3.6,
      ceiling_price_inr=12.0,
      ```
      And `company_id = payload.get("company_id", "COMP-IN-001")`.
      - Replace `company_id` line with:
        ```python
        company_id = payload.get("company_id") or tenant_ctx.org_id
        if not company_id:
            raise HTTPException(status_code=400, detail="company_id required")
        ```
      - Extract the rate params from the payload with no fallback default (required):
        ```python
        statutory_rate = payload.get("statutory_rate_per_kg")
        floor_price    = payload.get("floor_price_inr")
        ceiling_price  = payload.get("ceiling_price_inr")
        target_tons    = payload.get("target_tons")
        if any(v is None for v in [statutory_rate, floor_price, ceiling_price, target_tons]):
            raise HTTPException(
                status_code=422,
                detail="statutory_rate_per_kg, floor_price_inr, ceiling_price_inr, and target_tons are required",
            )
        ```
      - Pass `float(statutory_rate)`, `float(floor_price)`, `float(ceiling_price)`,
        `float(target_tons)` to `AuctionRecord(…)` and to
        `temporal_service.start_workflow(… args=[company_id, category, float(target_tons)])`.
      - Remove the old `target_tons = float(payload.get("target_tons", 1000.0))` line.

      **C. `api/src/routes/audit.py`** `trigger_fraud_audit()` (~lines 155-165):
      `recycler_id` and `plant_id` are already validated (empty-string check with
      HTTP 400). This is already correct. No change needed for audit.py for RUN-09
      (`volume_tons` still defaults to 250.0 — this is acceptable as a UI hint
      value, not a financial gate, so leaving it is fine).

      Files:
      - `api/src/routes/liability.py`
      - `api/src/routes/auctions.py`

      Verify:
      - `cd api && python -c "from src.routes.liability import router; from src.routes.auctions import router as ar; print('OK')"` — imports cleanly.
      - POST to `/api/v1/auctions/rfp` without `statutory_rate_per_kg` and confirm HTTP 422.
      - POST to `/api/v1/liability/calculate` without `company_id` as a brand owner and confirm the route uses `tenant_ctx.org_id`.

---

## Summary of files changed

| File | Gaps |
|---|---|
| `packages/synthetiq-shared/synthetiq_shared/models/organization.py` | RUN-01 |
| `api/src/routes/runs.py` | RUN-02 |
| `dashboard/app/lib/api.ts` | RUN-02 (verify only) |
| `worker/src/activities/agent_activities.py` | RUN-03 |
| `worker/src/activities/config_activities.py` | RUN-04, RUN-07 |
| `worker/src/flows/workflows.py` | RUN-04, RUN-05, RUN-08 |
| `worker/src/main.py` | RUN-04 |
| `api/src/services/temporal_service.py` | RUN-06 |
| `api/src/routes/liability.py` | RUN-09 |
| `api/src/routes/auctions.py` | RUN-09 |

**Migration** `packages/synthetiq-shared/alembic/versions/e7f8a9b0c1d2_add_ingestion_runs.py`
is already correct — no changes needed.
