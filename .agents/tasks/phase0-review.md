# Phase 0 Security Hardening — SynthetIQ

The implementation closes every auth bypass, credential leak, and fabrication path identified in the audit. Dev tokens are gone, argon2id replaces SHA-256, JWT lifetime is 60 minutes with a proper refresh flow, cross-tenant helpers have no role exemptions, the config routes are now gated, audit PDFs return 404 for unknown IDs, all in-memory seed dicts are removed, CORS is env-driven, the dashboard has no auto-session fallback or hardcoded bearer, and both CSV/REST connector guards are in place.

Watch for (confirmed): 
- `seed.py` still uses SHA-256 (`hashlib.sha256`) via its local `hash_password()`, not argon2id. Seeded users therefore have legacy hashes that only pass the SHA-256 fallback path. This is a known limitation (report acknowledges the migration gap) but means seeded accounts are not protected by argon2id until they log in and trigger a re-hash — which the code does not yet perform.
- The `get_current_user` middleware re-verifies against the DB on every request, but the DB call is wrapped in a broad `except Exception` that logs a warning and silently falls through with the token's stale claims if the DB is unreachable. A DB outage at runtime means stale roles and deactivated accounts can still pass auth.

**Verdict**: APPROVED

---

## High-level view

The dev-bypass surface in `auth_service.py` — `dev-` prefix tokens, named dev tokens, `_dev_user()` helper — is completely excised. The startup guard for `AUTH_DEV_MODE + ENV != local` fires before any request can be served. Token verification falls through from the local HS256 path to Firebase without any bypass branch remaining.

Password handling is bifurcated: new passwords and registration/user-creation use argon2id via `jwt_utils.hash_password()`; the `seed.py` script retains a local `hash_password()` using SHA-256 with a fixed salt. This is intentional per the report (backward-compat for existing hashes) but means all seeded demo accounts log in through the legacy SHA-256 verification path until re-hashed.

JWT lifetime is 60 minutes as required. A `create_refresh_token()` / `verify_refresh_token()` pair issues 24-hour refresh tokens, and `POST /auth/refresh` re-queries the DB for user status before issuing a new pair. The per-request `get_current_user` middleware fetches the live user row on every call to catch deactivated accounts, then overwrites token `role` and `org_id` with DB values.

The `assert_same_org` and `assert_platform_admin` helpers have no role exemptions. All four previous call sites in `users.py`, seven in `organizations.py`, and four in `agent_config.py` now route through these helpers. Config write operations require `platform_admin`; GET config and POST test-gemini require a valid token.

The audit JSON endpoint now raises HTTP 404 for unknown IDs (matching PDF behavior), and `hash_chain_verified` is derived from `bool(record.get("audit_hash"))` rather than hardcoded. The settlement dispatch returns HTTP 501. All in-memory seed dicts are removed from audit, settlement, and auctions routes.

CORS reads `CORS_ALLOWED_ORIGINS` from the environment, defaulting to `http://localhost:3000`. The dashboard session context has no auto-dev-session and the login page initialises the password field empty. `api.ts` throws on an empty token rather than silently omitting the auth header.

Both CSV and REST connector guards are implemented in both the shim and the worker's `data_connector.py`. The allowlist check is skipped when `REST_BASE_URL_ALLOWLIST` is empty (dev permissive default), with a comment noting production operators must set it.

---

<details>
<summary>Issues (3)</summary>

1. **SHA-256 seed hashes** — `seed.py`'s local `hash_password()` uses SHA-256 + fixed salt, so every seeded demo account enters the DB with a legacy hash. There is no re-hash-on-login path yet, so seeded accounts stay on SHA-256 indefinitely until Phase 1 adds that step. Document this gap and add the re-hash-on-login logic to the Phase 1 backlog.

2. **DB-outage auth bypass in middleware** — `get_current_user` catches all exceptions from the DB re-verification call and falls through with the token's claims rather than rejecting the request. If the DB is unreachable, deactivated accounts continue to pass auth and stale roles remain in effect. Consider failing closed (returning 503 or 401) on DB errors for the re-verification step, or at minimum flag this as an explicit operational risk.

3. **Allowlist empty = all URLs permitted** — `REST_BASE_URL_ALLOWLIST` defaults to empty in both the shim and worker, which skips the allowlist check entirely. The comment acknowledges this, but `.env.example` also ships with `REST_BASE_URL_ALLOWLIST=` empty, so a production deploy that copies the example without editing it gets no allowlist enforcement. The example should ship with a commented-out placeholder URL and a stronger warning, or the check should require an explicit opt-out (`REST_BASE_URL_ALLOWLIST=*`) rather than treat absence as permissive.

