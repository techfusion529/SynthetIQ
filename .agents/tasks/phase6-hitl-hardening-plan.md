# Phase 6: HITL Hardening — Implementation Plan

> **Status**: Planning complete. FEAT artifacts live at `.agents/tasks/phase6-feats/`.
> The plan below is the canonical source of truth; the FEAT files subdivide it for
> sequential coder steps.

---

## Codebase findings (read before implementing)

| Finding | Impact |
|---|---|
| `WorkflowRun` in `organization.py` has `hitl_required`, `temporal_run_id`, `triggered_by` but **no** `initiated_by`, `hitl_resolved_at`, `hitl_resolver_id`, `hitl_reason_code` | T1 migration must add these four columns |
| Latest migration chain head: `g2b3c4d5e6f7_phase5_escrow_split.py` (`down_revision = f1a2b3c4d5e6`) | New migration must set `down_revision = 'g2b3c4d5e6f7'` |
| `audit.py` already has `POST /audit/exceptions/{workflow_id}/resolve` (loose, dict-based, no four-eyes) | T1 adds the **new** `POST /audit/resolve` endpoint; the old one is left in place for backward compat |
| `api/pyproject.toml` already has `prometheus-fastapi-instrumentator>=7.0.0` | T4 skips adding it; just instruments the app |
| `worker/pyproject.toml` already has `opentelemetry-sdk`, `opentelemetry-exporter-otlp`, `prometheus-client` | T3/T4 worker deps are already present |
| `api/pyproject.toml` does **not** have `opentelemetry-sdk` etc. | T3 must add them to `api/pyproject.toml` |
| `agent_factory.py` in `worker/src/factories/` has `create_agent(agent_name, org_id, run_id)` with no cost cap | T5 adds `_check_cost_cap` at the top of `create_agent` |
| `llm_usage_log` table does not exist | T5 migration (same file as T1) creates it |
| `MasterEPRComplianceWorkflow.run()` has bare `await workflow.wait_condition(lambda: self._approval_received)` — no timeout | T2 wraps it; `QuadCoreAuditWorkflow` has the same bare call |
| Dashboard uses **Next.js 16.3.7** App Router, `"use client"`, MUI v5, service pattern in `app/lib/services/`, hook pattern in `app/lib/hooks/useServices.ts` | T6 follows exactly this pattern |
| Sidebar nav in `components/AppSidebar.tsx` uses a `NAV_ITEMS` array with `roles: []` (all) or `roles: ["admin","compliance_officer"]` (restricted) | T6 adds HITL Console entry with `roles: ["admin", "platform_admin"]` |
| `api/tests/test_isolation.py` does not exist | T7 creates it |
| CI pipeline jobs are under `python-lint-test` in Stage 1; no `literals-scan` or `type-check` jobs | T8/T9 add them as peer jobs under Stage 1 |
| `REFACTORING_SUMMARY.md` and `ANALYSIS_FINDINGS.md` do **not** exist in the repo root | T10 only adds the ARCHIVED header step if they exist; skip that sub-step |

---

## Implementation Plan

- [ ] **1. Alembic migration h3c4d5e6f7a8_phase6_hitl_hardening**
      Create a new migration file that:
      - Adds four nullable columns to `workflow_runs`: `initiated_by VARCHAR(64)`, `hitl_resolved_at DATETIME`, `hitl_resolver_id VARCHAR(64)`, `hitl_reason_code VARCHAR(64)`.
      - Creates new table `llm_usage_log`: `id VARCHAR(64) PK`, `org_id VARCHAR(64) NOT NULL`, `agent_name VARCHAR(64)`, `model VARCHAR(64)`, `input_tokens INTEGER`, `output_tokens INTEGER`, `created_at DATETIME server_default now()`. Add index on `(org_id, created_at)`.
      - Tries to enable RLS on `llm_usage_log` (PostgreSQL only; degrades silently on SQLite).
      - Sets `revision = 'h3c4d5e6f7a8'`, `down_revision = 'g2b3c4d5e6f7'`.

      Files to create:
      - `packages/synthetiq-shared/alembic/versions/h3c4d5e6f7a8_phase6_hitl_hardening.py`

      Files to modify:
      - `packages/synthetiq-shared/synthetiq_shared/models/organization.py` — add the four new `Mapped` columns to `WorkflowRun`; add `initiated_by` as alias for `triggered_by` usage (keep `triggered_by` for backward compat).

      Verify: `cd packages/synthetiq-shared && alembic upgrade head` — exits 0 with no errors.

---

