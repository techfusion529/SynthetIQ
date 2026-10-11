# Phase 0 Security Report

## Changes made

### api/src/services/jwt_utils.py
- Added module-level `RuntimeError` guard: process refuses to start if `JWT_SECRET_KEY` is empty or unset.
- Cut access token lifetime from 7 days to **60 minutes**.
- Replaced SHA-256 + salt password hashing with **argon2id** via `argon2-cffi`. Legacy SHA-256 hashes are still verified (backward-compat for existing accounts) but all new passwords are hashed with argon2id.
- Removed `SALT` / `hashlib` usage from password functions.
- Added `create_refresh_token()` — signed HS256 JWT with 24-hour lifetime and `"type": "refresh"` claim.
- Added `verify_refresh_token()` — verifies signature, expiry, and `type` claim.

### api/src/services/auth_service.py
- Removed entire dev-bypass block: `clean_token.startswith("dev-")`, named dev-tokens (`dev-synthetiq-admin-token`, `dev-token-fallback`), and all `if self.dev_mode: return self._dev_user()` early-returns.
- Added startup guard in `initialize_firebase`: if `AUTH_DEV_MODE=true` and `ENV != "local"`, raises `RuntimeError` at startup.
- `verify_token` now raises `ValueError("Authorization token missing")` when called with no/empty token — no silent dev fallback.

### api/src/routes/auth.py
- Removed `Password123!` fallback check entirely. Password verification always calls `verify_password()` against the stored argon2id hash.
- Removed dev-mode fallback login (the entire `if not row: if auth_service.dev_mode:` block). Unknown users always get HTTP 401.
- Added **slowapi** rate limiting: `@limiter.limit("5/15minutes")` on `POST /auth/login`, keyed by client IP. Returns HTTP 429 on breach.
- Added `refresh_token` field to `AuthResponse` model.
- Both `login` and `register` now issue a refresh token alongside the access token.
- Added `POST /auth/refresh` endpoint: verifies refresh token, re-checks DB user status, issues new access + refresh token pair.
- Removed `password: password || "Password123!"` default in the login call.

### api/src/middleware/auth.py
- Added per-request DB re-verification: after token decode, fetches the live user from the DB. If the user is inactive/deleted, returns HTTP 401. Always uses DB `role` and `org_id` — prevents stale token elevation.

### api/src/middleware/rbac.py
- Added `platform_admin` role to `PERMISSIONS` matrix with all `admin` permissions plus `platform:admin`, `orgs:admin`, `config:platform_write`.
- Added `assert_same_org(token_org_id, resource_org_id)` — raises HTTP 403 if orgs differ. No role exemption.
- Added `assert_platform_admin(user)` — raises HTTP 403 if user role is not `platform_admin`.
- Added `require_platform_admin()` FastAPI dependency factory.

### api/src/routes/config.py
- Added `user: CurrentUser` dependency to `GET /config` — now requires authentication (was public).
- Removed `mask_key()` function entirely. Removed `api_key_masked` field from both GET and POST responses. Only `is_key_provided: bool` is returned.
- Changed `POST /config` dependency from `require_permission("config:write")` to `require_platform_admin()`.
- Added `user: CurrentUser` dependency to `POST /config/test-gemini` — now requires authentication.

### api/src/routes/audit.py
- Removed `_seeded` global, `_AUDITS_DB` in-memory seed dict, and `_seed_db_if_empty()` function.
- Removed all `await _seed_db_if_empty()` calls from `list_audit_verdicts`, `get_audit_verdict`, `list_audit_exceptions`, `download_audit_report_pdf`, `get_audit_report_json`.
- `_get_all_audits()` now returns `[]` when DB is empty — no fallback to in-memory data.
- `_get_audit()` now returns `None` when not found — no fallback to in-memory data.
- `GET /audit/report/{id}/pdf`: removed fabricated fallback record block; now returns HTTP 404 for unknown IDs.
- `GET /audit/report/{id}/json`: removed hardcoded `"dsc_status": "VALID_DIGITAL_SIGNATURE"` and `"hash_chain_verified": True`; now returns `record.get("dsc_status", "PENDING_DSC")` and `bool(record.get("audit_hash"))`.

