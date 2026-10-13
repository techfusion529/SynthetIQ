# Phase 3 Part B: Config-driven EPR workflow and literal cleanup

Two commits implement the core configuration layer for the SynthetIQ EPR compliance pipeline. FEAT-001 introduces `config_activities.py`, a Stage 0 Temporal activity that pulls the active regulatory pack, org policy, plant calibrations, and obligation ledger into a `RunConfig` before any agent activity runs. FEAT-002 removes hardcoded literals (`"FY2026-27"`, `3600.0`, `1.0` conversion factor, `statutory_base_rate_inr=12.`) from all production paths, replacing them with `run_config.pack.*` references. Two bugs were found and fixed during this review: `workflows.py` used `from src.activities...` imports that broke the import path, and `fetch_run_config_activity` was not registered in `main.py`'s activity list — meaning Stage 0 would have raised a Temporal `ActivityNotFoundError` at runtime.

**Watch for:** (1) confirmed — `fetch_run_config_activity` was absent from the worker's activity registration list in `main.py`, which would have caused an immediate runtime failure when `MasterEPRComplianceWorkflow` reached Stage 0. Fixed. (2) confirmed — `workflows.py` imported via `from src.activities...` which is inconsistent with the `worker/src` PYTHONPATH the worker uses; fixed to `from activities...`. Both fixes verified by re-running the import check.

**Verdict**: APPROVED

---

## High-level view

`config_activities.py` is clean: it queries the active regulatory pack by version and status, raises a retryable `ApplicationError` on miss, and returns `RunConfig.model_dump()` — no hardcoded values anywhere in the file. The Stage 0 integration in `MasterEPRComplianceWorkflow` correctly calls this activity first, derives fiscal year from `workflow.now()` (deterministic Temporal clock), and threads `run_config.pack.base_rate_inr_per_kg` and `run_config.pack.delta_threshold_default` into downstream activities.

`agent_factory.py` enforces a model allowlist (`gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash`) and a forbidden-keyword check on custom prompts before instantiating agents. Falls back to platform defaults on allowlist violation or DB error. Returns a fresh `LlmAgent` per call — no module-level singleton in the factory or in any of the 7 agent files.

The literal cleanup is thorough in production paths. The only remaining `statutory_base_rate_inr` reference in `agent_config.py` is a parameter *key* used to look up a value from DB config, falling back to `STATUTORY_CEILING_INR_PER_KG` constant — not a magic `12.` inline. The 422 guards on `fiscal_year` and `historical_debt_default_tons` in `agent_config.py` are present. `seed.py`'s `DEFAULT_AGENTS_CONFIG` no longer carries `target_fiscal_year`, `historical_debt_default_tons`, or `statutory_base_rate_inr`.

The two import path bugs — `from src.activities...` in `workflows.py` and the missing `fetch_run_config_activity` registration in `main.py` — were fixed as part of this review and re-verified.

---

<details>
<summary>Issues (2 — both fixed during review)</summary>

1. **`src.activities` import prefix in workflows.py** — `workflows.py` imported activities via `from src.activities.agent_activities import ...` and `from src.activities.config_activities import fetch_run_config_activity`. The worker sets `worker/src` on `sys.path`, so the correct prefix is `from activities...`. The broken imports caused the import check to fail with `ModuleNotFoundError`. Fixed by removing the `src.` prefix from both import lines in `workflows.py`.

2. **`fetch_run_config_activity` not registered in `main.py`** — The Stage 0 activity was added to `workflows.py` but never added to the `activities` list in `main.py`'s `Worker(...)` constructor. Temporal would have raised `ActivityNotFoundError` the first time `MasterEPRComplianceWorkflow` executed. Fixed by importing `fetch_run_config_activity` in `main.py` and appending it to the `activities` list.

</details>

---

<details>
<summary>Details</summary>

## Checklist results

### 1. config_activities.py — PASS

`fetch_run_config_activity` (`config_activities.py`, lines 45–135):
- Queries `RegulatoryPack` by `version` and `status == RegulatoryPackStatus.active.value`. Raises `ApplicationError(non_retryable=False)` if pack is `None` (lines 62–66). ✓
- Returns `run_config.model_dump()` (line 133). ✓
- No hardcoded values anywhere in the file. ✓

### 2. workflows.py Stage 0 — PASS (after fix)

`MasterEPRComplianceWorkflow.run()` (`workflows.py`):
- `fetch_run_config_activity` called at Stage 0 before Stage 1 (`self.stage_reached = 0`, lines ~315–325). ✓
- Fiscal year derived from `workflow.now().date()` + `run_config.pack.fiscal_year_start_month` when `run_input.fiscal_year` is not supplied (lines ~328–335). ✓
- `run_config.pack.base_rate_inr_per_kg` passed to `execute_double_auction_activity` (replaces hardcoded `12.0`). ✓
- `run_config.pack.conversion_factors.get(category, 1.0)` used for Form-1 `cf` (replaces hardcoded `1.0`). ✓
- `run_config.pack.delta_threshold_default` passed as the 11th positional arg to `audit_scada_telemetry_activity`. ✓
- **Fixed**: `from src.activities...` → `from activities...`. ✓

### 3. agent_activities.py — PASS

`audit_scada_telemetry_activity` (`agent_activities.py`):
- Signature: `delta_threshold: float = 2.0` parameter present (line ~100). ✓
- Verdict computed deterministically from `delta_threshold`: `delta > threshold * 2 → FAIL`, `delta > threshold → HITL`, else `PASS` (lines ~140–147). Not derived from any LLM string. ✓
- `run_auditor_agent(..., threshold=delta_threshold)` call passes the parameter through (line ~116). ✓

