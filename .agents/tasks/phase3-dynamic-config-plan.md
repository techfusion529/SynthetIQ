# Phase 3 Implementation Plan: Dynamic Configuration

**Latest migration revision (down_revision for new migration):** `c1d2e3f4a5b6`

---

## Key findings from codebase exploration

- `RunInput` in `runs.py` already has `regulatory_pack_version: str = "default"` — no field addition needed; the field exists but is never used in the workflow. Phase 3 wires it up.
- The `MasterEPRComplianceWorkflow.run()` passes hardcoded `12.0` to `execute_double_auction_activity` and hardcoded `1.0` to `generate_and_dispatch_form1_activity`.
- All agent files construct module-level singletons (`auditor_agent = create_llm_agent(...)`) that must be replaced by factory-based per-run creation.
- `DEFAULT_AGENTS_CONFIG` in `synthetiq_shared/seed.py` seeds `historical_debt_default_tons: 3600.0` and `target_fiscal_year: "FY2026-27"` — both must be removed.
- `api/src/routes/agent_config.py` uses `sample.get("fiscal_year", "FY2026-27")` and `agent_cfg.parameters.get("historical_debt_default_tons", 3600.0)` — both must be removed.
- Dashboard pages both have `"use client"` directive and use `useState`/`useEffect` — they are Client Components per Next.js App Router conventions. Data fetching via `fetch` with `Authorization` header in `useEffect` is the correct pattern (cannot use server-side fetch since pages use session context for the token). No `"use server"` conversion is needed.
- The `agents/page.tsx` hardcodes `config?.gemini?.model || "Gemini 3.8 Flash"` as the fallback — this must become `""`.
- Model selector in `config/page.tsx` already has the three allowed values: `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash` — no change needed there.
- `create_escrow_split_po_activity` requires `audit_verdict` and `human_approved` as non-`None` — the workflow must pass them; current code already passes them in Stage 4.

---

## Implementation Order

- [ ] 1. Add `RegulatoryPackStatus` enum to `synthetiq_shared/constants/__init__.py`.
      Add `class RegulatoryPackStatus(str, enum.Enum)` with values `draft = "draft"`, `pending_approval = "pending_approval"`, `active = "active"`, `superseded = "superseded"`. Export it from `__all__` (add entry).
      Files: `packages/synthetiq-shared/synthetiq_shared/constants/__init__.py`
      Verify: `cd packages/synthetiq-shared && python -c "from synthetiq_shared.constants import RegulatoryPackStatus; assert RegulatoryPackStatus.active == 'active'"` — exits 0.

