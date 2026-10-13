# Implementation Plan — Phase 2 FEAT-003: Activity Hardening & Fail-Closed Gates

## Literals Scan Output (pre-implementation baseline)

```
worker\src\activities\agent_activities.py:224:  result.setdefault("cpcb_portal_status", result.get("portal_status", "CPCB_ACCEPTED"))
worker\src\agents\legal_agent.py:96:            "portal_status": "CPCB_ACCEPTED",
worker\src\agents\logistics_agent.py:61:        "brand_pibo": "COMP-IN-001",
worker\src\agents\orchestrator.py:79:    recycler_id: str = "RECYC-DELHI-01",
worker\src\agents\orchestrator.py:80:    plant_id: str = "PLANT-OKHLA-2",
worker\src\agents\treasury_agent.py:43:  "bid_id": "BID-01", "recycler_id": "RECYC-DELHI-01",
worker\src\services\pdf_generator.py:138: recycler_id = audit_data.get("recycler_id", "RECYC-DELHI-01")
worker\src\services\pdf_generator.py:139: plant_id = audit_data.get("plant_id", "PLANT-OKHLA-2")
api\src\services\temporal_service.py:52:  "status": "DISPATCH_FALLBACK",
worker\src\flows\workflows.py:249:  unit_price_inr: float = 7.5,
worker\src\flows\workflows.py:449:  clearing_price = auction.get("clearing_price_inr", 7.8)
```

> Files outside `worker/src/` and `api/src/services/temporal_service.py` (simulators,
> mocks, test fixtures, shared seed data) are **out of scope** for this plan.
> The literals in `scripts/`, `mocks/`, `packages/synthetiq-shared/synthetiq_shared/seed.py`,
> `simulator/`, and `mcp/` are test/demo data; they must NOT be changed here.

---

## Dependency order

Changes must be applied in this order to keep the codebase buildable at every step:

1. **C1** — add `import hashlib` (unblocks the existing `hashlib.sha256` call at line 228)
2. **C2** — add Pydantic result models in a new file (no other module depends on it yet)
3. **C3** — add `_require` helper and fix activity bodies (uses C2 models; must come after C2)
4. **C4** — add `RetryPolicy` + timeouts in `workflows.py` (touches only call-site kwargs)
5. **C5** — thread `org_id` through three activities and their call sites (signature change; after C3)
6. **C6** — literals cleanup across all remaining files (independent; safest last)

---

## Plan

- [ ] 1. **C1 — Add `import hashlib` to agent_activities.py**

      `generate_audit_report_pdf_activity` (line 228 of
      `worker/src/activities/agent_activities.py`) calls `hashlib.sha256(...)` but the
      module never imports `hashlib`. This causes a `NameError` at runtime.

      **What to do:** Insert `import hashlib` in the standard-library import block at the
      top of the file, directly after `import uuid` (current line 7). The full new import
      block becomes:

      ```python
      import hashlib
      import logging
      import uuid
      from typing import Any
      ```

      **Files:** `worker/src/activities/agent_activities.py` (top-of-file import block)

      **Verify:** `python -c "import sys; sys.path.insert(0,'worker/src'); import activities.agent_activities"`
      must succeed without `NameError`. Run from `c:\Users\HP\SynthetIQ\worker`.

---

