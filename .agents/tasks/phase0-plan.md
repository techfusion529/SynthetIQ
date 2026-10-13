# Phase 0 — Security Hardening Implementation Plan

All items are ordered by dependency. Each item leaves the codebase in a buildable state.
Build command: `cd api && pip install -e . && uvicorn src.main:app --port 8000`
Test command: `cd api && python -m pytest` (or manual smoke-test via `curl` / Swagger at `/api/docs` if no test suite exists yet).

---

## Dependency flag — add before items 2 and 3

> **`argon2-cffi` is NOT in `api/pyproject.toml`.** It must be added in item 2 before the password-hashing change is made; item 3 depends on it being installed.

---

- [ ] 1. **Auth service — remove all dev-token bypasses and add startup guard**
      In `auth_service.py`, inside `AuthService.verify_token`, delete the entire block:
      ```python
      if (
          self.dev_mode
          or clean_token in ("dev-synthetiq-admin-token", "dev-token-fallback")
          or clean_token.startswith("dev-")
      ):
          return self._dev_user(clean_token)
      ```
      Replace it with nothing — after stripping the Bearer prefix the code must fall straight through to the HS256 decode attempt, then the Firebase fallback.
      Also delete the two dev-mode early-returns that exist when `token` is `None` or empty (the `if self.dev_mode: return self._dev_user()` branches).
      In `initialize_firebase`, add an environment guard immediately after the `dev_mode` check:
      ```python
      if dev_mode:
          env = os.getenv("ENV", "local").lower()
          if env != "local":
              raise RuntimeError(
                  "AUTH_DEV_MODE=true is not permitted outside ENV=local. "
                  "Unset AUTH_DEV_MODE or set ENV=local."
              )
          logger.warning("Firebase Auth running in DEV MODE — tokens are NOT verified")
          return
      ```
      Files: `api/src/services/auth_service.py`
      Verify: Start the API with `AUTH_DEV_MODE=true ENV=staging` — the process must refuse to start with a `RuntimeError`. Start with `AUTH_DEV_MODE=true ENV=local` — it starts. A request with header `Authorization: Bearer dev-synthetiq-admin-token` must return HTTP 401 or 500 (token decode fails), not a user object.

---

- [ ] 2. **Add `argon2-cffi` dependency**
      In `api/pyproject.toml`, append to the `dependencies` list:
      ```
      "argon2-cffi>=23.1.0",
      ```
      Run `pip install -e .` (or `uv sync` / `poetry install` — whichever the project uses) to make `argon2` importable before the next item edits jwt_utils.
      Files: `api/pyproject.toml`
      Verify: `python -c "from argon2 import PasswordHasher; print('ok')"` prints `ok`.

---

- [ ] 3. **JWT utils — fix secret guard, shorten token lifetime, switch to argon2id**
      In `api/src/services/jwt_utils.py`:

      a. **Secret key guard** — replace the module-level assignment:
      ```python
      SECRET_KEY = os.getenv("JWT_SECRET_KEY", "synthetiq-super-secret-jwt-signing-key-2026")
      ```
      with:
      ```python
      SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
      if not SECRET_KEY:
          raise RuntimeError(
              "JWT_SECRET_KEY environment variable is not set or is empty. "
              "Generate a random 256-bit value: python -c \"import secrets; print(secrets.token_hex(32))\""
          )
      ```

      b. **Cut access token lifetime** — change the default `expires_in_seconds` in `create_access_token`:
      ```python
      expires_in_seconds: int = 60 * 60,   # 60 minutes
      ```

      c. **Switch password hashing to argon2id** — replace `hash_password` and `verify_password`:
      ```python
      from argon2 import PasswordHasher
      from argon2.exceptions import VerifyMismatchError

      _ph = PasswordHasher()   # argon2id by default, memory=65536, time=3, parallelism=4

      def hash_password(password: str) -> str:
          """Hash password with argon2id."""
          return _ph.hash(password)

      def verify_password(plain_password: str, hashed_password: str) -> bool:
          """Verify plain password against argon2id hash."""
          if not hashed_password:
              return False
          try:
              return _ph.verify(hashed_password, plain_password)
          except VerifyMismatchError:
              return False
          except Exception:
              return False
      ```
      Remove the old `SALT`, `hashlib`, and `hmac.compare_digest` usages from `hash_password`/`verify_password` (keep `hmac.compare_digest` for the JWT signature check).

      d. **Add `create_refresh_token` and `decode_refresh_token` helpers**:
      ```python
      def create_refresh_token(payload: dict[str, Any]) -> str:
          """Create a signed HS256 refresh JWT (24 h lifetime)."""
          return create_access_token(payload, expires_in_seconds=24 * 60 * 60)

      def decode_refresh_token(token: str) -> dict[str, Any]:
          """Alias — same verification as access token."""
          return decode_access_token(token)
      ```

      Files: `api/src/services/jwt_utils.py`
      Verify: `python -c "from src.services.jwt_utils import hash_password, verify_password; h=hash_password('Test!'); print(verify_password('Test!', h))"` (run from `api/` with `JWT_SECRET_KEY` set) prints `True`. Running without `JWT_SECRET_KEY` raises `RuntimeError`.

