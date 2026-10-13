# Phase 3 Part B — Implementation Plan
## Items 8–15 from phase3-dynamic-config-plan.md

**Scope:** This plan covers Items 8–15 of the full Phase 3 plan. Items 1–7 (ORM models,
Alembic migration, new API routes) are assumed complete before any item here is executed.

---

## Exact codebase findings used in this plan

### Singleton pattern in each agent file

All seven agent files follow the same pattern: a module-level `create_llm_agent(...)` call
assigned to a snake_case variable, immediately after the `*_INSTRUCTION` constant.

| File | Variable name | `create_llm_agent(...)` call arguments |
|---|---|---|
| `auditor_agent.py` | `auditor_agent` | `name="auditor_agent"`, `instruction=AUDITOR_INSTRUCTION`, `tools=[fetch_scada_telemetry, evaluate_scada_signature]`, `description="SCADA telemetry fraud detection via Nimble System 1 / Jev ensemble"`, `output_key="audit_result"` |
| `brand_liability_agent.py` | `brand_liability_agent` | `name="brand_liability_agent"`, `instruction=BRAND_LIABILITY_INSTRUCTION`, `tools=[query_erp_sales, get_historic_debt, calculate_amortization]`, `description="Calculates EPR plastic-waste liability from ERP sales + 1/3 amortization rule"`, `output_key="liability_result"` |
| `erp_agent.py` | `erp_agent` | `name="erp_agent"`, `instruction=ERP_INSTRUCTION`, `tools=[validate_po_conditions, create_purchase_order]`, `description="Creates 80/20 split escrow purchase order after validating audit and logistics verdicts"`, `output_key="po_result"` |
| `legal_agent.py` | `legal_agent` | `name="legal_agent"`, `instruction=LEGAL_INSTRUCTION`, `tools=[apply_conversion_factor, sign_form1_dsc, dispatch_to_cpcb_portal]`, `description="Generates, DSC-signs, and submits CPCB Form-1 for EPR credit registration"`, `output_key="form1_result"` |
| `logistics_agent.py` | `logistics_agent` | `name="logistics_agent"`, `instruction=LOGISTICS_INSTRUCTION`, `tools=[verify_eway_bill, scan_qr_packaging_ledger, assess_logistics_risk]`, `description="Verifies material origin and transportation via E-Way bills and QR packaging ledger"`, `output_key="logistics_result"` |
| `regulatory_agent.py` | `regulatory_agent` | `name="regulatory_watchdog_agent"`, `instruction=REGULATORY_INSTRUCTION`, `tools=[fetch_cpcb_gazette, extract_conversion_factors]`, `description="Parses CPCB gazette notifications into structured EPR conversion factors and deadlines"`, `output_key="regulatory_rules"` |
| `treasury_agent.py` | `treasury_agent` | `name="treasury_agent"`, `instruction=TREASURY_INSTRUCTION`, `tools=[compute_statutory_corridor, fetch_recycler_bids, validate_price_corridor]`, `description="Runs the continuous double auction within the statutory price corridor"`, `output_key="auction_result"` |

### Exact lines in workflows.py that change (MasterEPRComplianceWorkflow.run)

- **Stage 2b — hardcoded `12.0`** (line ~line 290 in the file):
  ```python
  args=[f"RFP-{company_id}", category, volume_tons, 12.0],
  ```
  Change `12.0` → `run_config.pack.base_rate_inr_per_kg`.

- **Stage 3b — `audit_scada_telemetry_activity` args list** (line ~line 305):
  ```python
  args=[
      recycler_id, plant_id, volume_tons,
      torque, pf, kw, 50.0, melt, category,
      run_input.org_id,
  ],
  ```
  Add `run_config.pack.delta_threshold_default` as the last positional arg (after `run_input.org_id`).
  The `audit_scada_telemetry_activity` signature also changes in Item 10 to accept `delta_threshold`.

- **Stage 5 — hardcoded `1.0` conversion factor** (line ~line 330):
  ```python
  args=[po["po_number"], audit["audit_id"], volume_tons, 1.0, run_input.org_id],
  ```
  Replace with:
  ```python
  cf = run_config.pack.conversion_factors.get(category, 1.0)
  args=[po["po_number"], audit["audit_id"], volume_tons, cf, run_input.org_id]
  ```