- [ ] **2. `POST /audit/resolve` HITL resolution endpoint**
      Add to `api/src/routes/audit.py`:
      - Import `assert_same_org` from `src.middleware.rbac` (it already lives there).
      - Define `HITLResolveRequest(BaseModel)` with fields:
        `run_id: str`, `audit_id: str`, `reason_code: Literal["DATA_VERIFIED_CORRECT","DATA_CORRECTED_BY_OPERATOR","SENSOR_CALIBRATION_ERROR","MANUAL_MEASUREMENT_ACCEPTED","FALSE_POSITIVE_TAMPER_ALERT","ESCALATED_TO_COMPLIANCE_TEAM"]`, `override_tons: Optional[float] = None`, `notes: str = ""`, `resolver_id: str`.
      - Add `POST /audit/resolve` route with `require_permission("audits:write")` and `TenantCtx`.
      - Body: validated `HITLResolveRequest`.
      - Logic:
        1. Load `WorkflowRun` by `run_id`; 404 if not found.
        2. `assert_same_org(tenant_ctx.org_id, run.org_id)` — raises 403 on mismatch.
        3. Four-eyes: `if body.resolver_id == run.triggered_by: raise HTTPException(403, "resolver_id must differ from initiator")`.
        4. `override_tons` validation: if provided and `run.input_params.get("volume_tons")` is set, verify `override_tons <= input_params["volume_tons"] * 1.1`; raise 422 if exceeded. Use `run.input_params.get("volume_tons", 0.0)` as `original_tons`.
        5. Signal Temporal: `await temporal_service.signal_workflow(workflow_id=run.temporal_workflow_id, signal_name="human_approval", signal_args=[{...}])`.
        6. Update DB: `run.hitl_required = False`, `run.hitl_resolved_at = datetime.utcnow()`, `run.hitl_resolver_id = body.resolver_id`, `run.hitl_reason_code = body.reason_code`.
        7. Return `{status: "RESOLVED", run_id, resolver_id, reason_code}`.

      Dependency: Task 1 migration must be applied for the new columns to exist.

      Files to modify:
      - `api/src/routes/audit.py`

      Verify: `cd api && python -m pytest tests/ -x -q` — no import errors; route visible in `python -c "from src.main import app; print([r.path for r in app.routes])"`.

---

- [ ] **3. 72-hour HITL timeout in worker workflows**
      In `worker/src/flows/workflows.py`, wrap the bare `await workflow.wait_condition(...)` call in **both** `QuadCoreAuditWorkflow.run()` and `MasterEPRComplianceWorkflow.run()` with a 72-hour timeout. Pattern:

      ```python
      import asyncio
      from datetime import timedelta
      ...
      try:
          await workflow.wait_condition(
              lambda: self._approval_received,
              timeout=timedelta(hours=72),
          )
      except asyncio.TimeoutError:
          raise ApplicationError(
              "HITL_TIMEOUT: no approval received within 72 hours",
              non_retryable=True,
          )
      ```

      Note: Temporal Python SDK ≥1.7 surfaces a timeout on `wait_condition` as `asyncio.TimeoutError`. `ApplicationError` is already imported from `temporalio.exceptions`.

      Files to modify:
      - `worker/src/flows/workflows.py`

      Verify: `cd worker && python -c "from src.flows.workflows import MasterEPRComplianceWorkflow, QuadCoreAuditWorkflow; print('ok')"` — exits 0.

---

- [ ] **4. OpenTelemetry tracing on the API**
      Add OTel dependencies to API:
      - `api/pyproject.toml`: add `opentelemetry-sdk>=1.27.0`, `opentelemetry-instrumentation-fastapi>=0.48b0`, `opentelemetry-exporter-otlp>=1.27.0` if not already present (check first — they are **not** currently in `api/pyproject.toml`).

      In `api/src/main.py` (after app creation, before middleware):
      ```python
      import os
      from opentelemetry import trace
      from opentelemetry.sdk.trace import TracerProvider
      from opentelemetry.sdk.trace.export import BatchSpanProcessor
      from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
      from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

      _otlp_endpoint = os.getenv("OTLP_ENDPOINT")
      if _otlp_endpoint:
          _provider = TracerProvider()
          _provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=_otlp_endpoint)))
          trace.set_tracer_provider(_provider)
      FastAPIInstrumentor.instrument_app(app)
      ```

      In `api/src/utils/tenant.py`, at the end of `get_tenant_ctx()` before the final `return`:
      ```python
      from opentelemetry import trace as _trace
      _trace.get_current_span().set_attribute("org_id", org_id)
      ```

      Add to `.env.example`:
      ```
      # OpenTelemetry collector endpoint (optional; leave blank to disable)
      OTLP_ENDPOINT=
      ```

      Files to modify:
      - `api/pyproject.toml`
      - `api/src/main.py`
      - `api/src/utils/tenant.py`
      - `.env.example`

      Verify: `cd api && python -c "from src.main import app; print('otel ok')"` — exits 0.