- [ ] 2. **C2 — Define Pydantic activity result models**

      Create a new file `worker/src/models/activity_results.py`. Placing the models in a
      dedicated file (rather than inside `agent_activities.py`) keeps the activity module
      importable inside Temporal's `workflow.unsafe.imports_passed_through()` sandbox and
      matches the project's existing `worker/src/models/` directory (currently only
      `__init__.py`). The `worker/src/models/__init__.py` must be updated to re-export all
      six classes.

      **What to do:**

      Create `worker/src/models/activity_results.py` with exactly this content:

      ```python
      """Strict Pydantic result models for Temporal activity outputs.

      All fields are required (no defaults) except where noted.
      This prevents silent data loss when an LLM or agent returns an incomplete payload.
      """
      from __future__ import annotations

      from typing import Literal

      from pydantic import BaseModel


      class LiabilityResult(BaseModel):
          net_liability_tons: float          # required — no default
          gross_liability_tons: float        # required — no default
          category: str


      class AuctionResult(BaseModel):
          clearing_price: float              # required — no default
          winner_org_id: str                 # required — no hardcoded RECYC-DELHI-01
          total_volume_tons: float


      class AuditResult(BaseModel):
          delta_percent: float               # required — no default
          verdict: Literal["PASS", "FAIL", "HITL"]   # derived in Python, not from LLM
          physical_melt_verified: bool       # required — no default
          audit_id: str


      class POResult(BaseModel):
          po_id: str
          escrow_amount: float               # required — no default
          audit_verdict: str                 # carried from AuditResult, NOT hardcoded


      class Form1Result(BaseModel):
          form1_id: str
          signed: bool = False               # False OK — signing is Phase 5
          portal_status: str                 # required — must come from real integration


      class PDFResult(BaseModel):
          pdf_path: str
          hash_hex: str
      ```

      Update `worker/src/models/__init__.py`:

      ```python
      """Activity result models."""
      from .activity_results import (
          AuditResult,
          AuctionResult,
          Form1Result,
          LiabilityResult,
          PDFResult,
          POResult,
      )

      __all__ = [
          "LiabilityResult",
          "AuctionResult",
          "AuditResult",
          "POResult",
          "Form1Result",
          "PDFResult",
      ]
      ```

      **Files:**
      - `worker/src/models/activity_results.py` ← create
      - `worker/src/models/__init__.py` ← update

      **Verify:** `python -c "from models.activity_results import LiabilityResult, AuctionResult, AuditResult, POResult, Form1Result, PDFResult; print('OK')`
      run from `c:\Users\HP\SynthetIQ\worker\src`.

---

