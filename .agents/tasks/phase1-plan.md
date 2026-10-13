# Phase 1 — Tenancy Implementation Plan

> This plan is decomposed into three sequential FEAT files under `.agents/tasks/phase1-tenancy/features/`.
> The workflow tail has been restructured to run one coder step per FEAT followed by a fixer+reviewer convergence loop.
> Each FEAT coder must read `context.json` and its FEAT file first before touching any code.

---

## Pre-read findings (grounded in actual source)

| Finding | File | Detail |
|---------|------|--------|
| Phase 0 already added `platform_admin` column to `User` model | `models/organization.py` line ~78 | ✅ present — do NOT re-add |
| All five business ORM classes live in **one file** | `packages/synthetiq-shared/synthetiq_shared/models/organization.py` | `AuctionRecord`, `BidRecord`, `AuditRecord`, `EscrowPORecord`, `Form1Record` — all defined here |
| Initial migration `bb863566fc2f` already created orgs/users/workflow_runs/schedules/data_sources/agent_configurations | `alembic/versions/bb863566fc2f_initial_multitenant_schema.py` | Business tables (audit, escrow, form1, bids, auctions) were **not** in that migration — they are created by `init_db()` / `create_all()` |
| `init_db()` = `Base.metadata.create_all()` is called in `main.py` lifespan | `api/src/main.py` ~line 38 | Must be removed and replaced with Alembic-only path |
| `_RUNS_DB` in-memory list used in `orchestrator.py` | `api/src/routes/orchestrator.py` | `_RUNS_DB.insert(0, ...)` on both FRAUD and SUCCESS paths; `get_compliance_run()` and `get_compliance_run_steps()` only read `_RUNS_DB` |
| `_COMPANIES_DB` in-memory dict | `api/src/routes/companies.py` | Full router to be retired; removed from `main.py` |
| `CompanyContext.tsx` uses `CompanyService` which calls `/api/v1/companies/` | `dashboard/app/lib/services/company.service.ts` | Must redirect to `/api/v1/organizations/` |
| `layout.tsx` wraps with `<CompanyProvider>` | `dashboard/app/layout.tsx` | Must be swapped for `<OrganizationProvider>` |
| No argon2 re-hash logic exists yet in `auth_service.py` | `api/src/services/auth_service.py` | Phase 1 scope: implement in `api/src/routes/auth.py` login path |
| No `api/src/utils/` directory exists yet | filesystem | Must be created with `tenant.py` |
| `api/src/routes/__init__.py` exports `companies_router` | must be read before FEAT-002 coder removes it | |
| Next.js version is **16.3.7**, React **19** | `dashboard/package.json` | Agent MUST read `node_modules/next/dist/docs/` before writing any Next.js code |

---

## FEAT-001 — Database schema + ORM models

**Files to create/modify:**
- `packages/synthetiq-shared/synthetiq_shared/models/organization.py` — add `OrgType` enum, `org_type` on `Organization`, `LegalEntity`, `Membership`, `InviteToken` classes; add `org_id` FK column to `AuditRecord`, `AuctionRecord`, `BidRecord`, `EscrowPORecord`, `Form1Record`
- `packages/synthetiq-shared/synthetiq_shared/models/__init__.py` — add exports for new models
- `packages/synthetiq-shared/alembic/versions/<new_rev>_phase1_tenancy_schema.py` — new migration chained after `bb863566fc2f`
- `api/src/main.py` — remove `init_db()` call

**Key ordering constraint:** migration must add `org_id` as **nullable** (no backfill to NOT NULL in same migration). The five business tables currently only have columns matching their ORM class but `org_id` was never in the initial migration — they relied on `create_all()`. The new migration creates these tables if they don't exist OR adds the column if they do (use `op.add_column` with `if_exists` pattern or check).

**Risk:** SQLite does not support all ALTER TABLE operations. The `alembic/env.py` already sets `render_as_batch=True` for SQLite — this covers column adds. PostgreSQL has no such limitation.

**Verify:** `uv run alembic -c alembic.ini upgrade head` on fresh DB; `uv run python -c 'from synthetiq_shared.models import Membership, InviteToken, LegalEntity, OrgType; print("OK")'`

---

## FEAT-002 — API tenancy wiring (depends on FEAT-001)