- [ ] 2. Create new ORM + Pydantic models file `synthetiq_shared/models/dynamic_config.py`.
      Define four SQLAlchemy ORM classes and five Pydantic models exactly as specified:

      **ORM — `RegulatoryPack`** (`__tablename__ = "regulatory_packs"`):
      - `id`: `String(64)` pk, default `uuid.uuid4().hex`
      - `version`: `String(64)`, `unique=True`, `nullable=False`
      - `jurisdiction`: `String(8)`, default `"IN"`
      - `effective_from`: `Date`, `nullable=False`
      - `effective_to`: `Date`, `nullable=True`
      - `status`: `String(32)`, default `"draft"`
      - `created_by`: `String(64)`, FK `users.user_id`, `nullable=True`
      - `approved_by`: `String(64)`, FK `users.user_id`, `nullable=True`
      - `approved_at`: `DateTime(timezone=True)`, `nullable=True`
      - `payload`: `JSON`, `nullable=False`
      - `created_at`: `DateTime(timezone=True)`, `server_default=func.now()`
      No RLS on this table.

      **ORM — `OrgPolicy`** (`__tablename__ = "org_policies"`):
      - `id`: `String(64)` pk, default `uuid.uuid4().hex`
      - `org_id`: `String(64)`, FK `organizations.org_id`, `unique=True`, `nullable=False`
      - `approval_threshold_tons`: `Float`, default `0.0`
      - `categories_in_scope`: `JSON`, default `list`, `server_default="[]"`
      - `signatory_name`: `String(256)`, `nullable=True`
      - `signatory_designation`: `String(128)`, `nullable=True`
      - `timezone`: `String(64)`, default `"Asia/Kolkata"`
      - `created_at`, `updated_at`: `DateTime(timezone=True)`, `server_default=func.now()`, `onupdate=func.now()`

      **ORM — `PlantCalibration`** (`__tablename__ = "plant_calibrations"`):
      - `id`: `String(64)` pk
      - `org_id`: `String(64)`, FK `organizations.org_id`, `index=True`, `nullable=False`
      - `plant_id`: `String(64)`, `nullable=False`
      - `material_grade`: `String(64)`, `nullable=False`
      - `sec_baseline_kwh_per_ton`: `Float`, `nullable=False`
      - `sec_variance`: `Float`, `nullable=False`
      - `motor_efficiency`: `Float`, default `0.92`
      - `valid_from`: `Date`, `nullable=False`
      - `valid_to`: `Date`, `nullable=True`
      - `created_at`: `DateTime(timezone=True)`, `server_default=func.now()`
      - `__table_args__`: `UniqueConstraint("org_id", "plant_id", "material_grade", "valid_from", name="uq_plant_cal")`

      **ORM — `ObligationLedger`** (`__tablename__ = "obligation_ledger"`):
      - `id`: `String(64)` pk
      - `org_id`: `String(64)`, FK `organizations.org_id`, `index=True`, `nullable=False`
      - `fiscal_year`: `String(16)`, `nullable=False`
      - `category`: `String(64)`, `nullable=False`
      - `obligation_tons`: `Float`, `nullable=False`
      - `source`: `String(32)`, `nullable=False`  — values: `"onboarding"`, `"erp_connector"`, `"manual"`
      - `created_at`: `DateTime(timezone=True)`, `server_default=func.now()`
      - `__table_args__`: `UniqueConstraint("org_id", "fiscal_year", "category", name="uq_obligation")`

      **Pydantic — `RegulatoryPackPayload`** (`BaseModel`):
      `category_targets: dict[str, float]`, `conversion_factors: dict[str, float]`, `base_rate_inr_per_kg: float`, `price_corridor_min: float`, `price_corridor_max: float`, `escrow_split_primary: float`, `escrow_split_holdback: float`, `delta_threshold_default: float`, `fiscal_year_start_month: int`, `amortisation_months: int`

      **Pydantic — `OrgPolicySnapshot`** (`BaseModel`):
      `approval_threshold_tons: float`, `categories_in_scope: list[str]`, `signatory_name: str | None`, `signatory_designation: str | None`, `timezone: str`

      **Pydantic — `PlantCalibrationSnapshot`** (`BaseModel`):
      `plant_id: str`, `material_grade: str`, `sec_baseline_kwh_per_ton: float`, `sec_variance: float`, `motor_efficiency: float`, `valid_from: date`, `valid_to: date | None`

      **Pydantic — `ObligationLedgerEntry`** (`BaseModel`):
      `org_id: str`, `fiscal_year: str`, `category: str`, `obligation_tons: float`, `source: str`

      **Pydantic — `RunConfig`** (`BaseModel`):
      `pack: RegulatoryPackPayload`, `policy: OrgPolicySnapshot`, `calibrations: list[PlantCalibrationSnapshot]`, `obligations: list[ObligationLedgerEntry]`

      Files: `packages/synthetiq-shared/synthetiq_shared/models/dynamic_config.py`
      Verify: `cd packages/synthetiq-shared && python -c "from synthetiq_shared.models.dynamic_config import RegulatoryPack, OrgPolicy, PlantCalibration, ObligationLedger, RunConfig, RegulatoryPackPayload"` — exits 0.

- [ ] 3. Export new models from `synthetiq_shared/models/__init__.py`.
      Add import line: `from .dynamic_config import (RegulatoryPack, OrgPolicy, PlantCalibration, ObligationLedger, RegulatoryPackPayload, OrgPolicySnapshot, PlantCalibrationSnapshot, ObligationLedgerEntry, RunConfig)`
      Add all 9 names to `__all__`.
      Files: `packages/synthetiq-shared/synthetiq_shared/models/__init__.py`
      Verify: `cd packages/synthetiq-shared && python -c "from synthetiq_shared.models import RunConfig, RegulatoryPack, OrgPolicy, PlantCalibration, ObligationLedger"` — exits 0.

- [ ] 4. Write the Alembic migration `d4e5f6a7b8c9_phase3_dynamic_config.py`.
      **Header:**
      ```python
      revision: str = 'd4e5f6a7b8c9'
      down_revision = 'c1d2e3f4a5b6'
      ```
      **`upgrade()`** creates the four tables in dependency order:
      1. `regulatory_packs` — `op.create_table(...)` with all columns; no RLS block.
      2. `org_policies` — `op.create_table(...)` with FK to `organizations`; then RLS block (same `try/except` pattern as Phase 1/2: `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY tenant_isolation`, `CREATE POLICY platform_admin_bypass`).
      3. `plant_calibrations` — `op.create_table(...)` with `Index("ix_plant_cal_org_id", "plant_calibrations", "org_id")`; then RLS block.
      4. `obligation_ledger` — `op.create_table(...)` with `Index("ix_obligation_ledger_org_id", "obligation_ledger", "org_id")`; then RLS block.

      **`downgrade()`** drops tables in reverse order, with `try/except` RLS cleanup before each drop.

      Files: `packages/synthetiq-shared/alembic/versions/d4e5f6a7b8c9_phase3_dynamic_config.py`
      Verify: `cd packages/synthetiq-shared && python -c "from alembic.config import Config; from alembic.script import ScriptDirectory; cfg = Config('alembic.ini'); sd = ScriptDirectory.from_config(cfg); print([r.revision for r in sd.walk_revisions()])"` — `d4e5f6a7b8c9` appears in the list.