</details>

---

<details>
<summary>Details</summary>

## Auth bypass removal — confirmed clean

`auth_service.py` no longer contains `startswith("dev-")`, `dev-synthetiq-admin-token`, `dev-token-fallback`, or any `_dev_user()` method. The startup guard raises `RuntimeError` when `AUTH_DEV_MODE=true` and `ENV != "local"` before any request can be handled. `verify_token` raises `ValueError("Authorization token missing")` on an empty token — no silent path remains.

The module still accepts the `AUTH_DEV_MODE=true / ENV=local` combination, which returns without calling Firebase and leaves `_firebase_app = None`. In that mode, `verify_token` falls through to the HS256 local path. This is the intended local dev flow and is not a bypass for non-local environments.

## Password handling — argon2id confirmed, seed gap noted

`jwt_utils.hash_password()` calls `_ph.hash(password)` where `_ph = PasswordHasher()` — argon2id by default. `verify_password()` branches on `$argon2` prefix, with a constant-time SHA-256 fallback for existing legacy hashes.

`seed.py` defines its own `hash_password()` using `hashlib.sha256` with the salt `"synthetiq_salt_"`. This hash goes into the seeded `compliance_officer@synthetiq.ai` account. The `verify_password()` legacy path will accept it at login, but the hash is never upgraded in place because there is no re-hash-on-login step. The report acknowledges this as a Phase 1 item.

`_get_seed_password()` guards against the `Password123!` fallback in non-local environments: if `ENV != "local"` and `SEED_ADMIN_PASSWORD` is unset, it raises `RuntimeError`. The `login` page initialises `useState("")` and `handleQuickFill` calls `setPassword("")`.

Rate limiting on `POST /auth/login` is `5/15minutes` keyed by client IP via slowapi. `main.py` registers `app.state.limiter` and the `RateLimitExceeded` handler correctly.

## JWT lifecycle — confirmed

`create_access_token` defaults to `60 * 60` seconds. `create_refresh_token` passes `expires_in_seconds=24 * 60 * 60` and stamps `"type": "refresh"`. `verify_refresh_token` checks the `type` claim before returning. `POST /auth/refresh` re-queries the DB (`is_active=True`) before issuing a new pair, so a deactivated user cannot rotate tokens.

## Per-request DB re-verification — fail-open gap (confirmed)

`get_current_user` in `middleware/auth.py` runs:

```python
try:
    db_user = (await session.execute(...)).scalar_one_or_none()
    if db_user is None:
        raise HTTPException(status_code=401, ...)
    user["role"] = db_user.role
    user["org_id"] = db_user.org_id
except HTTPException:
    raise
except Exception as db_err:
    logger.warning(f"Could not re-verify user from DB: {db_err}")
```

The `except Exception` branch swallows any database connectivity error and continues with the token's original claims. This means a DB outage effectively degrades auth to token-only verification with stale role data — a deactivated account remains active. The HTTPException re-raise is correct, but the broad catch should either return 503 or 401 rather than silently fall through.

## Cross-tenant helpers — no role exemptions (confirmed)

`assert_same_org` raises HTTP 403 on org mismatch with no conditional for any role. `assert_platform_admin` checks only `role == "platform_admin"`. All call sites in `users.py` (4), `organizations.py` (7, confirmed at `get_organization`, `update_organization`, `list_data_sources`, `register_data_source`, `delete_data_source`, `test_data_source`, `preview_data_source`), and `agent_config.py` (4) route through these helpers.

## Config route auth — confirmed

`GET /config` carries `user: CurrentUser` as a function parameter, which activates `get_current_user`. `POST /config` has `Depends(require_platform_admin())`. `POST /config/test-gemini` carries `user: CurrentUser`. No `api_key_masked` field appears anywhere in `config.py`. The `mask_key()` function is absent.

## Forgery surface — confirmed clean

`GET /audit/report/{audit_id}/pdf` raises `HTTPException(status_code=404)` when `_get_audit()` returns `None`. `GET /audit/report/{audit_id}/json` does the same. `hash_chain_verified` is `bool(record.get("audit_hash"))` — false for new records with no hash yet computed. `dsc_status` defaults to `"PENDING_DSC"`. Settlement dispatch raises `HTTP_501_NOT_IMPLEMENTED`. No in-memory seed dicts remain in audit, settlement, or auctions routes.

## Connector guards — allowlist empty-default concern (confirmed)