---

- [ ] **5. Prometheus metrics**
      `prometheus-fastapi-instrumentator` is **already** in `api/pyproject.toml`. No dep change needed.

      In `api/src/main.py`, after `app = FastAPI(...)`:
      ```python
      from prometheus_fastapi_instrumentator import Instrumentator
      Instrumentator().instrument(app).expose(app)
      ```

      Create `api/src/utils/metrics.py`:
      ```python
      from prometheus_client import Counter

      llm_tokens_total = Counter(
          "llm_tokens_total",
          "Total LLM tokens consumed",
          ["org_id", "agent_name", "model"],
      )
      ```

      In `worker/src/factories/agent_factory.py`, at the bottom of `create_agent()` (after `_build_agent` returns):
      ```python
      try:
          from synthetiq_shared.database import get_db_session  # already imported above
          # Only import metrics inside worker — avoids circular import if run in API context
          import importlib, sys
          if "prometheus_client" in sys.modules:
              # Record a call event (token counts not available from factory; use 0 as placeholder)
              # Actual token increments happen in activity wrappers if needed.
              pass
      except Exception:
          pass
      ```

      **Tricky detail**: The worker process does not run in the same process as the API, so `api/src/utils/metrics.py` is an API-side module. The worker uses `prometheus-client` directly (already in `worker/pyproject.toml`). The factory should define its own counter if the worker needs to emit it. Create a second counter in `worker/src/utils/metrics.py` (create this file):
      ```python
      from prometheus_client import Counter

      llm_tokens_total = Counter(
          "llm_tokens_total",
          "Total LLM tokens consumed",
          ["org_id", "agent_name", "model"],
      )
      ```
      Import and call `llm_tokens_total.labels(org_id=org_id, agent_name=agent_name, model=model_id).inc()` at the end of `create_agent()`, wrapped in a try/except.

      Files to create:
      - `api/src/utils/metrics.py`
      - `worker/src/utils/metrics.py`

      Files to modify:
      - `api/src/main.py`
      - `worker/src/factories/agent_factory.py`

      Verify: `cd api && python -c "from src.main import app; print('metrics ok')"` — exits 0.

---

- [ ] **6. Per-tenant LLM cost cap**
      In `worker/src/factories/agent_factory.py`:
      - Add at module top: `import os; MAX_LLM_TOKENS = int(os.getenv("MAX_LLM_TOKENS_PER_ORG_PER_MONTH", "1_000_000"))`.
      - Add `async def _check_cost_cap(org_id: str) -> None` function that:
        1. Opens a DB session.
        2. Runs: `SELECT SUM(input_tokens + output_tokens) FROM llm_usage_log WHERE org_id = :oid AND created_at >= date_trunc('month', now())` (SQLite compat: use `strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`).
        3. If total > `MAX_LLM_TOKENS`, raises `ApplicationError(f"LLM_COST_CAP_EXCEEDED: org {org_id}", non_retryable=True)`.
        4. Wraps entire body in try/except; logs warning and returns (does not block) if DB is unreachable.
      - Call `await _check_cost_cap(org_id)` as the first line of `create_agent()`.

      Dependency: Task 1 migration must create `llm_usage_log` table first.

      Files to modify:
      - `worker/src/factories/agent_factory.py`

      Verify: `cd worker && python -c "from src.factories.agent_factory import create_agent; print('cost cap ok')"` — exits 0.

---