- [ ] 5. Create `api/src/routes/regulatory.py` — Regulatory Packs router.
      **Router:** `APIRouter(prefix="/regulatory-packs", tags=["Regulatory Packs"])`

      **Request schemas:**
      - `CreateRegulatoryPackRequest(BaseModel)`: `version: str`, `jurisdiction: str = "IN"`, `effective_from: date`, `effective_to: date | None = None`, `payload: RegulatoryPackPayload`
      - No separate update schema needed.

      **Endpoints:**

      `POST /regulatory-packs` — `platform_admin` only (use `Depends(require_platform_admin())`):
      - Validate `payload` is a valid `RegulatoryPackPayload`.
      - Insert `RegulatoryPack` with `status="draft"`, `created_by=user["uid"]`.
      - Return the created record as dict (id, version, status, effective_from, created_by).

      `POST /regulatory-packs/{pack_id}/submit` — `platform_admin` only:
      - Load pack; raise 404 if not found.
      - Raise 422 if `status != "draft"`.
      - Set `status = RegulatoryPackStatus.pending_approval`.
      - Return updated record.

      `POST /regulatory-packs/{pack_id}/approve` — `platform_admin` only:
      - Load pack; raise 404 if not found.
      - Raise 422 if `status != "pending_approval"`.
      - **Maker-checker:** raise 403 if `pack.created_by == user["uid"]` (approver must differ from creator).
      - Set `status = RegulatoryPackStatus.active`, `approved_by = user["uid"]`, `approved_at = datetime.now(timezone.utc)`.
      - Mark any currently-active pack (same jurisdiction) as `status = RegulatoryPackStatus.superseded`.
      - Return updated record.

      `GET /regulatory-packs` — any authenticated user (`user: CurrentUser` only):
      - Query all packs ordered by `created_at` desc.
      - Return list of dicts (id, version, jurisdiction, effective_from, effective_to, status, approved_by, approved_at, created_at).

      `GET /regulatory-packs/{pack_id}` — any authenticated user:
      - Return single pack including full `payload` field.

      Files: `api/src/routes/regulatory.py`
      Verify: `cd api && python -c "from src.routes.regulatory import router; print(len(router.routes))"` — prints `5`.

- [ ] 6. Create `api/src/routes/org_config.py` — Org Policy, Plant Calibration, Obligation Ledger router.
      **Router:** `APIRouter(prefix="/organizations", tags=["Org Configuration"])`

      **Request schemas:**
      - `UpsertOrgPolicyRequest(BaseModel)`: `approval_threshold_tons: float = 0.0`, `categories_in_scope: list[str] = []`, `signatory_name: str | None = None`, `signatory_designation: str | None = None`, `timezone: str = "Asia/Kolkata"`
      - `CreateCalibrationRequest(BaseModel)`: `plant_id: str`, `material_grade: str`, `sec_baseline_kwh_per_ton: float`, `sec_variance: float`, `motor_efficiency: float = 0.92`, `valid_from: date`, `valid_to: date | None = None`
      - `CreateObligationRequest(BaseModel)`: `fiscal_year: str`, `category: str`, `obligation_tons: float`, `source: str`

      **RBAC helper** `_require_same_org_or_platform_admin(user, org_id)`:
      If `user["role"] != "platform_admin"`: call `assert_same_org(user["org_id"], org_id)`.

      **Endpoints:**

      `GET /organizations/{org_id}/policy` — same-org or platform_admin:
      - Query `OrgPolicy` where `org_id == org_id`; return 404 if none with `detail="No policy configured yet"`.
      - Return dict of all fields.

      `PUT /organizations/{org_id}/policy` — same-org admin or platform_admin (require `config:write` permission):
      - Validate `approval_threshold_tons >= 0`; raise 422 otherwise.
      - Validate each entry in `categories_in_scope` is a valid `PlasticCategory` value; raise 422 if any invalid.
      - Load the active `RegulatoryPack` (status=active); if found, raise 422 if `approval_threshold_tons > pack_payload["delta_threshold_default"]`.
      - Upsert `OrgPolicy` (create if not exists, update if exists). Set `updated_at` on update.
      - Return updated dict.

      `POST /organizations/{org_id}/calibrations` — same-org admin or platform_admin (`config:write`):
      - Insert `PlantCalibration`; let DB unique constraint surface 409 on duplicate via exception handler.
      - Return created record dict.

      `GET /organizations/{org_id}/calibrations` — same-org or platform_admin (`config:read`):
      - Query all `PlantCalibration` for `org_id`, ordered by `valid_from` desc.
      - Return list.

      `POST /organizations/{org_id}/obligations` — same-org admin or platform_admin (`config:write`):
      - Insert `ObligationLedger`; unique constraint enforcement via exception handler (return 409 on IntegrityError).
      - Return created record.

      `GET /organizations/{org_id}/obligations` — same-org or platform_admin (`config:read`):
      - Query all `ObligationLedger` for `org_id`.
      - Return list.

      Files: `api/src/routes/org_config.py`
      Verify: `cd api && python -c "from src.routes.org_config import router; print(len(router.routes))"` — prints `6`.

