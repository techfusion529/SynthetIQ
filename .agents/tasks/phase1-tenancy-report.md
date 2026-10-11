# Phase 1 Tenancy Report

## Stream A — Backend changes

### packages/synthetiq-shared/alembic/versions/a3f9c8e1d42b_phase1_tenancy.py: New Alembic migration
- Creates domain tables (`audit_records`, `auctions`, `bids`, `escrow_pos`, `form1_records`) via `CREATE TABLE IF NOT EXISTS`
- Adds `org_id VARCHAR(64) FK → organizations.org_id` (nullable → backfill → NOT NULL) to all 5 domain tables, with FK and index
- Creates `legal_entities` table with org FK
- Creates `memberships` table with `UNIQUE(user_id, org_id)` constraint
- Creates `invite_tokens` table for email verification and org invites
- Adds `org_type VARCHAR(64)` and `status VARCHAR(32)` nullable columns to `organizations`
- Adds `platform_admin BOOLEAN DEFAULT FALSE` to `users`
- Enables RLS on 5 domain tables with `tenant_isolation` and `platform_admin_bypass` policies (PostgreSQL only)
- `down_revision = 'bb863566fc2f'`

### packages/synthetiq-shared/synthetiq_shared/models/organization.py: ORM model updates
- Added `OrgType` enum: `brand_owner`, `recycler`, `external_auditor`, `platform`
- Added `org_type: Mapped[Optional[str]]` and `status: Mapped[Optional[str]]` to `Organization`
- Added `org_id: Mapped[Optional[str]]` FK column to `AuditRecord`, `AuctionRecord`, `BidRecord`, `EscrowPORecord`, `Form1Record`
- Added `LegalEntity` ORM model with org relationship
- Added `Membership` ORM model with `UniqueConstraint(user_id, org_id)` and user/org relationships
- Added `InviteToken` ORM model for email verification and invite flows
- Normalized CRCRLF → LF line endings

### packages/synthetiq-shared/synthetiq_shared/models/__init__.py: Exports updated
- Added `OrgType`, `LegalEntity`, `Membership`, `InviteToken` to public exports and `__all__`

### api/src/utils/tenant.py: New TenantCtx dependency (new file)
- `TenantCtx` Pydantic model with `org_id`, `user_id`, `role`, `is_platform_admin`
- `get_tenant_ctx()` FastAPI dependency: derives context from `get_current_user`; platform_admin users get `org_id=""` and `is_platform_admin=True`; regular users look up active `Membership` row
- `set_rls_context()`: sets `SET LOCAL app.org_id = :oid` for PostgreSQL RLS

### api/src/services/auth_service.py: New helper functions
- Added `create_user()`: inserts `User` row and corresponding `Membership` row in one session
- Added `get_user_memberships()`: returns all active `Membership` rows for a user

### api/src/middleware/auth.py: DB error hardening
- DB errors in `get_current_user` now raise `HTTPException(503, "Service temporarily unavailable")` and log at ERROR level
- Added `platform_admin` flag propagation from DB user to user dict

### api/src/routes/organizations.py: Feature additions
- Added `org_type: OrgType` required field to `CreateOrgRequest`
- `create_organization` now sets `status="pending_verification"`, generates an `InviteToken` with `purpose="email_verification"`, logs verification URL
- Added `POST /organizations/{org_id}/invites` endpoint: same-org admin or platform_admin only; generates invite token, logs invite URL

### api/src/routes/auth.py: New endpoints + argon2 re-hash
- Added `POST /auth/verify-email`: validates email verification token, sets org `status="active"`, marks token used
- Added `POST /auth/accept-invite`: validates invite token, creates user + membership via `create_user()`, marks token used, returns JWT
- Login path: transparently re-hashes SHA-256 passwords to argon2id on successful login
- `register` endpoint now uses `create_user()` to create User + Membership atomically

### api/src/routes/auctions.py: Tenant scoping + pagination
- All list endpoints inject `TenantCtx` via `Depends(get_tenant_ctx)`
- `WHERE org_id = tenant_ctx.org_id` added to all queries (skipped for `is_platform_admin=True`)
- `limit: int = Query(50, le=200)` and `offset: int = Query(0, ge=0)` added to list endpoints

### api/src/routes/audit.py: Tenant scoping + pagination
- `_get_all_audits()` accepts `org_id`, `is_platform_admin`, `limit`, `offset` params
- `list_audit_verdicts` and `list_audit_exceptions` inject `TenantCtx` and pagination params

### api/src/routes/settlement.py: Tenant scoping + pagination
- `_get_all_pos()` accepts `org_id`, `is_platform_admin`, `limit`, `offset` params
- `list_escrow_pos`, `get_escrow_po`, `list_form1_records` inject `TenantCtx` and pagination params

### api/src/routes/orchestrator.py: In-memory store retired + tenant scoping
- Removed `_RUNS_DB` in-memory list entirely
- All run data persisted to and read from `WorkflowRun` DB table
- `list_compliance_runs` injects `TenantCtx` with `org_id` filter and pagination
- `get_compliance_run` and `get_compliance_run_steps` now query DB

### api/src/routes/companies.py: Retired
- All route handlers removed; file kept as empty stub with a `router` stub for graceful deprecation
- No endpoints are registered