- [ ] **7. HITL Console dashboard page**
      Read `dashboard/AGENTS.md` first. This is Next.js **16.3.7** App Router. Use `"use client"` (interactive page). Follow the exact same pattern as `dashboard/app/audit/page.tsx` and `dashboard/app/dispatch/page.tsx`: MUI v5 components, `useSession` for auth, service class + hook pattern.

      **New files:**

      `dashboard/app/lib/services/hitl.service.ts`:
      - `listHitlRuns(limit=50)` → `GET /api/v1/runs?hitl_required=true&limit=N` (query param).
      - `getRun(runId)` → `GET /api/v1/runs/{runId}`.
      - `resolveHitl(body: HITLResolvePayload)` → `POST /api/v1/audit/resolve`.

      `dashboard/app/lib/types/hitl.types.ts`:
      - `HITLRun` interface: `run_id, org_id, workflow_type, status, hitl_required, triggered_by, started_at, completed_at, input_params`.
      - `HITLRunDetail` extends `HITLRun`: adds `temporal_status, error_message, temporal_workflow_id`.
      - `HITLResolvePayload`: `run_id, audit_id, reason_code, override_tons?, notes, resolver_id`.
      - `REASON_CODES` as `const` array of 6 literal values from Task 2.

      `dashboard/app/hitl/page.tsx`:
      - `"use client"` directive.
      - **Left pane** (Grid xs=12 md=4): paginated list of runs with `hitl_required=true` from `hitlSvc.listHitlRuns()`. Each row is a Card showing `run_id`, `org_id`, `status` chip, `started_at`, and elapsed time since started (computed with `Date.now() - new Date(started_at)`). Click selects a run.
      - **Right pane** (Grid xs=12 md=8): shown when a run is selected, loads `hitlSvc.getRun(selectedRunId)`. Shows:
        - Physics summary from `input_params` (delta_percent if present, sec_actual vs sec_baseline, chain_head hash from `input_params.audit_result` if available).
        - Stage history: iterate known stages (0–6) to show which `stage_reached` was.
        - **Resolution form** (bottom): `reason_code` Select with the 6 options, `override_tons` TextField (number, helper text "max 10% override"), `notes` TextField (multiline). Submit calls `hitlSvc.resolveHitl(...)`. Guard: only render when `user?.user_id !== selectedRun?.triggered_by` (four-eyes).
      - Import `useSession` for `user`, `useHitlService` hook (new — add to `useServices.ts`).
      - Follow MUI Breadcrumbs + Grid + Card structure from `audit/page.tsx`.
      - Add `Gavel` or `SupervisorAccount` MUI icon for the page header.

      Update `dashboard/app/lib/hooks/useServices.ts`:
      - Import and instantiate `HitlService`.
      - Export `useHitlService()` helper.

      Update `dashboard/app/lib/services/index.ts`:
      - Export `HitlService`.

      Update `dashboard/components/AppSidebar.tsx` `NAV_ITEMS`:
      - Add `{ label: "HITL Console", href: "/hitl", icon: <SupervisorAccountIcon />, roles: ["admin", "platform_admin"] }`.
      - Import `SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount"`.

      **API-side**: The existing `GET /runs` endpoint does not filter by `hitl_required`. Add `hitl_required: Optional[bool] = Query(None)` param to `list_runs()` in `api/src/routes/runs.py` and apply `.where(WorkflowRun.hitl_required == hitl_required)` when the param is not None.

      Files to create:
      - `dashboard/app/hitl/page.tsx`
      - `dashboard/app/lib/services/hitl.service.ts`
      - `dashboard/app/lib/types/hitl.types.ts`

      Files to modify:
      - `dashboard/app/lib/hooks/useServices.ts`
      - `dashboard/app/lib/services/index.ts`
      - `dashboard/components/AppSidebar.tsx`
      - `api/src/routes/runs.py`

      Verify: `cd dashboard && npm run build` — exits 0 with no TypeScript errors.

---

- [ ] **8. Two-org isolation test suite**
      Create `api/tests/test_isolation.py`.
      - Use `pytest` with `pytest-asyncio`. No fixture from scratch — check if a conftest exists first; if not, embed helpers inline.
      - `org_a_token` / `org_b_token` fixtures: call `POST /api/v1/auth/login` (or use `POST /api/v1/auth/register` + login) to create two separate orgs and get their JWTs. Alternatively — and simpler given the code — call `POST /api/v1/auth/register` for two users with different `org_id` values set in the request body; fall back to using the `Authorization: Bearer <token>` header.
      - Parameterize cross-org endpoint checks with `@pytest.mark.parametrize`.
      - For each endpoint listed in the task spec, assert `response.status_code in (403, 404)`.
      - RLS direct-DB test: open a raw `asyncpg` connection, execute `SELECT count(*) FROM workflow_runs` without setting `app.org_id` — expect 0 rows; wrap in `pytest.mark.skipif(dialect != 'postgresql', ...)`.

      Files to create:
      - `api/tests/test_isolation.py`

      Verify: `cd api && python -m pytest tests/test_isolation.py -v` — all tests pass (or are skipped on SQLite).

---

