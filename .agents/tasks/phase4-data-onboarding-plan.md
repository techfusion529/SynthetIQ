# Phase 4 — Data Onboarding: Implementation Plan

**Workspace root:** `c:\Users\HP\SynthetIQ`
**Alembic latest revision:** `c1d2e3f4a5b6` (phase2_runs)  → new migration chains from this.

---

## Key findings from codebase exploration

- `packages/synthetiq-shared/synthetiq_shared/` has `models/`, `utils/`, `constants/`, `config.py`, `database.py`, `seed.py` — but **no `schemas/` sub-package yet**.
- `DataSource` ORM in `organization.py` has `connection_config: JSON` but no `mapping`, `secret_ref` columns.
- `AuditRecord` ORM has no `ingestion_run_id` FK column yet.
- `worker/src/services/data_connector.py` `PostgreSQLConnector.query_sales_data` and `query_telemetry` use bare `f"...FROM {self.sales_table}..."` inside `text()` — identifier injection risk.
- `worker/src/services/data_connector.py` `CSVFileConnector` reads from filesystem via `_read_csv()` — must be disabled.
- `worker/src/services/data_connector.py` `get_connector_for_org()` has silent CSV seed fallback — must raise `DataSourceNotConfigured`.
- `worker/src/services/data_connector.py` `BigQueryConnector._get_client()` accepts ADC if `credentials_path` is absent — must require `service_account_ref`.
- `api/src/services/data_connector_shim.py` shim imports the worker connector; fallback shim `get_connector_for_org` returns CSV seed — must raise `DataSourceNotConfigured`.
- `api/src/routes/organizations.py` already has data-source list/create/test/preview routes; **no** mapping, validate, or upload endpoints.
- `api/src/routes/runs.py` `POST /runs` does **no** preflight check.
- `api/src/routes/__init__.py` + `api/src/main.py` — add `datasources_router` and `preflight_router` registrations here.
- No `simulate_*` / `query_erp_sales` / `fetch_recycler_bids` functions found in the current worker code; the seed fallback in `get_connector_for_org` is the primary synthetic-data path.
- Dashboard uses **Next.js 16.3.7**, React 19, MUI v5, `"use client"` components. App Router convention. Uses `BaseService`/`request<T>` pattern for all API calls. `useSession()` hook provides `token`.
- Test runner: `pytest` (both `api/` and `worker/` have pyproject.toml with no explicit pytest config, tests in `tests/` subfolder). Run with `cd api && python -m pytest tests/ -x` or `cd worker && python -m pytest tests/ -x`.

---

## Ordering constraints

1. **Alembic migration before model changes** — new columns must exist in DB before code uses them.
2. **Pydantic schemas before route code** — validators and mapping code import from `synthetiq_shared.schemas`.
3. **`DataSourceNotConfigured` exception class** defined in `data_connector.py` before any caller raises it.
4. **`datasources.py` route** (mapping/validate/upload) must be registered in `__init__.py` and `main.py`.
5. **`preflight.py` route** must be registered before `runs.py` is updated to call it.
6. **Phase 3 guard** — preflight checks for `plant_calibration`, `obligation_ledger`, `regulatory_packs` must use `try/except` around all table queries; treat exception as `ok: False, message: "Phase 3 tables not yet migrated"`.
7. **Dashboard** update last — depends on API endpoints being defined.

---

## Implementation Plan

- [ ] 1. **Create canonical Pydantic schemas package**
      Create `packages/synthetiq-shared/synthetiq_shared/schemas/` with four schema files and an `__init__.py` that exports all. Schema `net_weight_kg` on `WeighbridgeSlip` is validated with a `@model_validator` (Pydantic v2 style) asserting `net_weight_kg == gross_weight_kg - tare_weight_kg` (within 0.01 kg float tolerance).

      Files to **create**:
      - `packages/synthetiq-shared/synthetiq_shared/schemas/__init__.py`
      - `packages/synthetiq-shared/synthetiq_shared/schemas/sales.py`
      - `packages/synthetiq-shared/synthetiq_shared/schemas/telemetry.py`
      - `packages/synthetiq-shared/synthetiq_shared/schemas/logistics.py`
      - `packages/synthetiq-shared/synthetiq_shared/schemas/po.py`

      Verify: `cd packages/synthetiq-shared && python -c "from synthetiq_shared.schemas import SalesLine, TelemetryFrame, WeighbridgeSlip, Invoice, PurchaseOrder; print('OK')"` — prints `OK` without error.