---

- [ ] 4. **Auth routes — remove Password123! fallback, add dev-mode-free login, add rate limiting**
      In `api/src/routes/auth.py`:

      a. **Remove `Password123!` check** — in the `login` handler, delete the entire inner condition:
      ```python
      if payload.password != "Password123!" and not auth_service.dev_mode:
          raise HTTPException(...)
      ```
      Replace the surrounding password verification block so it always calls `verify_password` and raises 401 on failure:
      ```python
      if payload.password:
          if not user.password_hash or not verify_password(payload.password, user.password_hash):
              raise HTTPException(
                  status_code=status.HTTP_401_UNAUTHORIZED,
                  detail="Invalid email or password",
              )
      ```

      b. **Remove dev-mode fallback login** — delete the entire `if not row: if auth_service.dev_mode: ...` block. When the user is not found, always raise 401:
      ```python
      if not row:
          raise HTTPException(
              status_code=status.HTTP_401_UNAUTHORIZED,
              detail="Invalid email or password",
          )
      ```

      c. **Add rate limiting** — add `slowapi` to `pyproject.toml` dependencies (`"slowapi>=0.1.9"`). In `auth.py`, add:
      ```python
      from slowapi import Limiter
      from slowapi.util import get_remote_address
      limiter = Limiter(key_func=get_remote_address)
      ```
      Decorate the `login` endpoint:
      ```python
      @router.post("/login", response_model=AuthResponse)
      @limiter.limit("5/15minutes")
      async def login(request: Request, payload: LoginRequest) -> AuthResponse:
      ```
      Import `Request` from `fastapi`. In `main.py`, register the limiter state and error handler:
      ```python
      from slowapi import _rate_limit_exceeded_handler
      from slowapi.errors import RateLimitExceeded
      app.state.limiter = limiter
      app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
      ```

      d. **Issue refresh token alongside access token** — update `AuthResponse`:
      ```python
      class AuthResponse(BaseModel):
          access_token: str
          refresh_token: str
          token_type: str = "bearer"
          user: UserResponse
      ```
      In both the `login` and `register` handlers, call `create_refresh_token` and include it in the return:
      ```python
      from src.services.jwt_utils import create_access_token, create_refresh_token, ...
      refresh = create_refresh_token({"uid": ..., "email": ..., "role": ..., "org_id": ...})
      return AuthResponse(access_token=token, refresh_token=refresh, user=...)
      ```

      e. **Add `POST /auth/refresh` endpoint**:
      ```python
      class RefreshRequest(BaseModel):
          refresh_token: str

      @router.post("/refresh", response_model=AuthResponse)
      async def refresh_token(payload: RefreshRequest) -> AuthResponse:
          from src.services.jwt_utils import decode_refresh_token, create_access_token, create_refresh_token
          try:
              claims = decode_refresh_token(payload.refresh_token)
          except ValueError as e:
              raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
          # Re-verify user is still active and role is current
          async with get_db_session() as session:
              result = await session.execute(
                  select(User, Organization)
                  .join(Organization, User.org_id == Organization.org_id)
                  .where(User.user_id == claims["uid"])
                  .where(User.is_active.is_(True))
              )
              row = result.first()
              if not row:
                  raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer active")
              user, org = row
          new_access = create_access_token({"uid": user.user_id, "email": user.email, "display_name": user.display_name, "role": user.role, "org_id": user.org_id, "authorized": True})
          new_refresh = create_refresh_token({"uid": user.user_id, "email": user.email, "role": user.role, "org_id": user.org_id})
          return AuthResponse(
              access_token=new_access, refresh_token=new_refresh,
              user=UserResponse(user_id=user.user_id, email=user.email, display_name=user.display_name, role=user.role, org_id=user.org_id, organization_name=org.name),
          )
      ```

      Files: `api/src/routes/auth.py`, `api/pyproject.toml`, `api/src/main.py`
      Verify: POST `/api/v1/auth/login` with wrong password returns HTTP 401. POST with correct password returns 200 with both `access_token` and `refresh_token`. Hitting `/login` 6 times in rapid succession returns HTTP 429 on the sixth.