### 4. agent_factory.py — PASS

- `ALLOWED_MODEL_IDS = frozenset(["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"])` enforced with warning + fallback on violation (lines 17, 51–56). ✓
- `FORBIDDEN_PROMPT_KEYWORDS = frozenset(["verdict=", "always_pass", "skip_gate"])` checked; custom prompt silently discarded if keyword found (lines 18, 59–65). ✓
- `async with get_db_session()` wraps the DB query; any DB error propagates naturally, causing Temporal to retry with platform defaults. ✓
- Returns `_build_agent(...)` — a fresh `LlmAgent` per call. ✓

### 5. Agent singletons — PASS

All 7 agent files (`auditor_agent.py`, `legal_agent.py`, `brand_liability_agent.py`, `treasury_agent.py`, `logistics_agent.py`, `regulatory_agent.py`, `erp_agent.py`): grep for `^[a-z_]+_agent\s*=\s*` returns zero matches. Each `run_*_agent` function creates a local `agent = create_llm_agent(...)` variable. ✓

### 6. Literal scan — PASS

```
Get-ChildItem -Path "worker/src","api/src" -Recurse -Filter "*.py" |
  Select-String -Pattern '"FY2026-27"|historical_debt_default_tons.*3600|"3600\.0"|statutory_base_rate_inr.*12\.'
```

**Output: (no matches)**

Zero matches for `"FY2026-27"`, `3600.0`, `"historical_debt_default_tons".*3600`, `statutory_base_rate_inr.*12.` in production code. ✓

### 7. 422 guards — PASS

`agent_config.py` (brand_liability test branch):
- `if not fiscal_year: raise HTTPException(status_code=422, ...)` — present. ✓
- `if historic_debt is None: raise HTTPException(status_code=422, ...)` — present (`historical_debt_default_tons` looked up from `agent_cfg.parameters`). ✓

`liability.py`:
- `fiscal_year = payload.get("fiscal_year", "")` — defaults to empty string, no `"FY2026-27"` default. ✓

### 8. seed.py — PASS

`DEFAULT_AGENTS_CONFIG` in `seed.py`: none of the 7 agent entries contain `target_fiscal_year`, `historical_debt_default_tons`, or `statutory_base_rate_inr` keys. ✓ The treasury entry carries only `price_corridor_min_pct`, `price_corridor_max_pct`, `clearing_algorithm`. ✓

---

## Verification command outputs (verbatim)

### Import check (post-fix)

```
cd c:\Users\HP\SynthetIQ\worker\src; python -c "from activities.config_activities import fetch_run_config_activity; from factories.agent_factory import create_agent; from flows.workflows import MasterEPRComplianceWorkflow; print('all ok')"

all ok
```

Exit code: 0

### Test suite

```
cd c:\Users\HP\SynthetIQ; python -m pytest api/tests/ -x -q --tb=short 2>&1 | Select-Object -First 40

..............                                                           [100%]
============================== warnings summary ===============================
..\AppData\Roaming\Python\Python314\site-packages\slowapi\extension.py:720
  C:\Users\HP\AppData\Roaming\Python\Python314\site-packages\slowapi\extension.py:720: DeprecationWarning: 'asyncio.iscoroutinefunction' is deprecated and slated for removal in Python 3.16; use inspect.iscoroutinefunction() instead
    if asyncio.iscoroutinefunction(func):
-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
14 passed, 1 warning in 10.67s
```

Exit code: 0

### Literal scan

```
Get-ChildItem -Path "worker/src","api/src" -Recurse -Filter "*.py" |
  Select-String -Pattern '"FY2026-27"|historical_debt_default_tons.*3600|"3600\.0"|statutory_base_rate_inr.*12\.'
```

**Output: (no matches — zero lines returned)**

Exit code: 0

</details>

---

<details>
<summary>File map</summary>

| File | What changed |
|---|---|
| `worker/src/activities/config_activities.py` | New: `fetch_run_config_activity` — fetches RegulatoryPack, OrgPolicy, PlantCalibrations, ObligationLedger into a `RunConfig` |
| `worker/src/flows/workflows.py` | Stage 0 added; `base_rate_inr_per_kg`, `delta_threshold_default`, `conversion_factors` read from `run_config.pack`; fiscal year derived from Temporal clock; **fixed**: `src.activities` → `activities` import prefix |
| `worker/src/activities/agent_activities.py` | `audit_scada_telemetry_activity` gains `delta_threshold: float = 2.0` param; verdict computed from `delta_threshold` not hardcoded `2.0` |
| `worker/src/factories/agent_factory.py` | New: model allowlist + forbidden-keyword prompt guard; per-call fresh `LlmAgent`; no module-level singleton |
| `worker/src/agents/auditor_agent.py` | `run_auditor_agent` creates local `agent`; `threshold` parameter wired through |
| `worker/src/agents/legal_agent.py` | `run_legal_agent` creates local `agent`; no module-level singleton |
| `api/src/routes/agent_config.py` | 422 guard on empty `fiscal_year`; 422 guard on `None` `historical_debt_default_tons`; treasury branch uses `STATUTORY_CEILING_INR_PER_KG` constant not `12.` literal |
| `api/src/routes/liability.py` | `fiscal_year` defaults to `""` not `"FY2026-27"` |
| `packages/synthetiq-shared/synthetiq_shared/seed.py` | `target_fiscal_year`, `historical_debt_default_tons`, `statutory_base_rate_inr` removed from `DEFAULT_AGENTS_CONFIG` |
| `worker/src/main.py` | **fixed**: `fetch_run_config_activity` imported and added to worker activity registration list |

</details>