- [ ] 3. **C3 — Add `_require` helper and fix all activity fail-closed gates**

      Currently every activity uses `result.setdefault(...)` or hardcoded strings as
      fallbacks. These silent defaults let corrupted LLM output propagate undetected.
      Replace them with fail-closed raises using `ApplicationError` (Temporal's retryable
      exception type) so the worker retries on transient failures instead of silently
      continuing with bad data.

      **All edits are in `worker/src/activities/agent_activities.py`.**

      ### 3a — New imports at top of file

      After the existing `from temporalio import activity` line, add:

      ```python
      from temporalio.exceptions import ApplicationError
      ```

      ### 3b — Add `_require` helper function

      Add this module-level helper directly below the `logger = ...` line and before the
      first `@activity.defn`:

      ```python
      def _require(d: dict, key: str, activity_name: str):
          """Raise a retryable ApplicationError if key is absent or None in d."""
          if key not in d or d[key] is None:
              raise ApplicationError(
                  f"FAIL_CLOSED: {key} missing from {activity_name} result",
                  non_retryable=False,
              )
          return d[key]
      ```

      ### 3c — Fix `calculate_brand_liability_activity`

      The task calls this `calculate_liability_activity` in the spec; the actual function
      name in the file is `calculate_brand_liability_activity`. The fix is the same.

      After `result = await run_brand_liability_agent(...)` and before `result.setdefault(...)`,
      add:

      ```python
      _require(result, "net_liability_tons", "calculate_brand_liability_activity")
      ```

      Keep `result.setdefault("company_id", company_id)` — this sets an identifying field,
      not a required numeric result.

      ### 3d — Fix `execute_double_auction_activity`

      Replace the two `result.setdefault("clearing_price_inr", ...)` fallback lines with
      fail-closed guards. After `result = await run_treasury_agent(...)`:

      **Remove** this line (it silently sets a fabricated price):
      ```python
      result.setdefault("clearing_price_inr", result.get("clearing_price_inr", statutory_base_rate * 0.65))
      ```

      **Replace** with:
      ```python
      _require(result, "clearing_price_inr", "execute_double_auction_activity")
      _require(result, "rfp_id", "execute_double_auction_activity")
      result.setdefault("rfp_id", rfp_id)      # keep only non-numeric identity field
      result.setdefault("category", category)
      result.setdefault("cleared_tons", result.get("total_tons", target_tons))
      ```

      Note: `winner_org_id` is a concern in `AuctionResult` (C2 model) but
      `run_treasury_agent` uses `recycler_id` in its bid structure; do NOT add a key that
      the agent doesn't produce. The `_require` guard on `clearing_price_inr` is the
      critical fix here. A `winner_org_id` guard should only be added if the treasury
      agent returns that key — do not fabricate it.

      ### 3e — Fix `audit_scada_telemetry_activity`

      After `result = await run_auditor_agent(...)`:

      1. Add a fail-closed guard for `delta_mass` (the raw fractional form that the Jev
         auditor returns):
         ```python
         _require(result, "delta_mass", "audit_scada_telemetry_activity")
         ```

      2. **Compute the verdict in Python** — never trust the LLM string. Replace the
         existing `result.setdefault("physical_melt_verified", ...)` block with:
         ```python
         delta_percent = float(result["delta_mass"]) * 100.0   # delta_mass is fractional (0.02 = 2%)
         _HITL_THRESHOLD = 5.0    # >5% delta → HITL
         _FAIL_THRESHOLD = 2.0    # 2–5% delta → FAIL
         if delta_percent > _HITL_THRESHOLD:
             computed_verdict = "HITL"
         elif delta_percent > _FAIL_THRESHOLD:
             computed_verdict = "FAIL"
         else:
             computed_verdict = "PASS"
         result["verdict"] = computed_verdict      # overwrite whatever the LLM returned
         ```

      3. Keep the existing `result.setdefault("audit_id", ...)` and other identity
         `setdefault` calls — those are fine.

      ### 3f — Fix `create_escrow_split_po_activity`

      The current call passes hardcoded `audit_verdict="APPROVED"` and
      `human_approved=True`. These must be replaced with real values.

      Change the function signature to accept `audit_verdict` and `human_approved`
      as parameters (both required, no defaults):

      ```python
      @activity.defn
      async def create_escrow_split_po_activity(
          company_id: str,
          recycler_id: str,
          audit_id: str,
          plastic_tons: float,
          unit_price_inr: float,
          audit_verdict: str,        # required — from AuditResult.verdict
          human_approved: bool,      # required — from HITL signal result
      ) -> dict[str, Any]:
      ```

      Update the `run_erp_agent(...)` call inside the activity body to pass these
      parameters through:

      ```python
      result = await run_erp_agent(
          company_id=company_id,
          recycler_id=recycler_id,
          audit_id=audit_id,
          plastic_tons=plastic_tons,
          unit_price_inr=unit_price_inr,
          audit_verdict=audit_verdict,       # real value, not "APPROVED"
          logistics_verdict="APPROVE",
          human_approved=human_approved,     # real value, not True
      )
      ```

      Add a fail-closed guard after the call:
      ```python
      _require(result, "po_number", "create_escrow_split_po_activity")
      ```

      ### 3g — Fix `generate_and_dispatch_form1_activity`

      The existing line:
      ```python
      result.setdefault("cpcb_portal_status", result.get("portal_status", "CPCB_ACCEPTED"))
      ```
      silently sets `CPCB_ACCEPTED` even when the portal rejected the submission.

      Replace it with a fail-closed guard:
      ```python
      if not result.get("portal_status"):
          raise ApplicationError(
              "FAIL_CLOSED: portal_status absent from generate_and_dispatch_form1_activity result",
              non_retryable=False,
          )
      result.setdefault("cpcb_portal_status", result["portal_status"])   # copy real value
      ```

      Also remove the leftover `result.setdefault("cpcb_portal_status", ...)` line
      that currently reads `result.get("portal_status", "CPCB_ACCEPTED")`.

      ### 3h — Fix `generate_audit_report_pdf_activity` (depends on C1)

      No `setdefault` changes needed here. After C1 is applied, `hashlib.sha256` resolves
      correctly. The only addition is a return-value guard:

      ```python
      if not pdf_bytes:
          raise ApplicationError(
              "FAIL_CLOSED: pdf_generator returned empty bytes",
              non_retryable=False,
          )
      ```
      Insert this immediately after `pdf_bytes = generate_cpcb_form1_pdf(audit_payload)`.

      **Files:** `worker/src/activities/agent_activities.py`

      **Verify:**
      ```
      cd c:\Users\HP\SynthetIQ\worker
      python -c "
      import sys; sys.path.insert(0,'src')
      import activities.agent_activities as a
      assert hasattr(a, '_require')
      from temporalio.exceptions import ApplicationError
      import asyncio
      try:
          asyncio.run(a.create_escrow_split_po_activity('C','R','AUD',1.0,7.0,'PASS',True))
      except Exception:
          pass
      print('C3 guards importable OK')
      "
      ```