- [ ] 7. Register new routers in `api/src/routes/__init__.py` and `api/src/main.py`.
      In `__init__.py`:
      - Add `from .regulatory import router as regulatory_router`
      - Add `from .org_config import router as org_config_router`
      - Add both to `__all__`.

      In `main.py`:
      - Add `regulatory_router, org_config_router` to the import from `src.routes`.
      - Add `app.include_router(regulatory_router, prefix=API_V1_STR)` after the `agent_config_router` line.
      - Add `app.include_router(org_config_router, prefix=API_V1_STR)` after that.
      - Also add the new ORM models (`RegulatoryPack, OrgPolicy, PlantCalibration, ObligationLedger`) to the `force-import` block in the `lifespan` function so they register with `Base.metadata`.

      Files: `api/src/routes/__init__.py`, `api/src/main.py`
      Verify: `cd api && python -m pytest tests/test_api.py -x -q` — all existing tests pass (new routes are unauthenticated-safe: they return 401 without a token, not 500).

- [ ] 8. Create `worker/src/activities/config_activities.py` — `fetch_run_config_activity`.
      ```python
      from temporalio import activity
      from temporalio.exceptions import ApplicationError
      ```
      **`@activity.defn async def fetch_run_config_activity(org_id: str, regulatory_pack_version: str) -> dict`**:
      - Open `get_db_session()`.
      - Query `RegulatoryPack` by `version == regulatory_pack_version` AND `status == "active"`.
        - If not found: `raise ApplicationError(f"No active regulatory pack with version {regulatory_pack_version!r}", non_retryable=False)`.
      - Deserialise `pack.payload` into `RegulatoryPackPayload(**pack.payload)`.
      - Query `OrgPolicy` by `org_id`; if not found, use defaults: `OrgPolicySnapshot(approval_threshold_tons=0.0, categories_in_scope=[], signatory_name=None, signatory_designation=None, timezone="Asia/Kolkata")`.
      - Query `PlantCalibration` where `org_id == org_id` AND `valid_from <= today` AND (`valid_to IS NULL OR valid_to >= today`); build `list[PlantCalibrationSnapshot]`.
      - Query `ObligationLedger` where `org_id == org_id`; build `list[ObligationLedgerEntry]`.
      - Construct `RunConfig(pack=pack_payload, policy=policy_snapshot, calibrations=calibrations, obligations=obligations)`.
      - Return `run_config.model_dump()`.

      Imports needed at top of file: `from synthetiq_shared.models import RegulatoryPack, OrgPolicy, PlantCalibration, ObligationLedger`, `from synthetiq_shared.models.dynamic_config import RegulatoryPackPayload, OrgPolicySnapshot, PlantCalibrationSnapshot, ObligationLedgerEntry, RunConfig`, `from synthetiq_shared.database import get_db_session`, `from sqlalchemy import select`, `from datetime import date`.

      Files: `worker/src/activities/config_activities.py`
      Verify: `cd worker && python -c "from src.activities.config_activities import fetch_run_config_activity; print('ok')"` — exits 0.