- **`fiscal_year` assignment** (at top of `run()`, after extracting fields from `run_input`):
  The current code reads `fiscal_year = run_input.fiscal_year` directly. Replace with the
  dynamic derivation block described in Item 9c.

### Exact lines in agent_activities.py that need delta_threshold

`audit_scada_telemetry_activity` signature (line ~line 166):
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
    category: str = "cat_i_rigid",
    org_id: str = "",
) -> dict[str, Any]:
```
Add `delta_threshold: float = 2.0` after `org_id: str = ""`.

Inside the activity, line ~line 203:
```python
threshold = result.get("threshold", 2.0)
```
Change to:
```python
threshold = result.get("threshold", delta_threshold)
```

### Hardcoded values for the literal cleanup

| File | Current hardcoded value | Location in file | Replacement |
|---|---|---|---|
| `api/src/routes/agent_config.py` | `sample.get("fiscal_year", "FY2026-27")` | `test_agent_with_dynamic_data`, brand_liability branch (~line 221) | `sample.get("fiscal_year", "")` + raise 422 if empty |
| `api/src/routes/agent_config.py` | `agent_cfg.parameters.get("historical_debt_default_tons", 3600.0)` | same function (~line 230) | `agent_cfg.parameters.get("historical_debt_default_tons")` + raise 422 if None |
| `api/src/routes/organizations.py` | `fiscal_year="FY2026-27"` | `preview_data_source` else-branch (~line 412) | `fiscal_year=""` |
| `api/src/routes/liability.py` | `payload.get("fiscal_year", "FY2026-27")` | `trigger_liability_calculation` (~line 19) | `payload.get("fiscal_year", "")` |
| `api/src/routes/liability.py` | `fiscal_year: str = "FY2026-27"` | `get_liability_report` query param (~line 33) | `fiscal_year: str = ""` |
| `packages/synthetiq-shared/synthetiq_shared/seed.py` | `"target_fiscal_year": "FY2026-27"` | `DEFAULT_AGENTS_CONFIG`, brand_liability parameters dict (~line 69) | Remove the key entirely |
| `packages/synthetiq-shared/synthetiq_shared/seed.py` | `"historical_debt_default_tons": 3600.0` | same dict (~line 71) | Remove the key entirely |
| `packages/synthetiq-shared/synthetiq_shared/seed.py` | `"statutory_base_rate_inr": 12.0` | `DEFAULT_AGENTS_CONFIG`, regulatory_watchdog parameters dict (~line 83) | Remove the key entirely |
| `worker/src/services/ai_service.py` | `"fiscal_year": "FY2026-27"` | Inside `extract_regulatory_rules` LLM prompt JSON template (~line 193) | `"fiscal_year": ""` |
| `worker/src/services/scheduler_service.py` | `params.get("fiscal_year", "FY2026-27")` | `_trigger_workflow` payload dict (~line 295) | `params.get("fiscal_year", "")` |
| `dashboard/app/agents/page.tsx` | `config?.gemini?.model \|\| "Gemini 3.8 Flash"` | System 2 Reasoning card (~line 107) | `config?.gemini?.model \|\| "—"` |

---

## Implementation Plan

- [ ] 8. Create `worker/src/activities/config_activities.py` — `fetch_run_config_activity`.
      Create a new file. The activity opens a DB session, queries the active `RegulatoryPack`
      by version + status="active", builds `OrgPolicySnapshot` (defaulting all fields if no
      `OrgPolicy` row exists), queries date-filtered `PlantCalibration` rows, queries all
      `ObligationLedger` rows for the org, assembles a `RunConfig`, and returns
      `run_config.model_dump()`.

      **Exact import block at the top of the new file:**
      ```python
      from __future__ import annotations
      from datetime import date
      from temporalio import activity
      from temporalio.exceptions import ApplicationError
      from sqlalchemy import select
      from synthetiq_shared.database import get_db_session
      from synthetiq_shared.models import RegulatoryPack, OrgPolicy, PlantCalibration, ObligationLedger
      from synthetiq_shared.models.dynamic_config import (
          RegulatoryPackPayload, OrgPolicySnapshot,
          PlantCalibrationSnapshot, ObligationLedgerEntry, RunConfig,
      )
      ```

      **Activity signature:**
      ```python
      @activity.defn
      async def fetch_run_config_activity(org_id: str, regulatory_pack_version: str) -> dict:
      ```

      **OrgPolicy default** (when no row exists):
      ```python
      OrgPolicySnapshot(
          approval_threshold_tons=0.0,
          categories_in_scope=[],
          signatory_name=None,
          signatory_designation=None,
          timezone="Asia/Kolkata",
      )
      ```

      **PlantCalibration query filter:**
      ```python
      .where(PlantCalibration.org_id == org_id)
      .where(PlantCalibration.valid_from <= today)
      .where((PlantCalibration.valid_to == None) | (PlantCalibration.valid_to >= today))
      ```

      Files: `worker/src/activities/config_activities.py`
      Verify: `cd worker && python -c "from src.activities.config_activities import fetch_run_config_activity; print('ok')"` — exits 0.

- [ ] 9. Wire `fetch_run_config_activity` into `MasterEPRComplianceWorkflow.run()` in `workflows.py`.
      This item has five sub-changes to the single method. Apply them all together so the file
      stays in a buildable state.

      **9a — Add import inside `with workflow.unsafe.imports_passed_through()` block**
      (after the existing imports from `src.activities.agent_activities`):
      ```python
      from src.activities.config_activities import fetch_run_config_activity
      ```

      **9b — Insert Stage 0 block** immediately before the `# ---- Stage 1` comment,
      after the field-extraction lines (`company_id = run_input.company_id` etc.):
      ```python
      # ---- Stage 0: Fetch run config (regulatory pack + org policy + calibrations) ----
      self.stage_reached = 0
      self.current_status = "STAGE_0_FETCHING_RUN_CONFIG"
      run_config_dict = await workflow.execute_activity(
          fetch_run_config_activity,
          args=[run_input.org_id, run_input.regulatory_pack_version],
          retry_policy=_RETRY,
          start_to_close_timeout=_TIMEOUT,
      )
      from synthetiq_shared.models.dynamic_config import RunConfig as _RunConfig
      run_config = _RunConfig(**run_config_dict)
      ```

      **9c — Replace the `fiscal_year` assignment** (currently `fiscal_year = run_input.fiscal_year`):
      ```python
      if run_input.fiscal_year:
          fiscal_year = run_input.fiscal_year
      else:
          from datetime import date as _date
          today = workflow.now().date()  # deterministic Temporal clock
          fy_start_month = run_config.pack.fiscal_year_start_month
          if today.month >= fy_start_month:
              fiscal_year = f"FY{today.year}-{str(today.year + 1)[2:]}"
          else:
              fiscal_year = f"FY{today.year - 1}-{str(today.year)[2:]}"
      ```

      **9d — Replace hardcoded `12.0`** in Stage 2b `execute_double_auction_activity` args:
      Change `args=[f"RFP-{company_id}", category, volume_tons, 12.0]`
      to `args=[f"RFP-{company_id}", category, volume_tons, run_config.pack.base_rate_inr_per_kg]`.

      **9e — Replace hardcoded `1.0`** in Stage 5 `generate_and_dispatch_form1_activity` args:
      Before the activity call, add:
      ```python
      cf = run_config.pack.conversion_factors.get(category, 1.0)
      ```
      Change `args=[po["po_number"], audit["audit_id"], volume_tons, 1.0, run_input.org_id]`
      to `args=[po["po_number"], audit["audit_id"], volume_tons, cf, run_input.org_id]`.

      **Note on 9f (delta_threshold in Stage 3b):** do NOT add the extra arg to
      `audit_scada_telemetry_activity` args list yet — the activity signature does not
      accept it until Item 10 is done. Item 10 makes both changes atomically.

      Files: `worker/src/flows/workflows.py`
      Verify: `cd worker && python -c "from src.flows.workflows import MasterEPRComplianceWorkflow; print('ok')"` — exits 0.