- [ ] 2. **Alembic migration: phase4_data_onboarding**
      Create `packages/synthetiq-shared/alembic/versions/d4e5f6a7b8c9_phase4_data_onboarding.py` with:
      - `revision = 'd4e5f6a7b8c9'`; `down_revision = 'c1d2e3f4a5b6'`
      - **New table `ingestion_runs`**: columns `id` (UUID PK), `org_id` (FK `organizations.org_id`), `data_source_id` (String 64), `schema_type` (String 32 — `sales`/`telemetry`/`weighbridge`), `rows_read` (Integer), `rows_accepted` (Integer), `rows_quarantined` (Integer), `source_hash` (String 64), `schema_fingerprint` (String 64), `status` (String 32 default `pending`), `error` (Text nullable), `created_at` (DateTime TZ default now), `completed_at` (DateTime TZ nullable). Add RLS policy `tenant_isolation` using `current_setting('app.org_id', true)` pattern (same as phase2); wrap in `try/except` for SQLite.
      - **Add columns to `data_sources`**: `mapping` (JSON nullable), `secret_ref` (String 256 nullable).
      - **Drop column from `data_sources`**: keep `connection_config` but add `TODO` in migration comment: `# TODO Phase 5: drop connection_config after Secret Manager migration is complete`. Do NOT drop it yet — runtime code still uses it.
      - **Add nullable FK column to `audit_records`**: `ingestion_run_id` (String 64 nullable, no FK constraint — avoids hard dependency on migration order).

      Files to **create**:
      - `packages/synthetiq-shared/alembic/versions/d4e5f6a7b8c9_phase4_data_onboarding.py`

      Verify: `cd packages/synthetiq-shared && alembic upgrade head` runs without error; `alembic current` shows `d4e5f6a7b8c9`.

- [ ] 3. **Update ORM models to reflect new columns**
      Add `mapping: Mapped[dict | None]`, `secret_ref: Mapped[str | None]` to `DataSource` in `organization.py`.
      Add `ingestion_run_id: Mapped[str | None]` (nullable String 64, no FK) to `AuditRecord` in `organization.py`.
      Add `IngestionRun` SQLAlchemy ORM class to `organization.py` with all columns from item 2.
      Export `IngestionRun` from `synthetiq_shared/models/__init__.py`.
      Update conftest in `api/tests/conftest.py` to import `IngestionRun` so the test DB creates the table.

      Files to **modify**:
      - `packages/synthetiq-shared/synthetiq_shared/models/organization.py`
      - `packages/synthetiq-shared/synthetiq_shared/models/__init__.py`
      - `api/tests/conftest.py`

      Verify: `cd api && python -m pytest tests/test_api.py -x` — all existing tests pass.