- [ ] **9. CI gate — literals scan**
      In `.github/workflows/pipeline.yaml`, add a new job `literals-scan` as a peer of `python-lint-test` under Stage 1 (`needs:` nothing; runs in parallel):

      ```yaml
      literals-scan:
        name: "Stage 1: Literals Scan"
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - name: Scan for hardcoded business literals
            run: |
              set -e
              PATTERNS=(
                "RECYC-DELHI-01"
                "PLANT-OKHLA-2"
                "EWB-2026-99210"
                "COMP-IN-001"
                "ORG-DEV-001"
                "CPCB_ACCEPTED"
                "DISPATCH_FALLBACK"
                "historical_debt_default_tons.*3600"
                "FY2026-27"
              )
              FOUND=0
              for pattern in "${PATTERNS[@]}"; do
                if grep -rn --include='*.py' -e "$pattern" api/src worker/src; then
                  echo "FAIL: hardcoded literal found: $pattern"
                  FOUND=1
                fi
              done
              if [ "$FOUND" -eq 1 ]; then exit 1; fi
              echo "literals-scan: PASSED"
      ```

      Also add `literals-scan` to the `needs:` list of `build-and-push` (alongside `python-lint-test`, `dashboard-build`, `helm-lint`).

      Files to modify:
      - `.github/workflows/pipeline.yaml`

      Verify: `gh act -j literals-scan` locally, or push to a branch and confirm the GitHub Actions job passes.

---

- [ ] **10. CI gate — mypy type check**
      In `.github/workflows/pipeline.yaml`, add a new job `type-check` as a peer of `python-lint-test` under Stage 1:

      ```yaml
      type-check:
        name: "Stage 1: mypy Type Check"
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - name: Set up Python 3.13
            uses: actions/setup-python@v5
            with:
              python-version: "3.13"
          - name: Install mypy and stubs
            run: pip install mypy types-python-slugify
          - name: Install API package
            run: pip install -e api
          - name: Run mypy
            run: cd api && python -m mypy src/ --ignore-missing-imports --no-strict-optional 2>&1 | tail -5
      ```

      Also add `type-check` to `needs:` of `build-and-push`.

      Files to modify:
      - `.github/workflows/pipeline.yaml`

      Verify: Job appears in GitHub Actions Stage 1 and does not block build-and-push if it emits warnings only (the `tail -5` output is informational; to gate hard, remove `|| true` from the pipeline if desired — current spec says run + show last 5 lines, so `exit 0` always).

---

- [ ] **11. README and stale docs update**
      Read `README.md` first (done during planning — current content has Quick Start with no Alembic step and no required-env-var call-outs).

      Update `README.md`:
      - Insert a `## Current Status` section at the very top (below the title line), listing the 7-phase implementation summary (P0 auth → P6 HITL hardening).
      - In `## Quick Start`, after step 1 (docker compose), add: `# 1b. Run database migrations` block with `cd packages/synthetiq-shared && alembic upgrade head`.
      - In `## Quick Start`, add an env-var prerequisites block calling out `SEED_ADMIN_PASSWORD`, `JWT_SECRET_KEY`, `CORS_ALLOWED_ORIGINS` as mandatory before starting.
      - Add a note: "Note: `REFACTORING_SUMMARY.md` and `ANALYSIS_FINDINGS.md` are archived and no longer maintained."

      Since `REFACTORING_SUMMARY.md` and `ANALYSIS_FINDINGS.md` **do not exist** in the repo root (confirmed during exploration), skip the ARCHIVED header sub-step.

      Files to modify:
      - `README.md`

      Verify: `cat README.md | grep -q "Current Status"` — passes (manual check).

---

## Task dependency graph

```
T1 (migration) ──┬──► T2 (workflow timeout)   [independent]
                 ├──► T3 (OTel)               [independent]
                 ├──► T4 (Prometheus)          [independent]
                 ├──► T5 (cost cap)            [requires T1: llm_usage_log]
                 ├──► T6 (HITL endpoint + dashboard) [requires T1: new WF columns]
                 └──► T8 (isolation tests)     [soft dep on T6 endpoint]

T7 (isolation tests)  [independent of T1–T6; tests existing endpoints]
T9, T10, T11          [independent CI/docs tasks]
```

Implement in this order: **T1 → T2 → T3 → T4 → T5 → T6 → T7 → T9 → T10 → T11**.

---

## Migration naming convention

New file: `packages/synthetiq-shared/alembic/versions/h3c4d5e6f7a8_phase6_hitl_hardening.py`
- `revision = 'h3c4d5e6f7a8'`
- `down_revision = 'g2b3c4d5e6f7'`  ← chains from the Phase 5 escrow-split migration