---

- [ ] 5. **Re-verify user status on every authenticated request**
      In `api/src/middleware/auth.py`, inside `get_current_user`, after `auth_service.verify_token` returns `user`, add a DB re-verification step:
      ```python
      # Re-verify user is still active and role is current from the database
      uid = user.get("uid")
      if uid:
          try:
              from sqlalchemy import select
              from synthetiq_shared.database import get_db_session
              from synthetiq_shared.models import User as UserModel
              async with get_db_session() as session:
                  db_user = (await session.execute(
                      select(UserModel).where(UserModel.user_id == uid).where(UserModel.is_active.is_(True))
                  )).scalar_one_or_none()
                  if db_user is None:
                      raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive or deleted", headers={"WWW-Authenticate": "Bearer"})
                  # Always use DB role, not token role (prevents stale elevation)
                  user["role"] = db_user.role
                  user["org_id"] = db_user.org_id
          except HTTPException:
              raise
          except Exception as db_err:
              logger.warning(f"Could not re-verify user from DB: {db_err}")
      ```
      Files: `api/src/middleware/auth.py`
      Verify: Deactivate a user row in the DB (`is_active = false`), then make a request with their still-valid JWT — the response must be HTTP 401.

---

- [ ] 6. **RBAC — add `platform_admin` role, cross-tenant guard, and `assert_same_org`**
      In `api/src/middleware/rbac.py`:

      a. **Add `platform_admin` to the permission matrix**:
      ```python
      PERMISSIONS["platform_admin"] = PERMISSIONS["admin"] | {
          "platform:admin",
          "orgs:admin",
          "config:platform_write",
      }
      ```

      b. **Add `assert_same_org` helper**:
      ```python
      def assert_same_org(token_org_id: str, resource_org_id: str) -> None:
          """Raise HTTP 403 if the token's org does not match the resource's org.
          No role exemptions — platform_admin routes must use assert_platform_admin instead.
          """
          if token_org_id != resource_org_id:
              raise HTTPException(
                  status_code=status.HTTP_403_FORBIDDEN,
                  detail="Cross-tenant access denied",
              )
      ```

      c. **Add `assert_platform_admin` helper**:
      ```python
      def assert_platform_admin(user: dict[str, Any]) -> None:
          """Raise HTTP 403 if user is not a platform_admin."""
          if user.get("role") != "platform_admin":
              raise HTTPException(
                  status_code=status.HTTP_403_FORBIDDEN,
                  detail="Platform admin access required",
              )
      ```

      d. **Add `require_platform_admin` FastAPI dependency**:
      ```python
      def require_platform_admin() -> Callable:
          async def _check(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
              assert_platform_admin(user)
              return user
          return _check
      ```

      Files: `api/src/middleware/rbac.py`
      Verify: Import the module with no errors (`python -c "from src.middleware.rbac import assert_same_org, assert_platform_admin"`). Calling `assert_same_org("ORG-A", "ORG-B")` raises `HTTPException(403)`. Calling it with identical values does not raise.

---