- [ ] 4. **Connector hardening in worker/src/services/data_connector.py**
      All changes to this file:

      a. **Define `DataSourceNotConfigured` exception class** at module top (before connectors).

      b. **PostgreSQL — identifier safety**: In `query_sales_data` and `query_telemetry`, replace bare `f"...FROM {self.sales_table}..."` inside `text()` with `sqlalchemy.sql.quoted_name` wrapping for the table identifier, OR pre-validate table names against a whitelist regex `^[a-zA-Z_][a-zA-Z0-9_]*$` at `__init__` time and raise `ValueError` if they fail. Use `quoted_name(self.sales_table, quote=True)` from `sqlalchemy.sql`. Also fix the malformed interval syntax `INTERVAL ':hours hours'` → `INTERVAL :hours * INTERVAL '1 hour'` (or use `func.make_interval` — choose the correct async-compatible form for SQLAlchemy text queries).

      c. **PostgreSQL — read-only check**: After obtaining a connection in `query_sales_data`, execute `SELECT pg_is_in_recovery() OR current_setting('default_transaction_read_only')::boolean` and if the result is False (writable primary), log a warning but do not block (the credential enforcement is the operator's responsibility; the check is defensive telemetry).

      d. **REST — private IP blocking**: In `RESTAPIConnector.__init__`, after allowlist validation, resolve the hostname from `base_url` using `socket.getaddrinfo` and check each returned IP against private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, ::1). Raise `ValueError("REST connector resolved to private IP: {ip}")` if any match.

      e. **CSV — disable filesystem reads**: In `CSVFileConnector.query_sales_data`, `query_telemetry`, and `_read_csv`, remove the `open(file_path, ...)` call entirely. Replace with: `raise ValueError("CSV file upload required; file path access disabled. Use POST /datasources/{id}/upload instead.")`. Adjust `health_check` to always return `False` (no live source without upload).

      f. **BigQuery — require service_account_ref**: In `BigQueryConnector.__init__`, if `config.get("service_account_ref")` (or `config.get("credentials_path")`) is empty and `os.getenv("GOOGLE_APPLICATION_CREDENTIALS")` is also empty, raise `ConfigurationError("BigQuery requires service_account_ref in config; application default credentials are not permitted in production.")`. Define `ConfigurationError(ValueError)` alongside `DataSourceNotConfigured`.

      g. **get_connector_for_org — remove seed fallback**: Replace the entire fallback block (BigQuery ADC fallback + CSV seed fallback) with `raise DataSourceNotConfigured(org_id)`. Keep the DB lookup path intact.

      Files to **modify**:
      - `worker/src/services/data_connector.py`

      Verify: `cd worker && python -m pytest tests/test_worker.py -x` — existing Jev tests pass. Additionally: `cd worker && python -c "from src.services.data_connector import DataSourceNotConfigured, ConfigurationError; print('OK')"`.

- [ ] 5. **Connector hardening in api/src/services/data_connector_shim.py**
      In the shim's fallback block (the `except ImportError` branch):
      - Add `DataSourceNotConfigured` exception class (mirrors the worker definition).
      - Update fallback `get_connector_for_org` to `raise DataSourceNotConfigured(org_id)` instead of returning a CSV connector.
      - Add `DataSourceNotConfigured` to `__all__`.
      In the primary import block (try branch), also import `DataSourceNotConfigured` and `ConfigurationError` from `services.data_connector`.

      Files to **modify**:
      - `api/src/services/data_connector_shim.py`

      Verify: `cd api && python -c "from src.services.data_connector_shim import DataSourceNotConfigured; print('OK')"` — prints `OK`.

- [ ] 6. **Create api/src/routes/datasources.py — mapping, validate, upload endpoints**
      New router with prefix `/datasources`, tag `Data Source Mapping`:

      - `PUT /datasources/{source_id}/mapping` — auth: TenantCtx, admin role only (`datasources:write`).
        Body: `{"mapping": {"source_column": "canonical_field", ...}}`.
        Validate every `canonical_field` value is a known field name in one of the four canonical schemas (`SalesLine`, `TelemetryFrame`, `WeighbridgeSlip`/`Invoice`, `PurchaseOrder`) — use `model_fields` from Pydantic v2. Return 422 with `{"error": "unknown canonical field 'xyz'"}` on first unknown. On success: fetch the DataSource, apply mapping to stored rows via preview (same 5-row fetch used in organizations.py `preview_data_source`), store `mapping` on `ds.mapping`, return `{"source_id", "mapping", "preview_rows": [...5 transformed dicts...]}`.

      - `POST /datasources/{source_id}/validate` — auth: TenantCtx, `datasources:read`.
        Preflight validate: fetch 10 rows from source using connector, apply `ds.mapping`, validate each row against the canonical schema derived from `ds.purpose` (erp_sales → SalesLine, scada_telemetry → TelemetryFrame, erp_po → PurchaseOrder, else WeighbridgeSlip). Return `{"valid": bool, "total_rows": int, "valid_rows": int, "errors": [{"row": int, "field": str, "message": str}], "sample_rows": [...]}`.

      - `POST /datasources/{source_id}/upload` — auth: TenantCtx, `datasources:write`.
        Accepts `multipart/form-data` with field `file` (UploadFile). Reject if content-type ≠ `text/csv` or size > 52_428_800 bytes (50 MB). Parse CSV with `csv.DictReader` from `io.StringIO(content.decode("utf-8"))`. Return first 5 rows as `{"source_id", "rows_total": int, "preview_rows": [...5 rows...], "columns": [...]}`. Do NOT persist to disk. Store the CSV content in a temporary in-memory cache keyed by `source_id` (use a module-level dict `_csv_cache: dict[str, list[dict]]`) for subsequent validate calls. Note: this is ephemeral (process restart clears it); a proper object-store-backed implementation is Phase 5.

      Route discovery: both `PUT` and `POST` endpoints use `assert_same_org` by looking up the DataSource's `org_id` and comparing to `tenant_ctx.org_id`.

      Files to **create**:
      - `api/src/routes/datasources.py`

      Verify: `cd api && python -c "from src.routes.datasources import router; print(router.prefix)"` — prints `/datasources`.

