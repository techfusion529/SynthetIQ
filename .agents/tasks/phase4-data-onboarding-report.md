# Phase 4 — Data Onboarding: Implementation Report

## Summary

All seven Phase 4 data-onboarding tasks were implemented across the workspace and verified clean. The primary fix in this verification pass was correcting a `ForeignKey("organizations.id")` typo in `ingestion_run.py` to `ForeignKey("organizations.org_id")` (the actual PK column name on the `organizations` table) and registering `IngestionRun` in `conftest.py` so the test DB creates the table — these two changes brought pytest from 1 error / 0 passed to **14 passed, 0 errors**. All other checks (schema import, py_compile, tsc) pass cleanly.

---

## Task Results

### Task 1 — Canonical Schemas
- Status: **PASS**
- Files created:
  - `packages/synthetiq-shared/synthetiq_shared/schemas/__init__.py`
  - `packages/synthetiq-shared/synthetiq_shared/schemas/sales.py` (`SalesLine`)
  - `packages/synthetiq-shared/synthetiq_shared/schemas/telemetry.py` (`TelemetryFrame`)
  - `packages/synthetiq-shared/synthetiq_shared/schemas/logistics.py` (`WeighbridgeSlip`, `Invoice`)
  - `packages/synthetiq-shared/synthetiq_shared/schemas/po.py` (`PurchaseOrder`)
- Verification: `from synthetiq_shared.schemas import SalesLine, TelemetryFrame, WeighbridgeSlip; print('schemas ok')` → `schemas ok`

### Task 2 — Alembic Migration + IngestionRun Model
- Status: **PASS**
- Migration file: `packages/synthetiq-shared/alembic/versions/e7f8a9b0c1d2_add_ingestion_runs.py` (revision `e7f8a9b0c1d2`, down_revision `d4e5f6a7b8c9`)
- Model file: `packages/synthetiq-shared/synthetiq_shared/models/ingestion_run.py`
- Notes: Migration creates `ingestion_runs` table with FK `organizations.org_id`, adds `mapping`/`secret_ref` columns to `data_sources`, adds `ingestion_run_id` nullable column to `audit_records`, and applies RLS policies for PostgreSQL (wrapped in try/except for SQLite). The `ingestion_run.py` model had a bug (`ForeignKey("organizations.id")`) fixed to `ForeignKey("organizations.org_id")` to match the actual PK.

### Task 3 — Connector Hardening
- Status: **PASS**
- py_compile: **PASS** (exit 0)
- Changes:
  - `ConfigurationError` defined in shim fallback block
  - `DataSourceNotConfigured` defined with `org_id` attribute in shim
  - SSRF check: `_is_private_ip` helper + `socket.getaddrinfo` loop in `RESTAPIConnector.__init__`
  - CSV disabled: `CSVFileConnector.query_sales_data` raises `NotImplementedError("CSV file path access disabled; use file upload")`
  - BigQuery `service_account_ref` guard: `BigQueryConnector.__init__` raises `ConfigurationError` when `service_account_ref` is absent
  - `get_connector_for_org` fallback raises `DataSourceNotConfigured(org_id)` instead of returning CSV seed connector

### Task 4 — Datasource Endpoints
- Status: **PASS**
- Endpoints registered: `PUT /datasources/{id}/mapping`, `POST /datasources/{id}/validate`, `POST /datasources/{id}/upload`
- py_compile: **PASS** (exit 0)
- File: `api/src/routes/datasources.py`

### Task 5 — Preflight Check
- Status: **PASS**
- `GET /runs/preflight`: implemented as `get_preflight()` in `api/src/routes/runs.py` with checks for `active_regulatory_pack`, `data_source_configured`, `column_mapping_valid`, `plant_calibration`, `obligation_ledger`
- `POST /runs` guard: `create_run()` calls `_run_preflight_checks()` and raises HTTP 422 if `ready` is False
- py_compile: **PASS** (exit 0)

### Task 6 — Synthetic Data Removal
- Status: **PASS**
- `query_erp_sales`: present in `worker/src/agents/brand_liability_agent.py` as a legitimate ADK tool function — it delegates to `_fetch_sales()` which calls the real DataConnector (MCP gateway first, then registered BigQuery/PostgreSQL connector). Synthetic data generator was removed in commit `935bce9`.
- `fetch_recycler_bids`: present in `worker/src/agents/treasury_agent.py` as a legitimate ADK tool stub that logs `"fetch_recycler_bids: no real recycler connector configured"` — the warning is the hardening marker indicating no synthetic fallback data is returned (returns `[]`).
- `simulate_*` functions: none found in `api/src` or `worker/src`.

### Task 7 — Dashboard
- Status: **PASS**
- tsc --noEmit: **PASS** (exit 0, no errors)
- Changes implemented in `dashboard/app/datasources/page.tsx`:
  - CSV path removed: CSV config template no longer includes `sales_file_path`; replaced with `"delimiter": ","` only
  - File upload added: CSV-type sources display an upload section with `<input type="file" accept=".csv">`, size guard (50 MB client-side), and a `POST /datasources/{id}/upload` call with preview table
  - Mapping table added: collapsible MUI Accordion per datasource with source column → canonical field dropdown rows, Add Row, Save Mapping (`PUT /datasources/{id}/mapping`)
  - Validate button added: "Validate" button per card calling `POST /datasources/{id}/validate` with Alert result
  - `secret_ref` display: masked config panel shows `secret_ref` key when present; `maskConfig` helper masks sensitive keys

---

## Verification Output

### Schema import
```
schemas ok
```
(Exit code 0)

### py_compile
```
shim:0
runs:0
datasources:0
ingestion_run:0
```
All four files compile cleanly.

### pytest
```
..............                                                           [100%]
============================== warnings summary ===============================
C:\Users\HP\AppData\Roaming\Python\Python314\site-packages\slowapi\extension.py:720: DeprecationWarning: 'asyncio.iscoroutinefunction' is deprecated...
1 warning in 8.46s
14 passed, 1 warning in 8.46s
```
All 14 tests pass. (Before fix: `1 error — sqlalchemy.exc.NoReferencedColumnError: table 'organizations' has no column named 'id'`)

### tsc
```
(no output — exit code 0)
```
TypeScript check passes with zero errors.

### Synthetic data scan
```
worker\src\agents\brand_liability_agent.py:43: def query_erp_sales(...)
worker\src\agents\treasury_agent.py:18: def fetch_recycler_bids(...)
worker\src\agents\orchestrator.py, worker\src\factories\agent_factory.py: import/use above
```
Both functions are legitimate ADK agent tool functions wired to real connectors. `query_erp_sales` calls `get_connector_for_org` (real DataConnector); `fetch_recycler_bids` returns `[]` with a warning log when no recycler connector is configured. No synthetic data generators (`simulate_*`, hardcoded return lists, seed CSV reads) were found.

---

## Issues / Blockers

- **Fixed**: `ingestion_run.py` had `ForeignKey("organizations.id")` which references a non-existent column — corrected to `ForeignKey("organizations.org_id")` to match the actual PK of the `organizations` table.
- **Fixed**: `api/tests/conftest.py` did not import `IngestionRun` before calling `Base.metadata.create_all`, causing the FK resolution to fail at test DB setup. Added `IngestionRun` to the import block.
- **No remaining blockers**: all verification commands exit 0.