---

- [ ] 4. **C4 — Add `RetryPolicy` and minimum timeouts to all `execute_activity` calls in `workflows.py`**

      Currently none of the `workflow.execute_activity(...)` calls in
      `worker/src/flows/workflows.py` specify a `retry_policy`, so Temporal uses its
      default (unlimited retries). Additionally three calls in
      `SettlementDispatchWorkflow` and two in `UpstreamLiabilityWorkflow` /
      `AuctionLiquidityWorkflow` have no explicit timeout or use `_SHORT` /
      `_MEDIUM` which may already be adequate — only add where missing or where a call
      needs explicit capping.

      ### 4a — New imports

      Add to the top of `worker/src/flows/workflows.py` after `from datetime import timedelta`:

      ```python
      from temporalio.common import RetryPolicy
      ```

      The file already imports `timedelta`. `RetryPolicy` lives in `temporalio.common`.

      ### 4b — Standard kwargs block

      Add a module-level constant for the standard retry policy:

      ```python
      _RETRY = RetryPolicy(maximum_attempts=3)
      ```

      Place it with the other timeout constants (`_SHORT`, `_MEDIUM`, `_LONG`).

      ### 4c — Add `retry_policy=_RETRY` and ensure `start_to_close_timeout` on every call

      Touch every `workflow.execute_activity(...)` call site. The rule:
      - Add `retry_policy=_RETRY` to every call that lacks it (all of them currently).
      - The `start_to_close_timeout` must be at least `timedelta(minutes=5)` on every
        call. The current constants are `_SHORT=60s`, `_MEDIUM=120s`, `_LONG=180s` — all
        below 5 minutes. Change the constants to:

        ```python
        _SHORT  = timedelta(minutes=5)
        _MEDIUM = timedelta(minutes=5)
        _LONG   = timedelta(minutes=10)
        ```

        This is the least-invasive approach: update the three constants once rather than
        touching every individual call-site timeout argument.

      **Complete list of call sites that receive `retry_policy=_RETRY`** (13 total):

      In `UpstreamLiabilityWorkflow.run`:
      1. `parse_regulatory_rules_activity` call
      2. `calculate_brand_liability_activity` call

      In `AuctionLiquidityWorkflow.run`:
      3. `execute_double_auction_activity` call

      In `QuadCoreAuditWorkflow.run`:
      4. `verify_eway_bill_activity` call
      5. `audit_scada_telemetry_activity` call

      In `SettlementDispatchWorkflow.run`:
      6. `create_escrow_split_po_activity` call
      7. `generate_and_dispatch_form1_activity` call
      8. `generate_audit_report_pdf_activity` call

      In `MasterEPRComplianceWorkflow.run`:
      9.  `calculate_brand_liability_activity` call (stage 1)
      10. `parse_regulatory_rules_activity` call (stage 2a)
      11. `execute_double_auction_activity` call (stage 2b)
      12. `verify_eway_bill_activity` call (stage 3a)
      13. `audit_scada_telemetry_activity` call (stage 3b)
      14. `create_escrow_split_po_activity` call (stage 4)
      15. `generate_and_dispatch_form1_activity` call (stage 5)
      16. `generate_audit_report_pdf_activity` call (stage 6)

      **Files:** `worker/src/flows/workflows.py`

      **Verify:**
      ```
      cd c:\Users\HP\SynthetIQ\worker
      python -c "
      import sys; sys.path.insert(0,'src')
      from flows.workflows import MasterEPRComplianceWorkflow
      from temporalio.common import RetryPolicy
      print('C4 imports OK')
      "
      ```

---