- [ ] 7. **Create api/src/routes/preflight.py — preflight check and gate**
      New router with prefix `/runs`, tag `Preflight`:

      - `GET /runs/preflight` — auth: TenantCtx required.
        Returns `{"ready": bool, "checks": [{"name": str, "ok": bool, "message": str}]}`.
        Checks (in order):
        1. `data_source_configured` — `SELECT COUNT(*) FROM data_sources WHERE org_id=? AND is_active=true` > 0.
        2. `column_mapping_valid` — fetch active DataSource, check `ds.mapping` is not None and not empty.
        3. `active_regulatory_pack` — `try: SELECT id FROM regulatory_packs WHERE org_id=? AND is_active=true LIMIT 1 except: ok=False, message="Phase 3 tables not yet migrated"`.
        4. `plant_calibration` — `try: SELECT id FROM plant_calibrations WHERE org_id=? LIMIT 1 except: ok=False, message="Phase 3 tables not yet migrated"`.
        5. `obligation_ledger` — `try: SELECT id FROM obligation_ledger WHERE org_id=? LIMIT 1 except: ok=False, message="Phase 3 tables not yet migrated"`.
        `ready = all(c["ok"] for c in checks)`.

      Files to **create**:
      - `api/src/routes/preflight.py`

      Verify: `cd api && python -c "from src.routes.preflight import router; print(router.prefix)"` — prints `/runs`.