- [ ] 7. **Config routes — add auth, remove key masking, restrict writes to platform_admin**
      In `api/src/routes/config.py`:

      a. **Add JWT auth to GET /config** — the current `get_system_config` has no auth. Add `CurrentUser` dependency:
      ```python
      @router.get("")
      async def get_system_config(user: CurrentUser) -> dict[str, Any]:
      ```

      b. **Remove `mask_key` and `api_key_masked` from the response** — delete the `mask_key` function entirely. In the `get_system_config` return dict, remove the `"api_key_masked"` key. Replace `"is_key_provided": bool(...)` with just a boolean — do not expose any characters of the key. The `gemini` section becomes:
      ```python
      "gemini": {
          "model": _RUNTIME_CONFIG.gemini_model,
          "is_key_provided": bool(_RUNTIME_CONFIG.gemini_api_key),
          "temperature": 0.2,
      },
      ```

      c. **Restrict POST /config to `platform_admin`** — replace the existing `require_permission("config:write")` dependency with `require_platform_admin()`:
      ```python
      @router.post("")
      async def update_system_config(
          payload: dict[str, Any],
          user: CurrentUser,
          _: Any = Depends(require_platform_admin()),
      ) -> dict[str, Any]:
      ```
      Also remove the `"api_key_masked"` key from the POST response.

      d. **Add JWT auth to POST /config/test-gemini** — add `CurrentUser`:
      ```python
      @router.post("/test-gemini")
      async def test_gemini_connection(user: CurrentUser, payload: dict[str, Any] | None = None) -> dict[str, Any]:
      ```

      Files: `api/src/routes/config.py`
      Verify: GET `/api/v1/config` without a bearer token returns HTTP 401. GET with a valid token returns 200 with no `api_key_masked` field. POST `/api/v1/config` with an `admin`-role token returns 403. POST with a `platform_admin`-role token returns 200.

---

- [ ] 8. **Audit routes — fix forgery paths (PDF 404, JSON real values)**
      In `api/src/routes/audit.py`:

      a. **GET /audit/report/{audit_id}/pdf — return 404 for missing audits** — in `download_audit_report_pdf`, replace the fabricated fallback record:
      ```python
      # DELETE this entire block:
      if not record:
          record = {
              "audit_id": audit_id,
              "recycler_id": "RECYC-DELHI-01",
              ...
              "audit_verdict": "APPROVED",
              ...
          }
      ```
      Replace with:
      ```python
      if not record:
          raise HTTPException(status_code=404, detail=f"Audit {audit_id} not found")
      ```

      b. **GET /audit/report/{audit_id}/json — remove hardcoded VALID_DIGITAL_SIGNATURE and `hash_chain_verified: true`** — in `get_audit_report_json`, change the return to use actual stored values:
      ```python
      return {
          "statutory_form": "CPCB Form-1 Plastic Waste Management Rules 2026",
          "audit_id": audit_id,
          "dossier": record,
          "dsc_status": record.get("dsc_status", "PENDING_DSC"),
          "hash_chain_verified": bool(record.get("audit_hash")),
      }
      ```

      c. **Remove the `_seeded` / `_seed_db_if_empty` block** — delete the `_seeded` global, the `_AUDITS_DB` in-memory seed dict, and the entire `_seed_db_if_empty` async function. Remove every `await _seed_db_if_empty()` call in the route handlers (`list_audit_verdicts`, `get_audit_verdict`, `list_audit_exceptions`, `download_audit_report_pdf`, `get_audit_report_json`). The routes must read exclusively from the DB via `_get_all_audits()` / `_get_audit()`. Update `_get_all_audits` and `_get_audit` to return `[]` / `None` when the DB is empty rather than falling back to `_AUDITS_DB`.

      Files: `api/src/routes/audit.py`
      Verify: GET `/api/v1/audit/report/NONEXISTENT-ID/pdf` returns HTTP 404. GET `/api/v1/audit/report/NONEXISTENT-ID/json` returns `{"error": "...not found", "status": "NOT_FOUND"}`. GET `/api/v1/audit/verdicts` on a fresh DB returns `[]`.

---