- [ ] 5. **C5 — Thread `org_id` through three activities and their call sites**

      DB-writing activities currently have no `org_id` parameter, so records written to
      the database cannot be scoped to a tenant. This breaks row-level multi-tenancy.

      ### 5a — Activity signature changes in `agent_activities.py`

      Add `org_id: str` as a required parameter (no default) to these three activities:

      **`audit_scada_telemetry_activity`** — new signature:
      ```python
      async def audit_scada_telemetry_activity(
          recycler_id: str,
          plant_id: str,
          reported_volume_tons: float,
          torque_nm: float,
          power_factor: float,
          active_power_kw: float,
          vfd_frequency_hz: float,
          melt_rate_kg_h: float,
          org_id: str,                   # ← add here
          category: str = "cat_i_rigid",
      ) -> dict[str, Any]:
      ```

      Inside the body, after `result.setdefault("recycler_id", recycler_id)`, add:
      ```python
      result["org_id"] = org_id
      ```

      **`create_escrow_split_po_activity`** — new signature (extends the change from C3):
      ```python
      async def create_escrow_split_po_activity(
          company_id: str,
          recycler_id: str,
          audit_id: str,
          plastic_tons: float,
          unit_price_inr: float,
          audit_verdict: str,
          human_approved: bool,
          org_id: str,                   # ← add here
      ) -> dict[str, Any]:
      ```

      Inside the body, after `_require(result, "po_number", ...)`, add:
      ```python
      result["org_id"] = org_id
      ```

      **`generate_and_dispatch_form1_activity`** — new signature:
      ```python
      async def generate_and_dispatch_form1_activity(
          po_number: str,
          audit_id: str,
          physical_melt_tons: float,
          org_id: str,                   # ← add here
          conversion_factor: float = 1.0,
      ) -> dict[str, Any]:
      ```

      Inside the body, after `result.setdefault("ack_number", ...)`, add:
      ```python
      result["org_id"] = org_id
      ```

      ### 5b — Call-site updates in `workflows.py`

      All three call sites that invoke these activities must pass `run_input.org_id`.
      Only `MasterEPRComplianceWorkflow` has access to `RunInput`; the other workflows
      (`QuadCoreAuditWorkflow`, `SettlementDispatchWorkflow`) receive individual params.

      **`MasterEPRComplianceWorkflow.run` — three call sites:**

      Stage 3b `audit_scada_telemetry_activity` — change `args=[...]` to append `run_input.org_id`
      before `category`:
      ```python
      args=[
          recycler_id, plant_id, volume_tons,
          torque, pf, kw, 50.0, melt,
          run_input.org_id,   # ← add after melt, before category
          category,
      ],
      ```

      Stage 4 `create_escrow_split_po_activity` — add `audit_verdict` (from audit result),
      `human_approved` (from HITL signal), and `org_id` to `args`:
      ```python
      args=[
          company_id, recycler_id, audit["audit_id"], volume_tons, clearing_price,
          audit.get("verdict", "PASS"),    # audit_verdict from C3 computed verdict
          self.auditor_approved if self.auditor_approved is not None else True,
          run_input.org_id,               # org_id
      ],
      ```

      Stage 5 `generate_and_dispatch_form1_activity` — insert `run_input.org_id`:
      ```python
      args=[po["po_number"], audit["audit_id"], volume_tons, run_input.org_id, 1.0],
      ```

      **`QuadCoreAuditWorkflow.run`** — this workflow calls `audit_scada_telemetry_activity`
      but receives `recycler_id`, `plant_id`, etc. as individual params, not `RunInput`.
      Add `org_id: str = ""` to `QuadCoreAuditWorkflow.run`'s signature and pass it
      through to the activity args in the same position.

      **`SettlementDispatchWorkflow.run`** — calls `create_escrow_split_po_activity` and
      `generate_and_dispatch_form1_activity`. Add `org_id: str = ""` to
      `SettlementDispatchWorkflow.run`'s signature and pass it to both call sites.
      Also add `audit_verdict: str = "PASS"` and `human_approved: bool = True` to
      `SettlementDispatchWorkflow.run` so the required params from C3 are threaded through.

      **Files:**
      - `worker/src/activities/agent_activities.py`
      - `worker/src/flows/workflows.py`

      **Verify:**
      ```
      cd c:\Users\HP\SynthetIQ\worker
      python -c "
      import sys; sys.path.insert(0,'src')
      import inspect, activities.agent_activities as a
      sig = inspect.signature(a.audit_scada_telemetry_activity.fn if hasattr(a.audit_scada_telemetry_activity,'fn') else a.audit_scada_telemetry_activity)
      assert 'org_id' in sig.parameters, 'org_id missing from audit activity'
      sig2 = inspect.signature(a.create_escrow_split_po_activity.fn if hasattr(a.create_escrow_split_po_activity,'fn') else a.create_escrow_split_po_activity)
      assert 'org_id' in sig2.parameters, 'org_id missing from PO activity'
      sig3 = inspect.signature(a.generate_and_dispatch_form1_activity.fn if hasattr(a.generate_and_dispatch_form1_activity,'fn') else a.generate_and_dispatch_form1_activity)
      assert 'org_id' in sig3.parameters, 'org_id missing from form1 activity'
      print('C5 org_id signatures OK')
      "
      ```