### api/src/routes/__init__.py: companies_router removed
- Removed import and export of `companies_router`

### api/src/main.py: companies router removed + auto-create guarded
- Removed `companies_router` import and `app.include_router(companies_router, ...)` registration
- `init_db()` (which calls `Base.metadata.create_all`) is now only called in `ENV=local` (dev mode); production environments skip auto-create and rely on Alembic

### api/tests/conftest.py: Test DB setup
- Sets env vars before any imports
- Creates all ORM tables in in-memory SQLite at session start
- Seeds `ORG-TEST-001` and `USR-TEST-001` test fixtures so auth middleware can verify test tokens

---

## Migration summary

Single migration `a3f9c8e1d42b` (down_revision `bb863566fc2f`) covers:
- 5 domain tables created (with IF NOT EXISTS guard)
- `org_id` column added to all 5 domain tables (nullable → backfill → NOT NULL with FK + index)
- 3 new tables: `legal_entities`, `memberships`, `invite_tokens`
- 2 new columns on `organizations`: `org_type`, `status`
- 1 new column on `users`: `platform_admin` (if not already present in schema)
- RLS enabled on 5 domain tables (PostgreSQL; degrades gracefully on SQLite)

---

## In-memory stores retired

| Store | Location | Replacement |
|-------|----------|-------------|
| `_RUNS_DB` | `routes/orchestrator.py` | `WorkflowRun` ORM table with org-scoped queries |
| `_COMPANIES_DB` | `routes/companies.py` | Route retired; use `/organizations` endpoints |

---

## Verification results (Stream A)

```
python -m py_compile api/src/models/__init__.py         ✓
python -m py_compile api/src/utils/tenant.py            ✓
python -m py_compile api/src/routes/organizations.py    ✓
python -m py_compile api/src/routes/users.py            ✓
python -m py_compile api/src/routes/auth.py             ✓
python -m py_compile api/src/services/auth_service.py   ✓
python -m py_compile api/src/middleware/auth.py         ✓
python -m py_compile api/src/main.py                    ✓

python -m pytest api/tests/ -x -q --tb=short
14 passed, 1 warning in 10.03s
```

---

## Stream B — Dashboard changes

### dashboard/app/lib/contexts/OrganizationContext.tsx: New file
- Created `OrganizationProvider` and `useOrganization()` hook
- Fetches `GET /api/v1/organizations/` via `OrganizationService` using the session token
- Stores the org list in `orgs` state; defaults `currentOrg` to the first org (or restores from `localStorage` under key `synthetiq_selected_org`)
- `setCurrentOrg` updates state and `localStorage`
- Exposes full backward-compat aliases: `companyId`, `company`, `companies`, `loadingCompany`, `companyError`, `setCompanyId` — so all existing callers compile with an import-only change
- Return type is `React.JSX.Element` (project uses strict JSX namespace)

### dashboard/app/lib/contexts/CompanyContext.tsx: Replaced with re-export stub
- All implementation removed; file now re-exports `OrganizationProvider as CompanyProvider`, `useOrganization as useCompany`, and `Organization as Company` from `OrganizationContext`
- Any stale import of `CompanyContext` keeps compiling without changes

### dashboard/app/lib/services/company.service.ts: Replaced with re-export stub
- `CompanyService` class removed; file re-exports everything from `organization.service.ts` and also exports `OrganizationService as CompanyService` for backward compatibility
- `useServices.ts` and `services/index.ts` keep resolving `CompanyService` without changes

### dashboard/app/layout.tsx: Provider swap
- Replaced `import { CompanyProvider } from "./lib/contexts/CompanyContext"` with `import { OrganizationProvider } from "./lib/contexts/OrganizationContext"`
- Replaced `<CompanyProvider>` with `<OrganizationProvider>` in JSX

### dashboard/app/page.tsx: Import updated
- `useCompany` import now points to `useOrganization as useCompany` from `OrganizationContext`; no other code changes

### dashboard/app/auction/page.tsx: Import updated
- Same import-only change as `page.tsx`

### dashboard/app/liability/page.tsx: Import updated
- Same import-only change as `page.tsx`

### dashboard/components/AppHeader.tsx: Import updated
- `useCompany` import now points to `useOrganization as useCompany` from `OrganizationContext`; no other code changes

---

## Verification results (Stream B)

```
cd dashboard && npx tsc --noEmit
Exit 0 — zero type errors
```

All 8 files staged and committed: `feat: Phase 1 Tenancy Stream B — replace CompanyContext with OrganizationContext`

---

## Deferred items (with reasoning)

- **`GET /companies` removal from `useServices.ts`**: `CompanyService` in `useServices.ts` now resolves to `OrganizationService` via the re-export alias. The `company` slot in `useServices()` is no longer backed by the deprecated companies endpoint. No call to `GET /companies` remains in the dashboard.
- **`setCompanyId` full profile fetch**: `CompanyContext` previously fetched the full company profile on `setCompanyId`. `OrganizationContext` does not re-fetch on org switch (orgs are already fully loaded in the list). If a page needs fields not returned by `listOrgs()`, a `getOrg()` call can be added to `setCurrentOrg` in a follow-up.