- [ ] 9. **Settlement routes — stub CPCB dispatch as 501, remove seed block**
      In `api/src/routes/settlement.py`:

      a. **Replace `dispatch_form1_statutory` with a 501 stub** — delete the entire body of the handler and replace with:
      ```python
      @router.post("/form1/dispatch")
      async def dispatch_form1_statutory(
          payload: dict[str, Any], user: CurrentUser,
          _: Any = Depends(require_permission("workflows:execute")),
      ) -> dict[str, Any]:
          raise HTTPException(
              status_code=status.HTTP_501_NOT_IMPLEMENTED,
              detail="CPCB dispatch not yet integrated",
          )
      ```
      Remove the imports and helpers used only by the old body (`hashlib`, `_FORM1_DB`, the `Form1Record` DB insert inside this handler). The `list_form1` and `get_form1` endpoints that read `_FORM1_DB` / `Form1Record` can stay, but `_FORM1_DB` dict will now always be empty.

      b. **Remove `_seeded` / `_seed_pos_if_empty`** — delete the `_seeded` global and the entire `_seed_pos_if_empty` function. Remove every `await _seed_pos_if_empty()` call in `list_escrow_pos` and `get_escrow_po`. Update those handlers to query the DB directly; return `[]` / 404 when empty.

      Files: `api/src/routes/settlement.py`
      Verify: POST `/api/v1/settlement/form1/dispatch` with a valid body returns HTTP 501 with `{"detail": "CPCB dispatch not yet integrated"}`. GET `/api/v1/settlement/pos` on a fresh DB returns `[]`.

---

- [ ] 10. **Auctions routes — remove seed-on-first-read block**
       In `api/src/routes/auctions.py`, delete the `_seeded` global, the `_seed_db_if_empty` async function, and every `await _seed_db_if_empty()` call inside `list_active_auctions`, `list_auctions`, and `get_auction`. Update `_get_all_auctions` to return `[]` when the DB is empty (no `_AUCTIONS_CACHE` / `_SEED_AUCTION` fallback). The `_SEED_BIDS`, `_AUCTIONS_CACHE`, and `_BIDS_CACHE` dicts can be removed entirely.
       Files: `api/src/routes/auctions.py`
       Verify: GET `/api/v1/auctions/` on a fresh DB returns `[]`.

---

- [ ] 11. **CORS — read allowed origins from environment variable**
       In `api/src/constants/__init__.py`, change:
       ```python
       CORS_ORIGINS: list[str] = ["*"]
       ```
       to:
       ```python
       _cors_env = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
       CORS_ORIGINS: list[str] = [o.strip() for o in _cors_env.split(",") if o.strip()]
       ```
       `main.py` already imports and uses `CORS_ORIGINS` — no change needed there.
       Files: `api/src/constants/__init__.py`
       Verify: Start API with `CORS_ALLOWED_ORIGINS=https://app.example.com,http://localhost:3000`. An `Origin: https://app.example.com` preflight should return that origin in `Access-Control-Allow-Origin`. An `Origin: https://evil.example.com` request should not get the header.

---

- [ ] 12. **Dashboard — remove auto-dev-session and hardcoded tokens from SessionContext**
       In `dashboard/app/lib/contexts/SessionContext.tsx`:

       a. **Remove auto-dev-session** — in the `useEffect` initialization block, delete the entire `else` branch that sets `defaultDevUser` / `devToken` and writes them to `localStorage`. Replace with a no-op — when no stored session exists, just let `loading` go to `false` and leave `token = ""` / `user = null`. The dashboard must show a login screen, not a fake admin session:
       ```tsx
       useEffect(() => {
         try {
           const storedToken = localStorage.getItem(TOKEN_KEY);
           const storedUser = localStorage.getItem(USER_KEY);
           if (storedToken && storedUser) {
             setTokenState(storedToken);
             setUserState(JSON.parse(storedUser));
           }
         } catch {
           // localStorage not available
         } finally {
           setLoading(false);
         }
       }, []);
       ```

       b. **Remove fake-admin fallback on login error** — in the `login` function, delete the `catch` block body that calls `setSession("dev-token-fallback", fallbackUser)`. Instead, re-throw the error so callers can display it:
       ```tsx
       const login = useCallback(async (email: string, password?: string): Promise<boolean> => {
         setLoading(true);
         try {
           const resp = await fetch(`${API_BASE}/auth/login`, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ email, password }),
           });
           if (!resp.ok) {
             const err = await resp.json().catch(() => ({}));
             throw new Error(err.detail || `Login failed (${resp.status})`);
           }
           const data = await resp.json();
           setSession(data.access_token, data.user);
           return true;
         } catch (err) {
           throw err;   // caller must handle and display the error
         } finally {
           setLoading(false);
         }
       }, [setSession]);
       ```
       Remove the `password: password || "Password123!"` default — send exactly what the user typed.

       Files: `dashboard/app/lib/contexts/SessionContext.tsx`
       Verify: Load the dashboard in a fresh browser (or incognito, no localStorage). It must show the login page, not land on the admin dashboard. Entering wrong credentials must surface an error message (callers that already have try/catch will need to set an error state — flag any page that calls `login()` without a try/catch as requiring a follow-up).