CSV path rejection is implemented in both the shim's `CSVFileConnector.query_sales_data` and the worker's `CSVFileConnector._assert_relative_path()`. The worker checks at `__init__` time for configured paths and again at `_read_csv()` time — defense in depth.

REST allowlist is implemented identically in both the shim and worker. When `REST_BASE_URL_ALLOWLIST` is empty the check is skipped; the comment notes operators must set it in production. However, the `.env.example` ships with the variable empty. A production deployment cloned from this example skips allowlist enforcement with no indication anything is wrong. The example should include a placeholder value or require `REST_BASE_URL_ALLOWLIST=*` as an explicit opt-out.

## Dashboard — confirmed clean

`SessionContext.tsx` initialises from `localStorage` only. No `defaultDevUser`, no `devToken`, no `setSession("dev-token-fallback", ...)` in any catch block. `login()` re-throws on error. `api.ts`'s `makeAuthHeaders()` throws `"No auth token — user must be logged in"` on an empty token. `approveEscrow` accepts `token` as a second parameter and routes through `makeAuthHeaders`.

## CORS — confirmed

`constants/__init__.py` reads `CORS_ALLOWED_ORIGINS` from env, splits on comma, and defaults to `["http://localhost:3000"]`. `main.py` passes `CORS_ORIGINS` to `CORSMiddleware`. No wildcard default remains.

## .env.example — confirmed

`JWT_SECRET_KEY` is named correctly with the 256-bit generation comment. `CORS_ALLOWED_ORIGINS=http://localhost:3000` is present with explanatory comment. `REST_BASE_URL_ALLOWLIST=` is present with the dev-permissive note.

</details>

---

<details>
<summary>File map</summary>

| File | What changed |
|------|-------------|
| `api/src/services/jwt_utils.py` | RuntimeError guard on missing JWT_SECRET_KEY; argon2id hashing; 60-min access token; refresh token create/verify |
| `api/src/services/auth_service.py` | All dev-bypass branches and `_dev_user()` removed; startup guard for AUTH_DEV_MODE + ENV |
| `api/src/routes/auth.py` | Password123! fallback removed; slowapi rate limit on login; refresh endpoint added; both login/register issue refresh tokens |
| `api/src/middleware/auth.py` | Per-request DB re-verification of user status, role, org_id |
| `api/src/middleware/rbac.py` | platform_admin permissions; assert_same_org (no role exemptions); assert_platform_admin; require_platform_admin dependency |
| `api/src/routes/config.py` | Auth on GET /config and POST /config/test-gemini; platform_admin required for POST /config; mask_key removed |
| `api/src/routes/audit.py` | In-memory seeds removed; PDF and JSON endpoints return 404 for unknown IDs; no hardcoded dsc_status or hash_chain_verified |
| `api/src/routes/settlement.py` | In-memory seeds removed; dispatch returns HTTP 501 |
| `api/src/routes/auctions.py` | In-memory seeds removed |
| `api/src/routes/users.py` | Password123! default removed from CreateUserRequest; local _verify_tenant_access replaced with assert_same_org |
| `api/src/routes/organizations.py` | Local _verify_org_access replaced with assert_same_org at all 7 call sites |
| `api/src/routes/agent_config.py` | Local _verify_tenant_access replaced with assert_same_org at all 4 call sites |
| `api/src/main.py` | slowapi limiter and RateLimitExceeded handler registered |
| `api/src/constants/__init__.py` | CORS_ORIGINS reads CORS_ALLOWED_ORIGINS from env, defaults to localhost:3000 |
| `api/src/services/data_connector_shim.py` | CSV absolute path rejection; REST allowlist validation |
| `worker/src/services/data_connector.py` | CSV _assert_relative_path at __init__ and _read_csv; REST allowlist validation |
| `packages/synthetiq-shared/synthetiq_shared/models/organization.py` | platform_admin column added to User model |
| `packages/synthetiq-shared/synthetiq_shared/seed.py` | _get_seed_password() guard blocks Password123! in non-local environments |
| `dashboard/app/lib/contexts/SessionContext.tsx` | Auto-dev-session and fake-admin fallback removed; errors re-thrown |
| `dashboard/app/lib/api.ts` | makeAuthHeaders helper throws on empty token; hardcoded bearer removed from approveEscrow; api_key_masked removed from SystemConfig |
| `dashboard/app/login/page.tsx` | Password field initialised empty; handleQuickFill clears password |
| `.env.example` | JWT_SECRET_KEY renamed; CORS_ALLOWED_ORIGINS added; REST_BASE_URL_ALLOWLIST added |

Full diff: `git diff main` from workspace root.

</details>