- [ ] 9. Wire `fetch_run_config_activity` into `MasterEPRComplianceWorkflow.run()` in `worker/src/flows/workflows.py`.
      **Step 9a — Update imports block** inside `with workflow.unsafe.imports_passed_through()`:
      Add `from src.activities.config_activities import fetch_run_config_activity`.

      **Step 9b — Add Stage 0 before Stage 1:**
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

      **Step 9c — Derive `fiscal_year` dynamically** (replace hardcoded `fiscal_year = run_input.fiscal_year`):
      ```python
      # Derive fiscal year from pack's fiscal_year_start_month if not provided in input
      if run_input.fiscal_year:
          fiscal_year = run_input.fiscal_year
      else:
          from datetime import date as _date
          today = workflow.now().date()  # deterministic Temporal clock
          fy_start_month = run_config.pack.fiscal_year_start_month  # e.g. 4 for April
          if today.month >= fy_start_month:
              fiscal_year = f"FY{today.year}-{str(today.year + 1)[2:]}"
          else:
              fiscal_year = f"FY{today.year - 1}-{str(today.year)[2:]}"
      ```

      **Step 9d — Replace hardcoded `12.0`** in the `execute_double_auction_activity` call (Stage 2b):
      Change `args=[f"RFP-{company_id}", category, volume_tons, 12.0]` to
      `args=[f"RFP-{company_id}", category, volume_tons, run_config.pack.base_rate_inr_per_kg]`.

      **Step 9e — Pass `delta_threshold` to `audit_scada_telemetry_activity`** (Stage 3b):
      Add `run_config.pack.delta_threshold_default` as an additional keyword argument. Since the current signature does not accept this, it will be threaded through in Item 10. For now, add it as an extra positional or keyword arg — the activity accepts `**kwargs`-style after Item 10 is done. *(Dependency: Item 10 must add the param first; do this step together with Item 10.)*

      **Step 9f — Replace hardcoded `1.0` conversion factor** in `generate_and_dispatch_form1_activity` (Stage 5):
      Change `args=[po["po_number"], audit["audit_id"], volume_tons, 1.0, run_input.org_id]` to:
      ```python
      cf = run_config.pack.conversion_factors.get(category, 1.0)
      args=[po["po_number"], audit["audit_id"], volume_tons, cf, run_input.org_id]
      ```

      Files: `worker/src/flows/workflows.py`
      Verify: `cd worker && python -c "from src.flows.workflows import MasterEPRComplianceWorkflow; print('ok')"` — exits 0.