---

- [ ] 13. **Dashboard api.ts — remove hardcoded bearer token, pass session token**
       In `dashboard/app/lib/api.ts`:

       a. **`approveEscrow`** currently passes `Authorization: "Bearer mock-firebase-token-cpcb-co"`. Remove that hardcoded header. The function signature must accept a `token` parameter:
       ```ts
       export async function approveEscrow(
         auditId: string,
         token: string,
         action: string = "APPROVE",
       ): Promise<any> {
         const res = await fetch(`${API_BASE}/api/v1/settlement/approve`, {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             Authorization: `Bearer ${token}`,
           },
           body: JSON.stringify({ audit_id: auditId, action }),
         });
         if (!res.ok) throw new Error(`approveEscrow failed: ${res.status}`);
         return await res.json();
       }
       ```

       b. **Add a shared `apiFetch` helper** that always reads the token from `SessionContext` (or accepts it as a parameter) and throws if it is empty. Update all API functions that call protected endpoints to use this helper. Minimum change: add a `token` parameter to every function that hits an authenticated route (all routes except `/api/v1/config` GET if it were public — but it is now authenticated per item 7):
       ```ts
       export function makeAuthHeaders(token: string): HeadersInit {
         if (!token) throw new Error("No auth token — user must be logged in");
         return {
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`,
         };
       }
       ```
       Update `runE2ECompliance`, `triggerAudit`, `broadcastRfp`, `dispatchForm1`, `updateConfig`, `testGemini`, `fetchAuditVerdicts`, `fetchComplianceRuns`, `fetchEscrowPOs`, `fetchLiveScada`, `fetchConfig`, and `fetchLiabilityReport` to accept a `token: string` parameter and call `makeAuthHeaders(token)`.

       Files: `dashboard/app/lib/api.ts`
       Verify: TypeScript compilation (`npx tsc --noEmit` from `dashboard/`) passes. All call-sites that pass `token` from `useSession().token` must compile without type errors.

---

- [ ] 14. **Connector hardening — block absolute CSV paths and validate REST base URLs**
       In `api/src/services/data_connector_shim.py`, in the fallback `CSVFileConnector.query_sales_data` method:

       a. **Reject absolute filesystem paths**:
       ```python
       async def query_sales_data(self, company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
           path = str(self.path)
           if os.path.isabs(path):
               raise ValueError(
                   f"Absolute filesystem paths are not permitted for CSV connectors. "
                   f"Received: {path!r}"
               )
           ...
       ```

       b. **In `RESTAPIConnector.__init__`, validate `base_url` against an allowlist**:
       ```python
       def __init__(self, org_id: str, config: dict[str, Any]) -> None:
           super().__init__(org_id, config)
           self.connector_type = "rest_api"
           raw_url = config.get("base_url", "").rstrip("/")
           allowlist_env = os.getenv("REST_BASE_URL_ALLOWLIST", "")
           allowlist = [u.strip().rstrip("/") for u in allowlist_env.split(",") if u.strip()]
           if raw_url and allowlist and raw_url not in allowlist:
               raise ValueError(
                   f"REST connector base_url {raw_url!r} is not in REST_BASE_URL_ALLOWLIST. "
                   f"Add it to the environment variable to permit access."
               )
           self.base_url = raw_url
       ```
       When `REST_BASE_URL_ALLOWLIST` is empty, the check is skipped (permissive default — note this in a code comment so operators know to set it in production).
       If the worker's real `RESTAPIConnector` exists at `worker/src/services/data_connector.py`, apply the same path and URL validation there too (list that file as a secondary change).
       Files: `api/src/services/data_connector_shim.py`, `worker/src/services/data_connector.py` (if present)
       Verify: `python -c "from src.services.data_connector_shim import CSVFileConnector; c = CSVFileConnector('ORG-1', {'sales_file_path': '/etc/passwd'}); import asyncio; asyncio.run(c.query_sales_data('C', 'FY'))"` raises `ValueError`. Creating `RESTAPIConnector` with an un-allowlisted URL when the env var is set raises `ValueError`.

---

- [ ] 15. **`.env.example` — rename JWT_SECRET, add new entries**
       Edit `c:\Users\HP\SynthetIQ\.env.example`:
       - Rename `JWT_SECRET=your-secure-random-jwt-secret-key-32-chars-minimum` to:
         ```
         # JWT_SECRET_KEY must be a cryptographically random 256-bit (32-byte) value.
         # Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
         JWT_SECRET_KEY=your-secure-random-jwt-secret-key-256-bit
         ```
       - Add under the secrets section:
         ```
         # Comma-separated list of allowed CORS origins. No wildcards in production.
         CORS_ALLOWED_ORIGINS=http://localhost:3000

         # Comma-separated allowlist of base URLs for REST data connectors. Leave empty only in dev.
         REST_BASE_URL_ALLOWLIST=
         ```
       Files: `.env.example`
       Verify: Visual review — `JWT_SECRET` must not appear anywhere in the file; `JWT_SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, and `REST_BASE_URL_ALLOWLIST` must all be present.

---

## Dependency order summary

```
Item 2  (argon2 dep)
  └─► Item 3  (jwt_utils: argon2id + secret guard + refresh token)
        └─► Item 4  (auth routes: no Password123!, rate limit, refresh endpoint)
Item 1  (auth_service: remove dev bypass + startup guard)
Item 5  (middleware/auth.py: per-request DB re-verify) — needs DB layer, no new deps
Item 6  (rbac.py: platform_admin + assert_same_org) — standalone
  └─► Item 7  (config.py: require_platform_admin) — needs item 6
Item 8  (audit.py: 404 + real JSON values + remove seed) — standalone
Item 9  (settlement.py: 501 stub + remove seed) — standalone
Item 10 (auctions.py: remove seed) — standalone
Item 11 (constants: env-driven CORS) — standalone
Item 12 (SessionContext.tsx: no auto-session) — standalone
Item 13 (api.ts: no hardcoded token) — standalone, follow-up needed at call-sites
Item 14 (data_connector_shim.py: path + URL guards) — standalone
Item 15 (.env.example: cleanup) — standalone, do last
```

## Notes and assumptions

1. **`slowapi` is not in `pyproject.toml`**. It must be added alongside the rate-limiter code in item 4 (`"slowapi>=0.1.9"`).
2. **Existing password hashes** are SHA-256 (old scheme). After deploying item 3, existing users' stored `password_hash` values will fail argon2 verification. A migration plan is needed: on next successful login (if an admin temporarily sets a known password), re-hash with argon2id. Alternatively, provide a one-time DB migration script. Flag this to the team before deploying to an environment with real users.
3. **`orchestrator.py` (stage 5)** hardcodes `"portal_status": "CPCB_ACCEPTED"` in the in-memory run log and the `Form1Record` DB insert. That is inside the end-to-end run pipeline, not the public `/form1/dispatch` endpoint, so it is out of scope for the 501 stub in item 9. A Phase 1 ticket should address it.
4. **Call-sites in the dashboard** that call `login()` currently do not all catch errors. After item 12, failed logins will throw rather than silently succeed. Any page or component that calls `login()` must be updated to wrap it in try/catch and display the error message. Identify those call-sites when implementing item 12.
5. **Worker connector** (`worker/src/services/data_connector.py`) may also contain `CSVFileConnector` and `RESTAPIConnector` — item 14 lists it as a secondary change. Confirm its existence and apply the same guards.