**Files to create/modify:**
- `api/src/utils/__init__.py` — create empty
- `api/src/utils/tenant.py` — `TenantCtx` model, `get_tenant_ctx` dependency, `set_tenant_context`
- `api/src/middleware/auth.py` — fail-closed on DB error (HTTP 503)
- `api/src/routes/audit.py` — add `org_id` filter + pagination to `_get_all_audits()`, `_persist_audit()`, `list_audit_verdicts()`
- `api/src/routes/settlement.py` — add `org_id` filter + pagination to `_get_all_pos()`, `list_escrow_pos()`, `list_form1_records()`
- `api/src/routes/auctions.py` — add `org_id` filter + pagination to `_get_all_auctions()`, `list_auctions()`, `list_active_auctions()`
- `api/src/routes/orchestrator.py` — set `org_id` on `AuditRecord`/`EscrowPORecord`/`Form1Record` in persist blocks; remove `_RUNS_DB` global; update `get_compliance_run()` and `get_compliance_run_steps()` to use `WorkflowRun` DB queries
- `api/src/routes/companies.py` — clear route handlers (retire in place)
- `api/src/main.py` — remove `companies_router` include and import
- `api/src/routes/__init__.py` — remove `companies_router` export (read file first)
- `api/src/routes/auth.py` — add `Membership` creation in `register()`; add `accept-invite`, `verify-email` endpoints; add argon2 re-hash on login
- `api/src/routes/users.py` — add `Membership` creation in `invite_or_create_user()`
- `api/src/routes/organizations.py` — add `POST /organizations/{org_id}/invites` endpoint

**Key risks:**
- `get_compliance_run()` currently only searches `_RUNS_DB` — after removing it, the route must hit the DB. The `result` JSON column on `WorkflowRun` stores the full run dict. Return `{**run_record.result, 'run_id': run.run_id, 'org_id': run.org_id, ...}`.
- `get_compliance_run_steps()` does the same — return `run.result.get('steps', [])`.
- The `org_id` on new business rows in `orchestrator.py` comes from `org_id = user.get("org_id") or p.get("company_id", "ORG-DEV-001")` (already computed at top of `execute_e2e_compliance_run`).

**Verify:** `uv run ruff check api/src`; verify routes `/auth/accept-invite` and `/auth/verify-email` exist; confirm no `/companies` router in app

---

## FEAT-003 — Dashboard OrganizationContext (independent of FEAT-002, depends on FEAT-001 being deployed)

**Files to create/modify:**
- `dashboard/app/lib/contexts/OrganizationContext.tsx` — new file; full implementation
- `dashboard/app/lib/contexts/CompanyContext.tsx` — replace with shim re-export
- `dashboard/app/layout.tsx` — swap `CompanyProvider` for `OrganizationProvider`
- `dashboard/app/lib/services/company.service.ts` — redirect calls to `/organizations/`
- `dashboard/app/page.tsx` — update `useCompany()` destructure to `orgId`/`currentOrg`
- `dashboard/app/organizations/page.tsx` — update invite flow to call `/organizations/{orgId}/invites`
- Other pages that use `useCompany()` — scan and update destructuring as needed

**Key constraint:** Next.js 16.3.7 / React 19. The AGENTS.md rule says to read `node_modules/next/dist/docs/` before writing code. For OrganizationContext.tsx the patterns are identical to the existing SessionContext.tsx (which already works) — `"use client"`, `createContext`, `useContext`, `useEffect` with `typeof window !== "undefined"` guard for SSR-safe localStorage access. Follow SessionContext.tsx as the reference pattern.

**Key risk:** `company.service.ts` returns `Company[]` but the new endpoint returns `Organization[]`. The `Organization` type in `organization.types.ts` has `org_id`, `name`, `gstin` which matches what `company.types.ts` defines as `company_id`, `name`, `gstin`. After the change, the context provides `orgId` (not `companyId`). The shim approach (CompanyContext.tsx re-exporting as `useCompany` → `useOrganization`) means pages do NOT need to be rewritten, but the destructured property names change from `companyId`/`company` to `orgId`/`currentOrg`. Each consuming page must rename its destructured variable OR alias: `const { orgId: companyId, currentOrg: company } = useOrganization()`.

**Verify:** `cd dashboard && npm run build` — must complete without TypeScript errors

---

## Ordering constraints summary

```
FEAT-001  (models + migration)
    ↓
FEAT-002  (API layer — depends on FEAT-001 models)
    ↓
FEAT-003  (dashboard — can be done in parallel with FEAT-002 but sequenced after for clean integration verification)
```

---

## What Phase 0 already handled (do NOT re-add)

- `platform_admin: Mapped[bool]` column on `User` model ✅
- `assert_same_org()` cross-tenant guard ✅
- `require_permission()` RBAC dependency ✅
- JWT HS256 local token path in `auth_service.py` ✅
- `hash_password` / `verify_password` in `jwt_utils.py` ✅
- `slowapi` rate limiting on `/auth/login` ✅
- CORS middleware ✅

---

## What is explicitly out of scope for Phase 1

- PostgreSQL Row-Level Security (RLS) policies — SQLite dev environment cannot test these; defer to a dedicated infra phase
- Sending actual invite emails — log the token to INFO level for dev; email integration is Phase 2
- Making `org_id` NOT NULL on the five business tables — deferred to Phase 2 migration after all rows have been backfilled
- Temporal workflow tenant context propagation