- [ ] 10. Add `delta_threshold` parameter to `audit_scada_telemetry_activity` and thread it through `run_auditor_agent`.
       Three coordinated changes across two files — apply as one atomic edit.

       **Change A — `worker/src/activities/agent_activities.py`:**
       Add `delta_threshold: float = 2.0` as a new parameter to
       `audit_scada_telemetry_activity` immediately after `org_id: str = ""`:
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
           category: str = "cat_i_rigid",
           org_id: str = "",
           delta_threshold: float = 2.0,   # NEW
       ) -> dict[str, Any]:
       ```
       Then pass it to the auditor runner:
       ```python
       result = await run_auditor_agent(
           ...
           threshold=delta_threshold,   # NEW kwarg
       )
       ```
       Also change the threshold line in the verdict logic from:
       ```python
       threshold = result.get("threshold", 2.0)
       ```
       to:
       ```python
       threshold = result.get("threshold", delta_threshold)
       ```

       **Change B — `worker/src/agents/auditor_agent.py`:**
       Add `threshold: float = 2.0` to `run_auditor_agent`'s signature:
       ```python
       async def run_auditor_agent(
           recycler_id: str,
           ...
           category: str = "cat_i_rigid",
           threshold: float = 2.0,   # NEW
           session_id: str | None = None,
       ) -> dict[str, Any]:
       ```
       In the fallback `evaluate_scada_signature` call at the bottom of `run_auditor_agent`,
       the function does not currently accept a `threshold` argument — no change needed there.
       However, include `"threshold": threshold` in the fallback return dict so the activity
       can read it:
       ```python
       fallback = evaluate_scada_signature(...)
       fallback.setdefault("threshold", threshold)
       return fallback
       ```

       **Change C — `worker/src/flows/workflows.py` (Stage 3b):**
       Add `run_config.pack.delta_threshold_default` to the `audit_scada_telemetry_activity`
       args list as the final element (after `run_input.org_id`):
       ```python
       args=[
           recycler_id, plant_id, volume_tons,
           torque, pf, kw, 50.0, melt, category,
           run_input.org_id,
           run_config.pack.delta_threshold_default,   # NEW
       ],
       ```

       Files: `worker/src/activities/agent_activities.py`, `worker/src/agents/auditor_agent.py`,
              `worker/src/flows/workflows.py`
       Verify:
       ```
       cd worker && python -c "
       from src.activities.agent_activities import audit_scada_telemetry_activity
       import inspect
       sig = inspect.signature(audit_scada_telemetry_activity.fn)
       assert 'delta_threshold' in sig.parameters
       print('ok')
       "
       ```
       Also: `cd worker && python -c "from src.flows.workflows import MasterEPRComplianceWorkflow; print('ok')"` — exits 0.

- [ ] 11. Create `worker/src/factories/agent_factory.py` and `worker/src/factories/__init__.py`.
       Create the `factories/` package with an empty `__init__.py`, then write `agent_factory.py`.

       **Key constants at module level:**
       ```python
       ALLOWED_MODEL_IDS = frozenset(["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"])
       FORBIDDEN_PROMPT_KEYWORDS = frozenset(["verdict=", "always_pass", "skip_gate"])
       ```

       **`create_agent(agent_name, org_id, run_id) -> Any`** (async):
       - Opens `get_db_session()`, queries `AgentConfiguration` where `org_id == org_id`,
         `agent_name == agent_name`, `is_active == True`.
       - If a config row is found: validates `model_name` against `ALLOWED_MODEL_IDS`
         (falls back to `"gemini-2.0-flash"` with a `logger.warning` if invalid),
         takes `temperature` from the row, validates `system_prompt` against
         `FORBIDDEN_PROMPT_KEYWORDS` (ignores the prompt with a `logger.warning` if any match).
       - Calls `_build_agent(agent_name, model_id, temperature, system_prompt)`.

       **`_build_agent(agent_name, model_id, temperature, system_prompt) -> Any`** (sync):
       - Internal `_REGISTRY` dict maps the seven agent names to private `_build_X` functions.
       - Each `_build_X` imports the canonical `*_INSTRUCTION` and tools list from the
         corresponding `agents/*.py` file and calls `create_llm_agent(...)` passing
         `model=model_id` and `instruction=(system_prompt if system_prompt else CANONICAL_INSTRUCTION)`.
       - Agent name keys in `_REGISTRY`:
         `"auditor"`, `"brand_liability"`, `"regulatory_watchdog"`, `"treasury"`,
         `"logistics"`, `"erp"`, `"legal"`.

       **Per-agent `_build_X` import patterns** (use the exact variable names confirmed above):
       ```python
       # _build_auditor
       from agents.auditor_agent import AUDITOR_INSTRUCTION
       from agents.auditor_agent import fetch_scada_telemetry, evaluate_scada_signature
       return create_llm_agent(name="auditor_agent", instruction=..., tools=[...],
                               description="...", output_key="audit_result")

       # _build_brand_liability
       from agents.brand_liability_agent import BRAND_LIABILITY_INSTRUCTION
       from agents.brand_liability_agent import query_erp_sales, get_historic_debt, calculate_amortization
       return create_llm_agent(name="brand_liability_agent", ...)

       # _build_regulatory
       from agents.regulatory_agent import REGULATORY_INSTRUCTION
       from agents.regulatory_agent import fetch_cpcb_gazette, extract_conversion_factors
       return create_llm_agent(name="regulatory_watchdog_agent", ...)

       # _build_treasury
       from agents.treasury_agent import TREASURY_INSTRUCTION
       from agents.treasury_agent import compute_statutory_corridor, fetch_recycler_bids, validate_price_corridor
       return create_llm_agent(name="treasury_agent", ...)

       # _build_logistics
       from agents.logistics_agent import LOGISTICS_INSTRUCTION
       from agents.logistics_agent import verify_eway_bill, scan_qr_packaging_ledger, assess_logistics_risk
       return create_llm_agent(name="logistics_agent", ...)

       # _build_erp
       from agents.erp_agent import ERP_INSTRUCTION
       from agents.erp_agent import validate_po_conditions, create_purchase_order
       return create_llm_agent(name="erp_agent", ...)

       # _build_legal
       from agents.legal_agent import LEGAL_INSTRUCTION
       from agents.legal_agent import apply_conversion_factor, sign_form1_dsc, dispatch_to_cpcb_portal
       return create_llm_agent(name="legal_agent", ...)
       ```

       Files: `worker/src/factories/__init__.py`, `worker/src/factories/agent_factory.py`
       Verify: `cd worker && python -c "import asyncio; from src.factories.agent_factory import create_agent; print('ok')"` — exits 0.

- [ ] 12. Replace module-level agent singletons with per-call local variables in all seven agent files.
       Apply the same transformation to all seven files. For each file:
       1. **Remove** the module-level singleton assignment (the `X_agent = create_llm_agent(...)` block).
       2. **Add** a `agent = create_llm_agent(...)` local variable at the **top** of the
          corresponding `run_*_agent()` function body, passing the identical arguments that
          were in the removed singleton. The `*_INSTRUCTION` constant, tools list, description
          string, and output_key must stay the same.
       3. **Update** all references inside the `run_*_agent` function body: replace the module-level
          name (e.g. `auditor_agent`, `brand_liability_agent`) with the local `agent` variable.

       **Exact variable name → runner function mapping:**

       | File | Singleton to remove | Runner function to update | Variable name in runner |
       |---|---|---|---|
       | `auditor_agent.py` | `auditor_agent = create_llm_agent(...)` | `run_auditor_agent` | `agent = create_llm_agent(name="auditor_agent", ...)` |
       | `brand_liability_agent.py` | `brand_liability_agent = create_llm_agent(...)` | `run_brand_liability_agent` | `agent = create_llm_agent(name="brand_liability_agent", ...)` |
       | `erp_agent.py` | `erp_agent = create_llm_agent(...)` | `run_erp_agent` | `agent = create_llm_agent(name="erp_agent", ...)` |
       | `legal_agent.py` | `legal_agent = create_llm_agent(...)` | `run_legal_agent` | `agent = create_llm_agent(name="legal_agent", ...)` |
       | `logistics_agent.py` | `logistics_agent = create_llm_agent(...)` | `run_logistics_agent` | `agent = create_llm_agent(name="logistics_agent", ...)` |
       | `regulatory_agent.py` | `regulatory_agent = create_llm_agent(...)` | `run_regulatory_agent` | `agent = create_llm_agent(name="regulatory_watchdog_agent", ...)` |
       | `treasury_agent.py` | `treasury_agent = create_llm_agent(...)` | `run_treasury_agent` | `agent = create_llm_agent(name="treasury_agent", ...)` |

       **What must NOT change:**
       - All `*_INSTRUCTION` string constants remain at module level unchanged.
       - All tool function definitions remain at module level unchanged.
       - The `output_key` argument must be preserved in the local `create_llm_agent(...)` call.
       - The `run_agent(agent=..., ...)` call inside each runner must switch from the old
         module-level name to the new local `agent` variable.

       **In `auditor_agent.py` specifically:** the fallback call at the bottom of
       `run_auditor_agent` uses the bare `evaluate_scada_signature(...)` function directly
       (not `agent`), so no change needed there beyond what Item 10 already introduced.

       Files: `worker/src/agents/auditor_agent.py`, `worker/src/agents/brand_liability_agent.py`,
              `worker/src/agents/erp_agent.py`, `worker/src/agents/legal_agent.py`,
              `worker/src/agents/logistics_agent.py`, `worker/src/agents/regulatory_agent.py`,
              `worker/src/agents/treasury_agent.py`
       Verify:
       ```
       cd worker && python -c "
       from agents.auditor_agent import AUDITOR_INSTRUCTION, run_auditor_agent
       from agents.brand_liability_agent import BRAND_LIABILITY_INSTRUCTION, run_brand_liability_agent
       from agents.treasury_agent import TREASURY_INSTRUCTION, run_treasury_agent
       from agents.regulatory_agent import REGULATORY_INSTRUCTION, run_regulatory_agent
       from agents.erp_agent import ERP_INSTRUCTION, run_erp_agent
       from agents.legal_agent import LEGAL_INSTRUCTION, run_legal_agent
       from agents.logistics_agent import LOGISTICS_INSTRUCTION, run_logistics_agent
       print('ok')
       "
       ```
       This confirms all `*_INSTRUCTION` constants remain importable after singleton removal.

- [ ] 13. Remove hardcoded demo defaults from API routes and seed file.
       Four files, applied together because they are all independent changes with no
       cross-dependency.

       **`api/src/routes/agent_config.py`** — `test_agent_with_dynamic_data`, brand_liability branch:

       Change (line ~221):
       ```python
       fiscal_year = sample.get("fiscal_year", "FY2026-27")
       ```
       To:
       ```python
       fiscal_year = sample.get("fiscal_year", "")
       if not fiscal_year:
           raise HTTPException(
               status_code=422,
               detail="fiscal_year is required in sample_input for brand_liability test",
           )
       ```

       Change (line ~230):
       ```python
       historic_debt = agent_cfg.parameters.get("historical_debt_default_tons", 3600.0)
       ```
       To:
       ```python
       historic_debt = agent_cfg.parameters.get("historical_debt_default_tons")
       if historic_debt is None:
           raise HTTPException(
               status_code=422,
               detail="historical_debt_default_tons not configured for this agent",
           )
       ```

       **`api/src/routes/organizations.py`** — `preview_data_source` else-branch (line ~412):

       Change:
       ```python
       records = await connector.query_sales_data(company_id=org_id, fiscal_year="FY2026-27")
       ```
       To:
       ```python
       records = await connector.query_sales_data(company_id=org_id, fiscal_year="")
       ```

       **`api/src/routes/liability.py`** — two separate occurrences:

       Change in `trigger_liability_calculation` (line ~19):
       ```python
       fiscal_year = payload.get("fiscal_year", "FY2026-27")
       ```
       To:
       ```python
       fiscal_year = payload.get("fiscal_year", "")
       ```

       Change in `get_liability_report` query param (line ~33):
       ```python
       fiscal_year: str = "FY2026-27",
       ```
       To:
       ```python
       fiscal_year: str = "",
       ```

       **`packages/synthetiq-shared/synthetiq_shared/seed.py`** — `DEFAULT_AGENTS_CONFIG`:

       In the `brand_liability` entry's `"parameters"` dict, remove exactly these two keys:
       ```python
       "target_fiscal_year": "FY2026-27",     # REMOVE
       "historical_debt_default_tons": 3600.0, # REMOVE
       ```
       The remaining keys (`"amortization_fraction": 0.333` and
       `"categories": [...]`) stay unchanged.

       In the `regulatory_watchdog` entry's `"parameters"` dict, remove exactly this key:
       ```python
       "statutory_base_rate_inr": 12.0,   # REMOVE
       ```
       The remaining keys (`"jurisdiction"` and `"active_framework"`) stay unchanged.

       Files: `api/src/routes/agent_config.py`, `api/src/routes/organizations.py`,
              `api/src/routes/liability.py`,
              `packages/synthetiq-shared/synthetiq_shared/seed.py`
       Verify: In PowerShell from the repo root:
       ```powershell
       Get-ChildItem api/src,packages/synthetiq-shared/synthetiq_shared -Recurse -Include "*.py" |
           Select-String -Pattern '"FY2026-27"|historical_debt_default_tons|target_fiscal_year|"statutory_base_rate_inr"' |
           Where-Object { $_.Line -notmatch '#' }
       ```
       Expected: zero matches (no production-code occurrences remain; test fixtures are outside these paths).

- [ ] 14. Remove hardcoded `"FY2026-27"` from worker services.
       Two files, independent changes.

       **`worker/src/services/ai_service.py`** — inside `extract_regulatory_rules` method,
       the prompt JSON template (line ~193):

       Change:
       ```python
       "fiscal_year": "FY2026-27",
       ```
       To:
       ```python
       "fiscal_year": "",
       ```
       This is inside the f-string / prompt literal for the LLM — the change removes the
       hardcoded year from the example JSON the model is instructed to produce.

       **`worker/src/services/scheduler_service.py`** — `_trigger_workflow` payload dict (line ~295):

       Change:
       ```python
       "fiscal_year": params.get("fiscal_year", "FY2026-27"),
       ```
       To:
       ```python
       "fiscal_year": params.get("fiscal_year", ""),
       ```

       Files: `worker/src/services/ai_service.py`, `worker/src/services/scheduler_service.py`
       Verify:
       ```powershell
       Get-ChildItem worker/src -Recurse -Include "*.py" |
           Select-String -Pattern '"FY2026-27"' |
           Where-Object { $_.Line -notmatch '#' }
       ```
       Expected: zero matches. (The string `FY2026-27` may still appear in comment-only lines
       or in `worker/tests/` test fixtures — those are acceptable.)

- [ ] 15. Update `dashboard/app/agents/page.tsx` — remove hardcoded model name fallback.
       One targeted change in the System 2 Reasoning card.

       **Before reading the Next.js agent rules note:** The file has `"use client"` at the top
       and uses `useState`/`useEffect` — this is correct for this component and must not change.
       Check `node_modules/next/dist/docs/` for any breaking API differences before editing.

       Locate the line (line ~107):
       ```tsx
       {config?.gemini?.model || "Gemini 3.8 Flash"}
       ```

       Replace with:
       ```tsx
       {config?.gemini?.model || "—"}
       ```

       The em-dash (`—`) is a neutral placeholder that renders as a visible non-empty string
       without fabricating a model name. It matches the style of other placeholder values
       already used in the file (e.g. `config?.gemini?.api_key_masked || "Configured via ADC/Env"`).

       Files: `dashboard/app/agents/page.tsx`
       Verify: `cd dashboard && npx tsc --noEmit 2>&1 | Select-String "agents/page"` — no TypeScript
       errors on this file. Also visually confirm the card renders `—` when `config?.gemini?.model`
       is null/undefined.

---

## Dependency order summary

```
Item 8  (config_activities) — requires Items 2+3 (ORM models) to already be done
  └─► Item 9  (wire into MasterWorkflow) — requires Item 8
        └─► Item 10 (delta_threshold threading) — completes Item 9's Stage 3b change;
                    also modifies auditor_agent.py (must come before or with Item 12)

Item 11 (agent_factory) — independent of Items 8-10; requires Items 2+3 for ORM import
  └─► Item 12 (remove singletons) — requires Item 11 to exist as the consumer of
                the instruction constants being kept at module level

Item 13 (API/seed cleanup)  — independent; no dependency on Items 8-12
Item 14 (worker service cleanup) — independent; no dependency on Items 8-12
Item 15 (dashboard cleanup) — independent; frontend-only
```

Items 13, 14, 15 are fully independent of each other and of Items 8–12 and can be
applied in any order.

Items 10 and 12 both touch `auditor_agent.py` — apply Item 10's auditor change first,
then Item 12 removes the singleton. The net result in `auditor_agent.py` is:
- Singleton `auditor_agent = create_llm_agent(...)` removed.
- `run_auditor_agent` gains `threshold: float = 2.0` parameter (Item 10).
- `run_auditor_agent` creates local `agent = create_llm_agent(...)` at top of body (Item 12).
- Fallback return dict gets `setdefault("threshold", threshold)` (Item 10).