- [ ] 8. **Register new routers in __init__.py and main.py; gate POST /runs with preflight**

      a. In `api/src/routes/__init__.py`: import `router as datasources_router` from `.datasources` and `router as preflight_router` from `.preflight`; add both to `__all__`.

      b. In `api/src/main.py`: import `datasources_router, preflight_router`; add `app.include_router(datasources_router, prefix=API_V1_STR)` and `app.include_router(preflight_router, prefix=API_V1_STR)`.  The preflight router must be included **before** `runs_router` to avoid route shadowing (both use `/runs` prefix — since `GET /runs/preflight` has a literal path segment it takes priority over `GET /runs/{run_id}` in FastAPI's ordering).

      c. In `api/src/routes/runs.py` `create_run`: at the start of the handler, after resolving `org_id`, call the preflight logic. Import and call `run_preflight_checks(org_id, session)` (extracted helper from `preflight.py`). If `preflight["ready"] is False`, raise `HTTPException(status_code=422, detail={"error": "preflight_failed", "preflight": preflight})`.

      Files to **modify**:
      - `api/src/routes/__init__.py`
      - `api/src/main.py`
      - `api/src/routes/runs.py`

      Verify: `cd api && python -m pytest tests/test_api.py -x` — all existing tests pass. `cd api && python -c "from src.main import app; routes=[r.path for r in app.routes]; assert any('/runs/preflight' in r for r in routes), routes"` — assertion passes.

- [ ] 9. **Dashboard: update datasources page**
      Read `dashboard/node_modules/next/dist/docs/` before writing any code. The project uses Next.js 16 App Router with `"use client"` directive, MUI v5 component library, `useSession()` from `../lib/contexts/SessionContext`, `BaseService`/`request<T>` HTTP pattern, TypeScript strict mode.

      Changes to `dashboard/app/datasources/page.tsx`:

      a. **Remove CSV file path UI** — delete the `configJson` default for `csv` type that sets `"sales_file_path": "./data/seed/sales.csv"`; replace the CSV template with: `'{\n  "delimiter": ","\n  // Upload file via the Upload section below\n}'`.

      b. **Add `secret_ref` field to the Add Connection dialog** — below the description field, add a `TextField` with `label="Secret reference (stored in Secret Manager)"`, `value={secretRef}`, `onChange`, `helperText="Reference key for credentials stored in Secret Manager (Phase 5). Leave blank if using connection_config."`. Wire to new `secretRef` state. Include `secret_ref: secretRef` in the `POST` body.

      c. **Add column mapping UI** — after selecting a data source card, show a collapsible section (use MUI `Accordion`) titled "Column Mapping". Inside: a table of source columns (derived from last preview) mapped to canonical field dropdowns. Canonical field options are hard-coded from the four schemas: `SalesLine` fields, `TelemetryFrame` fields, `WeighbridgeSlip` fields, `PurchaseOrder` fields — grouped by schema type. A "Save Mapping" button calls `PUT /api/v1/datasources/{source_id}/mapping` with `{mapping: {...}}`. Show success/error Alert.

      d. **Add Validate button** — in the card action row, add a "Validate Schema" button calling `POST /api/v1/datasources/{source_id}/validate`. Display result in a Dialog showing valid row count, error list (row number, field, message), and sample rows.

      e. **Add Upload CSV section** — in the card for CSV-type sources, show a file input (`<input type="file" accept=".csv">`) and "Upload" button. On click, build `FormData`, append the file, POST to `POST /api/v1/datasources/{source_id}/upload`. Show preview rows in a table after upload. Enforce 50 MB limit client-side before submitting with a check on `file.size > 52_428_800`.

      f. **Add `DataSourceService`** — create `dashboard/app/lib/services/datasource.service.ts` extending `BaseService` with methods:
        - `updateMapping(sourceId, mapping)` → `PUT /api/v1/datasources/{sourceId}/mapping`
        - `validateMapping(sourceId)` → `POST /api/v1/datasources/{sourceId}/validate`
        - `uploadCsv(sourceId, file)` → raw `fetch` (multipart, not JSON — BaseService does not support multipart; use `fetch` directly with `Authorization` header)

      g. Export `DataSourceService` from `dashboard/app/lib/services/index.ts`.

      h. Update `organization.types.ts`: add `mapping?: Record<string, string>` and `secret_ref?: string` to the `DataSource` interface.

      Files to **create**:
      - `dashboard/app/lib/services/datasource.service.ts`

      Files to **modify**:
      - `dashboard/app/datasources/page.tsx`
      - `dashboard/app/lib/services/index.ts`
      - `dashboard/app/lib/types/organization.types.ts`

      Verify: `cd dashboard && npm run build` — exits 0 with no TypeScript errors.

---

## Risks and ordering notes

| Risk | Mitigation |
|------|------------|
| Phase 3 tables absent | All preflight checks for `regulatory_packs`, `plant_calibrations`, `obligation_ledger` wrapped in `try/except`; fallback `ok=False, message="Phase 3 tables not yet migrated"` |
| `connection_config` removal | Do NOT drop the column in this phase; add `secret_ref` alongside it; comment in migration marks it for Phase 5 removal |
| Alembic on SQLite (dev) | RLS `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` wrapped in `try/except` as in phases 1 & 2 |
| `GET /runs/preflight` vs `GET /runs/{run_id}` routing conflict | Register `preflight_router` before `runs_router` in `main.py` so FastAPI processes the literal `/preflight` path before the parameterized `/{run_id}` |
| Dashboard Next.js 16 breaking changes | Read `node_modules/next/dist/docs/` before writing; `"use client"` required on all interactive components; no `getServerSideProps` in App Router |
| CSV upload is ephemeral | Module-level dict `_csv_cache` — document as Phase 5 to-do for object store |
| BigQuery ADC removal | `ConfigurationError` only raised if both `service_account_ref` and `GOOGLE_APPLICATION_CREDENTIALS` are absent; dev/CI still works if `GOOGLE_APPLICATION_CREDENTIALS` env is set |