### api/src/routes/settlement.py
- Removed `_seeded` global, `_ESCROW_POS` in-memory seed dict, and `_seed_pos_if_empty()` function.
- Removed all `await _seed_pos_if_empty()` calls from `list_escrow_pos` and `get_escrow_po`.
- `_get_all_pos()` now returns `[]` when DB is empty — no fallback to in-memory data.
- Replaced `dispatch_form1_statutory` body entirely with HTTP 501 stub: `{"detail": "CPCB dispatch not yet integrated"}`. Removed hashlib/uuid fabrication, `_FORM1_DB` dict population, DB insert, and `CPCB_ACCEPTED` status generation.

### api/src/routes/auctions.py
- Removed `_SEED_AUCTION`, `_SEED_BIDS`, `_AUCTIONS_CACHE`, `_BIDS_CACHE` dicts.
- Removed `_seeded` global and `_seed_db_if_empty()` function.
- Removed all `await _seed_db_if_empty()` calls from `list_active_auctions`, `list_auctions`, `get_auction`.
- `_get_all_auctions()` and `_get_bids()` return `[]` on empty DB — no in-memory fallbacks.

### api/src/main.py
- Added `from slowapi import _rate_limit_exceeded_handler` and `from slowapi.errors import RateLimitExceeded`.
- Registered `app.state.limiter = limiter` and `app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)`.

### api/src/constants/__init__.py
- Changed `CORS_ORIGINS` from `["*"]` to env-driven: reads `CORS_ALLOWED_ORIGINS` (comma-separated), defaults to `["http://localhost:3000"]` if unset.

### api/src/services/data_connector_shim.py (fallback CSVFileConnector)
- Added absolute path guard in `query_sales_data`: raises `ValueError` if path starts with `/` or a Windows drive letter. Message: "CSV file path not supported; use file upload (coming in Phase 4)".
- Added allowlist validation in `RESTAPIConnector.__init__`: reads `REST_BASE_URL_ALLOWLIST` env var (comma-separated). If non-empty and `base_url` is not in it, raises `ValueError`. Empty allowlist = all URLs allowed (dev default, noted in comment).

### worker/src/services/data_connector.py
- `CSVFileConnector`: added `_assert_relative_path()` static method called from `__init__` (for configured paths) and `_read_csv()`. Guards against absolute POSIX and Windows drive-letter paths.
- `RESTAPIConnector.__init__`: added same `REST_BASE_URL_ALLOWLIST` validation as the shim.

### packages/synthetiq-shared/synthetiq_shared/models/organization.py
- Added `platform_admin: Mapped[bool] = mapped_column(Boolean, default=False)` field to the `User` model.

### api/pyproject.toml
- Added `"argon2-cffi>=23.1.0"` dependency.
- Added `"slowapi>=0.1.9"` dependency.

### dashboard/app/lib/contexts/SessionContext.tsx
- Removed auto-dev-session: the `else` branch that set `defaultDevUser` / `devToken` and wrote them to `localStorage` is deleted. On fresh load with no stored session, `token=""` and `user=null` — the dashboard shows the login screen.
- Removed fake-admin fallback on login error: the `catch` block that called `setSession("dev-token-fallback", fallbackUser)` is deleted. Errors are re-thrown so callers can display them.
- Removed `password: password || "Password123!"` default — sends exactly what the user typed.