---

- [ ] 6. **C6 — Full literals cleanup**

      Remove or replace all remaining hardcoded business values in the in-scope files.
      Changes are grouped by file.

      ### 6a — `worker/src/activities/agent_activities.py`

      **Line 224** — `generate_and_dispatch_form1_activity`:

      Remove: `result.setdefault("cpcb_portal_status", result.get("portal_status", "CPCB_ACCEPTED"))`
      This line is already replaced by the fail-closed guard in C3g; confirm it is gone.

      ### 6b — `worker/src/agents/legal_agent.py`

      **Line 96** in `dispatch_to_cpcb_portal` function:

      The mock return dict currently has `"portal_status": "CPCB_ACCEPTED"`. This is the
      **stub that will be replaced with a real CPCB API call in Phase 5**, but for now
      the stub must return a real-looking non-hardcoded sentinel so the fail-closed guard
      in C3g can distinguish "stub ran" from "field missing".

      Change:
      ```python
      "portal_status": "CPCB_ACCEPTED",
      ```
      To:
      ```python
      "portal_status": "CPCB_STUB_PENDING",
      ```
      This value is honest: the portal call is not yet real; it signals the stub ran but
      not that CPCB accepted it. The fail-closed guard in C3g will pass (field is present),
      and downstream display will correctly show `CPCB_STUB_PENDING` instead of a false
      `CPCB_ACCEPTED`.

      ### 6c — `worker/src/agents/treasury_agent.py`

      **Line 43** — mock bid dict hard-codes `"recycler_id": "RECYC-DELHI-01"`.

      The treasury agent's mock bid is produced inside the agent tool function. The
      `rfp_id` and `target_tons` are already injected at call time. Replace the hardcoded
      recycler in the bid with a placeholder that the real auction would populate:

      Change:
      ```python
      "bid_id": "BID-01", "recycler_id": "RECYC-DELHI-01",
      ```
      To:
      ```python
      "bid_id": "BID-01", "recycler_id": "MOCK_RECYCLER",
      ```

      **Rationale:** This is a mock fallback used only when the ADK agent doesn't return
      structured JSON. In production the ADK agent reply fills in a real recycler. The
      string `MOCK_RECYCLER` signals clearly that this is stub data.

      ### 6d — `worker/src/agents/orchestrator.py`

      **Lines 79–80** — default parameter values:

      ```python
      recycler_id: str = "RECYC-DELHI-01",
      plant_id: str = "PLANT-OKHLA-2",
      ```

      Remove the hardcoded defaults:
      ```python
      recycler_id: str,
      plant_id: str,
      ```

      Making these required (no default) ensures callers must always supply real values.
      If the orchestrator is also called from tests with the old defaults, those callers
      will need updating — check `worker/tests/` and `scripts/` for direct calls to
      `run_orchestrator` and pass explicit values.

      ### 6e — `worker/src/services/pdf_generator.py`

      **Lines 138–139** — fallback defaults in `generate_cpcb_form1_pdf`:

      ```python
      recycler_id = audit_data.get("recycler_id", "RECYC-DELHI-01")
      plant_id = audit_data.get("plant_id", "PLANT-OKHLA-2")
      ```

      Replace with fail-closed raises:
      ```python
      if not audit_data.get("recycler_id"):
          raise ValueError("FAIL_CLOSED: recycler_id missing from audit_data in pdf_generator")
      if not audit_data.get("plant_id"):
          raise ValueError("FAIL_CLOSED: plant_id missing from audit_data in pdf_generator")
      recycler_id = audit_data["recycler_id"]
      plant_id = audit_data["plant_id"]
      ```

      ### 6f — `worker/src/flows/workflows.py`

      **Line 449** in `MasterEPRComplianceWorkflow.run`:
      ```python
      clearing_price = auction.get("clearing_price_inr", 7.8)
      ```
      The `7.8` fallback silently substitutes a hardcoded price when the auction activity
      fails to return a clearing price. After C3d's `_require` guard is in place on the
      activity side, the workflow's fallback becomes dead code — but it is still a literal.

      Replace with a fail-closed guard in the workflow too:
      ```python
      if not auction.get("clearing_price_inr"):
          raise Exception("FAIL_CLOSED: clearing_price_inr absent from auction result")
      clearing_price = auction["clearing_price_inr"]
      ```

      **Line 249** in `SettlementDispatchWorkflow.run`:
      ```python
      unit_price_inr: float = 7.5,
      ```
      This default means a workflow caller that omits `unit_price_inr` silently uses 7.5.
      Make it required:
      ```python
      unit_price_inr: float,
      ```

      ### 6g — `api/src/services/temporal_service.py`

      **Line 52** in `start_workflow` exception handler:
      ```python
      "status": "DISPATCH_FALLBACK",
      ```

      `DISPATCH_FALLBACK` is an informal string that the caller in `api/src/routes/runs.py`
      (line 88) checks with `dispatch_result.get("status") == "DISPATCH_FALLBACK"`. The
      string itself is not wrong, but the plan specifies replacing it with a typed
      constant. The cleanest approach without adding a new dependency is a module-level
      constant:

      At the top of `api/src/services/temporal_service.py`, before the class:
      ```python
      TEMPORAL_UNAVAILABLE = "TEMPORAL_UNAVAILABLE"
      ```

      Change the exception return:
      ```python
      "status": TEMPORAL_UNAVAILABLE,
      ```

      Update the consumer in `api/src/routes/runs.py` line 88:
      ```python
      from src.services.temporal_service import TEMPORAL_UNAVAILABLE
      ...
      if dispatch_result.get("status") == TEMPORAL_UNAVAILABLE:
      ```

      **Files modified in C6:**
      - `worker/src/activities/agent_activities.py` (confirm C3g line removed)
      - `worker/src/agents/legal_agent.py`
      - `worker/src/agents/treasury_agent.py`
      - `worker/src/agents/orchestrator.py`
      - `worker/src/services/pdf_generator.py`
      - `worker/src/flows/workflows.py`
      - `api/src/services/temporal_service.py`
      - `api/src/routes/runs.py`

      **Verify:**
      ```powershell
      # From c:\Users\HP\SynthetIQ
      Get-ChildItem -Path "worker/src","api/src/services/temporal_service.py" -Recurse -Include "*.py" |
        Select-String -Pattern "RECYC-DELHI-01|PLANT-OKHLA-2|EWB-2026-99210|CPCB_ACCEPTED|DISPATCH_FALLBACK|clearing_price\s*=\s*7|awarded_recycler"
      ```
      Expected: zero matches.

      Additionally verify imports are intact:
      ```
      cd c:\Users\HP\SynthetIQ\worker
      python -c "
      import sys; sys.path.insert(0,'src')
      import activities.agent_activities
      import flows.workflows
      import services.pdf_generator
      print('C6 imports OK')
      "
      ```

---

## Summary of all files touched

| File | Changes |
|------|---------|
| `worker/src/activities/agent_activities.py` | C1 hashlib, C3 `_require`+fixes, C5 org_id params |
| `worker/src/models/activity_results.py` | C2 new file |
| `worker/src/models/__init__.py` | C2 re-exports |
| `worker/src/flows/workflows.py` | C4 RetryPolicy+timeouts, C5 org_id call sites, C6 literals |
| `worker/src/agents/legal_agent.py` | C6 CPCB_ACCEPTED stub |
| `worker/src/agents/treasury_agent.py` | C6 RECYC-DELHI-01 in mock bid |
| `worker/src/agents/orchestrator.py` | C6 default param literals |
| `worker/src/services/pdf_generator.py` | C6 fail-closed recycler_id/plant_id |
| `api/src/services/temporal_service.py` | C6 DISPATCH_FALLBACK → constant |
| `api/src/routes/runs.py` | C6 update DISPATCH_FALLBACK consumer |