- [ ] 10. Add `delta_threshold` parameter to `audit_scada_telemetry_activity` in `worker/src/activities/agent_activities.py`.
      - Add `delta_threshold: float = 2.0` as the last parameter (before `org_id`).
      - Pass it as `threshold=delta_threshold` to `run_auditor_agent(...)` (the auditor agent runner does not currently accept it, so also add `threshold: float = 2.0` to `run_auditor_agent`'s signature and inject it into the fallback `evaluate_scada_signature` call and into the verdict logic: replace `threshold = result.get("threshold", 2.0)` with `threshold = result.get("threshold", delta_threshold)`).
      - In `workflows.py` Stage 3b: add `run_config.pack.delta_threshold_default` as the `delta_threshold` keyword arg in the `audit_scada_telemetry_activity` args list.

      Files: `worker/src/activities/agent_activities.py`, `worker/src/agents/auditor_agent.py`, `worker/src/flows/workflows.py`
      Verify: `cd worker && python -c "from src.activities.agent_activities import audit_scada_telemetry_activity; import inspect; sig = inspect.signature(audit_scada_telemetry_activity.fn); assert 'delta_threshold' in sig.parameters"` — exits 0.

- [ ] 11. Create `worker/src/factories/agent_factory.py` — per-run agent factory.
      ```python
      from __future__ import annotations
      import logging
      from typing import Any
      logger = logging.getLogger(__name__)

      ALLOWED_MODEL_IDS = frozenset(["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"])
      FORBIDDEN_PROMPT_KEYWORDS = frozenset(["verdict=", "always_pass", "skip_gate"])

      async def create_agent(agent_name: str, org_id: str, run_id: str) -> Any:
          """Return a configured ADK LlmAgent for the given (org, agent) pair.
          Falls back to platform defaults if no AgentConfiguration row exists.
          """
          from synthetiq_shared.database import get_db_session
          from synthetiq_shared.models import AgentConfiguration
          from sqlalchemy import select

          model_id = "gemini-2.0-flash"
          temperature = 0.2
          system_prompt: str | None = None

          async with get_db_session() as session:
              res = await session.execute(
                  select(AgentConfiguration)
                  .where(AgentConfiguration.org_id == org_id)
                  .where(AgentConfiguration.agent_name == agent_name)
                  .where(AgentConfiguration.is_active.is_(True))
              )
              cfg = res.scalar_one_or_none()

          if cfg:
              # Validate model_id against allowlist
              if cfg.model_name not in ALLOWED_MODEL_IDS:
                  logger.warning(
                      f"[AgentFactory] model_id {cfg.model_name!r} not in allowlist for "
                      f"org={org_id}, agent={agent_name}. Falling back to gemini-2.0-flash."
                  )
              else:
                  model_id = cfg.model_name
              temperature = cfg.temperature

              # Validate prompt for forbidden keywords
              if cfg.system_prompt:
                  forbidden_found = [kw for kw in FORBIDDEN_PROMPT_KEYWORDS if kw in cfg.system_prompt]
                  if forbidden_found:
                      logger.warning(
                          f"[AgentFactory] Prompt for org={org_id}, agent={agent_name} contains "
                          f"forbidden keywords {forbidden_found}. Ignoring custom prompt."
                      )
                  else:
                      system_prompt = cfg.system_prompt

          # Import and call the per-agent builder
          return _build_agent(agent_name, model_id=model_id, temperature=temperature, system_prompt=system_prompt)


      def _build_agent(agent_name: str, model_id: str, temperature: float, system_prompt: str | None) -> Any:
          """Instantiate the named agent with the given model/prompt overrides."""
          from agents.base_adk import create_llm_agent

          # Import the canonical instruction and tools for each agent by name
          _REGISTRY = {
              "auditor":            _build_auditor,
              "brand_liability":    _build_brand_liability,
              "regulatory_watchdog":_build_regulatory,
              "treasury":           _build_treasury,
              "logistics":          _build_logistics,
              "erp":                _build_erp,
              "legal":              _build_legal,
          }
          builder = _REGISTRY.get(agent_name)
          if builder is None:
              raise ValueError(f"Unknown agent name: {agent_name!r}")
          return builder(model_id=model_id, temperature=temperature, system_prompt=system_prompt)
      ```

      Each `_build_X` function imports the canonical `*_INSTRUCTION` and `tools` list from the corresponding `agents/*.py` file and calls `create_llm_agent(...)` with overrides for `model` and `instruction` (if `system_prompt` is not None, use it; else use the canonical instruction). This returns a fresh `LlmAgent` instance per call.

      Files: `worker/src/factories/__init__.py` (empty), `worker/src/factories/agent_factory.py`
      Verify: `cd worker && python -c "import asyncio; from src.factories.agent_factory import create_agent; print('ok')"` — exits 0.

- [ ] 12. Replace module-level agent singletons with factory-based creation in all agent files.
      For each of the seven agent files (`auditor_agent.py`, `brand_liability_agent.py`, `erp_agent.py`, `legal_agent.py`, `logistics_agent.py`, `regulatory_agent.py`, `treasury_agent.py`):
      1. Remove the module-level singleton assignment (e.g. `auditor_agent = create_llm_agent(...)`).
      2. Rename the singleton usage inside the `run_*_agent` function to a local variable: add `agent = create_llm_agent(name=..., instruction=..., tools=..., description=..., output_key=...)` at the top of `run_*_agent`.
      3. Keep `AUDITOR_INSTRUCTION`, `tools` list, `BRAND_LIABILITY_INSTRUCTION`, etc. as module-level constants (they are still needed by `agent_factory.py`'s `_build_X` helpers).

      The canonical instruction constants and tool lists must remain importable at module level; only the `LlmAgent` instance construction moves inside the function.

      Files: `worker/src/agents/auditor_agent.py`, `worker/src/agents/brand_liability_agent.py`, `worker/src/agents/erp_agent.py`, `worker/src/agents/legal_agent.py`, `worker/src/agents/logistics_agent.py`, `worker/src/agents/regulatory_agent.py`, `worker/src/agents/treasury_agent.py`
      Verify: `cd worker && python -c "from agents.auditor_agent import AUDITOR_INSTRUCTION, run_auditor_agent; from agents.treasury_agent import TREASURY_INSTRUCTION; print('ok')"` — exits 0.

- [ ] 13. Remove hardcoded demo defaults from API routes and seed file.

      **`api/src/routes/agent_config.py`** — in `test_agent_with_dynamic_data`:
      - Change `fiscal_year = sample.get("fiscal_year", "FY2026-27")` to `fiscal_year = sample.get("fiscal_year", "")`. Raise `HTTPException(status_code=422, detail="fiscal_year is required in sample_input for brand_liability test")` if `fiscal_year == ""`.
      - Change `historic_debt = agent_cfg.parameters.get("historical_debt_default_tons", 3600.0)` to `historic_debt = agent_cfg.parameters.get("historical_debt_default_tons")`. Add guard: if `historic_debt is None`, raise `HTTPException(status_code=422, detail="historical_debt_default_tons not configured for this agent")`.

      **`api/src/routes/organizations.py`** — in `preview_data_source`:
      - Change `fiscal_year="FY2026-27"` in the `query_sales_data` call to `fiscal_year=""`. The connector shim will handle the empty string; this removes the hardcoded year.

      **`packages/synthetiq-shared/synthetiq_shared/seed.py`** — in `DEFAULT_AGENTS_CONFIG`:
      - Remove `"historical_debt_default_tons": 3600.0` from the `brand_liability` parameters dict.
      - Remove `"target_fiscal_year": "FY2026-27"` from the `brand_liability` parameters dict.
      - Remove `"statutory_base_rate_inr": 12.0` from the `regulatory_watchdog` parameters dict (this is now in the regulatory pack payload, not the agent config).

      **`api/src/routes/liability.py`** — remove `fiscal_year: str = "FY2026-27"` defaults:
      - Change both `fiscal_year` defaults to `fiscal_year: str = ""`.

      Files: `api/src/routes/agent_config.py`, `api/src/routes/organizations.py`, `api/src/routes/liability.py`, `packages/synthetiq-shared/synthetiq_shared/seed.py`
      Verify: `Get-ChildItem worker/src,api/src -Recurse -Include "*.py" | Select-String -Pattern "3600|2500|historical_debt_default|FY2026-27|DEFAULT_AGENTS_CONFIG"` returns only lines in test fixtures or comments (zero matches in production code paths).

- [ ] 14. Remove hardcoded `12.0` base rate from `worker/src/flows/workflows.py` and `worker/src/agents/ai_service.py`.
      - In `workflows.py`: the `12.0` in `AuctionLiquidityWorkflow.run()` default arg `statutory_base_rate: float = 12.0` is a standalone workflow parameter — keep it as the default signature but add a docstring note that callers should pass the pack's `base_rate_inr_per_kg` instead. The `MasterEPRComplianceWorkflow` no longer passes `12.0` directly (handled in Item 9d). This keeps the standalone `AuctionLiquidityWorkflow` working independently.
      - In `worker/src/agents/ai_service.py` line 193: change `"fiscal_year": "FY2026-27"` to `"fiscal_year": ""`.
      - In `worker/src/services/scheduler_service.py` line 295: the `params.get("fiscal_year", ...)` line — change the fallback from `"FY2026-27"` to `""`.

      Files: `worker/src/agents/ai_service.py`, `worker/src/services/scheduler_service.py`
      Verify: `Get-ChildItem worker/src -Recurse -Include "*.py" | Select-String -Pattern '"FY2026-27"'` — zero matches.

- [ ] 15. Update `dashboard/app/agents/page.tsx` — remove hardcoded model name fallback.
      Line: `config?.gemini?.model || "Gemini 3.8 Flash"`
      Change to: `config?.gemini?.model || ""`
      If the model field renders as an empty string that looks broken, wrap it: if `config?.gemini?.model` is falsy, display `—` (an em-dash placeholder), not a fabricated model name.
      Per Next.js App Router docs: this is a `"use client"` component using `useState`/`useEffect` for data fetching with a Bearer token — no change to the fetching strategy is needed.

      Files: `dashboard/app/agents/page.tsx`
      Verify: `cd dashboard && npx tsc --noEmit 2>&1 | Select-String "agents/page"` — no TypeScript errors on this file.

- [ ] 16. Update `dashboard/app/agents/config/page.tsx` — add Active Regulatory Pack section.
      Add a new state variable: `const [activePack, setActivePack] = useState<{version: string; effective_from: string} | null>(null)`.

      In `loadData` (alongside the existing agent config and data source fetches), add:
      ```typescript
      fetch(`${API_BASE}/regulatory-packs`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : [])
        .then((packs: any[]) => {
          const found = packs.find(p => p.status === "active") || null;
          setActivePack(found);
        })
        .catch(() => {});
      ```

      Add a read-only display section above the agent selector Tabs, inside the main `Box`:
      ```tsx
      <Card variant="outlined" sx={{ bgcolor: "rgba(255,255,255,0.02)", borderRadius: 2 }}>
        <CardContent sx={{ py: "12px !important", px: 2 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
            Active Regulatory Pack
          </Typography>
          {activePack ? (
            <Box sx={{ display: "flex", gap: 2, mt: 0.5, alignItems: "center" }}>
              <Typography variant="body2" fontFamily="monospace" fontWeight={700}>
                {activePack.version}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Effective from: {activePack.effective_from}
              </Typography>
              <Chip label="ACTIVE" size="small" color="success" sx={{ height: 18, fontSize: "0.65rem" }} />
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              No active pack — platform admin must approve a regulatory pack before runs can proceed.
            </Typography>
          )}
        </CardContent>
      </Card>
      ```

      Per Next.js App Router docs: this page is already `"use client"` and uses `useEffect`-based fetching with a `Bearer` token — the new fetch follows the identical pattern and is correct for this context. No `"use server"` or RSC migration needed.

      Files: `dashboard/app/agents/config/page.tsx`
      Verify: `cd dashboard && npx tsc --noEmit 2>&1 | Select-String "agents/config/page"` — no TypeScript errors on this file.

- [ ] 17. Update `api/tests/conftest.py` — register new ORM models so test DB creates their tables.
      In the `setup_test_db` fixture's `_init()` inner function, add the new models to the import list:
      ```python
      from synthetiq_shared.models import (  # noqa: F401 — register all models
          Organization, User, DataSource, AgentConfiguration, Schedule,
          WorkflowRun, AuctionRecord, BidRecord, AuditRecord,
          EscrowPORecord, Form1Record, LegalEntity, Membership, InviteToken,
          RegulatoryPack, OrgPolicy, PlantCalibration, ObligationLedger,   # new
      )
      ```
      Files: `api/tests/conftest.py`
      Verify: `cd api && python -m pytest tests/test_api.py -x -q` — all existing tests still pass (no regressions from new tables).

---

## Dependency graph (summary)

```
Item 1 (constants)
  └─► Item 2 (ORM/Pydantic models)
        └─► Item 3 (models __init__ exports)
              ├─► Item 4 (Alembic migration)
              ├─► Item 5 (regulatory routes)
              ├─► Item 6 (org_config routes)
              │     └─► Item 7 (register routers + main.py)
              │           └─► Item 17 (test conftest update)
              └─► Item 8 (config_activities)
                    └─► Item 9 (wire into MasterWorkflow)
                          └─► Item 10 (delta_threshold param threading)

Item 11 (agent_factory)
  └─► Item 12 (replace singletons in agent files)
        [independent of Items 1-10 but must come after Item 2 for imports]

Item 13 (remove hardcoded demo defaults) — depends on Items 2, 5, 6
Item 14 (remove FY2026-27 from worker services) — independent
Items 15-16 (dashboard) — independent of backend items
```

---

## Files to create (new)

| File | Description |
|------|-------------|
| `packages/synthetiq-shared/alembic/versions/d4e5f6a7b8c9_phase3_dynamic_config.py` | Alembic migration |
| `packages/synthetiq-shared/synthetiq_shared/models/dynamic_config.py` | 4 ORM + 5 Pydantic models |
| `api/src/routes/regulatory.py` | Regulatory Packs endpoints |
| `api/src/routes/org_config.py` | Org Policy / Calibration / Obligation endpoints |
| `worker/src/activities/config_activities.py` | `fetch_run_config_activity` |
| `worker/src/factories/__init__.py` | Empty package marker |
| `worker/src/factories/agent_factory.py` | Per-run agent factory |

## Files to modify

| File | Change |
|------|--------|
| `packages/synthetiq-shared/synthetiq_shared/constants/__init__.py` | Add `RegulatoryPackStatus` enum |
| `packages/synthetiq-shared/synthetiq_shared/models/__init__.py` | Export new dynamic_config models |
| `packages/synthetiq-shared/synthetiq_shared/seed.py` | Remove `historical_debt_default_tons`, `target_fiscal_year`, `statutory_base_rate_inr` from DEFAULT_AGENTS_CONFIG |
| `api/src/routes/__init__.py` | Import + export new routers |
| `api/src/main.py` | Mount new routers; force-import new ORM models |
| `api/src/routes/agent_config.py` | Remove `FY2026-27` and `3600.0` hardcoded fallbacks |
| `api/src/routes/organizations.py` | Remove `FY2026-27` in preview endpoint |
| `api/src/routes/liability.py` | Remove `FY2026-27` default |
| `api/tests/conftest.py` | Register new ORM models |
| `worker/src/flows/workflows.py` | Add Stage 0 + wire run_config values |
| `worker/src/activities/agent_activities.py` | Add `delta_threshold` param |
| `worker/src/agents/auditor_agent.py` | Move singleton to local variable in runner |
| `worker/src/agents/brand_liability_agent.py` | Move singleton to local variable in runner |
| `worker/src/agents/erp_agent.py` | Move singleton to local variable in runner |
| `worker/src/agents/legal_agent.py` | Move singleton to local variable in runner |
| `worker/src/agents/logistics_agent.py` | Move singleton to local variable in runner |
| `worker/src/agents/regulatory_agent.py` | Move singleton to local variable in runner |
| `worker/src/agents/treasury_agent.py` | Move singleton to local variable in runner |
| `worker/src/agents/ai_service.py` | Remove `FY2026-27` hardcode |
| `worker/src/services/scheduler_service.py` | Remove `FY2026-27` fallback |
| `dashboard/app/agents/page.tsx` | Remove `"Gemini 3.8 Flash"` hardcoded fallback |
| `dashboard/app/agents/config/page.tsx` | Add Active Regulatory Pack read-only section |