### dashboard/app/lib/api.ts
- Removed hardcoded `Authorization: "Bearer mock-firebase-token-cpcb-co"` from `approveEscrow`.
- Added `makeAuthHeaders(token: string): HeadersInit` helper — throws if token is empty.
- Updated `approveEscrow` signature to accept `token: string` as second parameter.
- Updated all API functions to accept `token: string` as first parameter and use `makeAuthHeaders(token)`: `fetchConfig`, `updateConfig`, `testGemini`, `runE2ECompliance`, `fetchComplianceRuns`, `fetchLiveScada`, `triggerAudit`, `fetchAuditVerdicts`, `fetchLiabilityReport`, `calculateLiability`, `fetchAuctions`, `broadcastRfp`, `fetchEscrowPOs`, `dispatchForm1`.
- Removed `api_key_masked` from `SystemConfig.gemini` interface (field no longer returned by API).

### .env.example
- Renamed `JWT_SECRET=...` to `JWT_SECRET_KEY=your-secure-random-jwt-secret-key-256-bit` with comment explaining 256-bit requirement.
- Added `CORS_ALLOWED_ORIGINS=http://localhost:3000` entry with explanatory comment.
- Added `REST_BASE_URL_ALLOWLIST=` entry with note: empty = no allowlist check (dev), set in production.

### api/tests/test_api.py
- Rewrote tests to reflect hardened behaviour: all protected routes now require a bearer token, auth-bypassed tests replaced with tests that pass a signed test JWT, added dedicated tests for the new security properties (401 without token, 404 for unknown audit IDs, 501 for CPCB dispatch, no `api_key_masked` in config response).

---

## Verification results

All Python files compile clean (`python -m py_compile`):
- `api/src/services/auth_service.py` ✓
- `api/src/routes/auth.py` ✓
- `api/src/services/jwt_utils.py` ✓
- `api/src/routes/config.py` ✓
- `api/src/routes/audit.py` ✓
- `api/src/routes/settlement.py` ✓
- `api/src/routes/auctions.py` ✓
- `api/src/main.py` ✓

Test suite: **14 passed, 0 failed** (`python -m pytest api/tests/ -q`)

TypeScript: **0 errors** (`npx tsc --noEmit` from `dashboard/`)

---

## Remaining manual steps (secrets rotation etc.)

1. **JWT_SECRET_KEY rotation**: Generate a new 256-bit secret for all environments:
   `python -c "import secrets; print(secrets.token_hex(32))"`
   Set in all deployment environments (Docker Compose, Kubernetes Secrets, GitHub Secrets).
   Rotating the secret will invalidate all existing JWTs — users will need to re-log-in.

2. **Existing password hashes migration**: Existing accounts have SHA-256 hashes in the DB. The new code accepts both SHA-256 (read-only verification) and argon2id. After users log in next time, their hashes should be re-hashed with argon2id. A migration script or re-hash-on-login step (re-hash and update the DB record when SHA-256 verification succeeds) should be added in Phase 1.

3. **`platform_admin` DB migration**: The `platform_admin` boolean column was added to the `User` model. Run `alembic revision --autogenerate -m "add_platform_admin_to_user"` and `alembic upgrade head` to apply the schema change. For existing deployments, add the column manually: `ALTER TABLE users ADD COLUMN platform_admin BOOLEAN DEFAULT FALSE`.

4. **CORS_ALLOWED_ORIGINS**: Set to the actual production dashboard origin(s) in production `.env` / Kubernetes ConfigMap. Never use `*` in production.

5. **REST_BASE_URL_ALLOWLIST**: Populate in production with the specific REST data connector endpoints your tenants use. Leave empty only in dev/staging.

6. **Dashboard call-sites audit**: The `api.ts` functions now require a `token` argument. Any page that calls these functions (e.g. compliance dashboard, audit viewer, config panel) must be updated to pass `useSession().token`. Pages using the old zero-argument signatures will get a TypeScript compile error — follow those errors as a guided checklist.

7. **Slowapi storage in production**: The rate limiter uses in-memory storage by default. For multi-replica deployments, configure slowapi with a Redis backend so rate limit counters are shared across instances.

8. **Firebase Admin SDK**: Ensure `FIREBASE_ADMIN_SDK_PATH` or `FIREBASE_PROJECT_ID` is set in production so Firebase token verification works correctly.
