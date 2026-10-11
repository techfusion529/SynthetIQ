# Phase 2 FEAT-004 — Dashboard Update Report

## D1 — Update run service URLs

**Files changed:** `dashboard/app/lib/api.ts`

The service abstraction layer (`dashboard/app/lib/services/compliance.service.ts`) was already correct — it used `/api/v1/runs` for POST, GET list, and GET detail, and the `BaseService` handles auth via the injected token. The TypeScript types in `dashboard/app/lib/types/compliance.types.ts` already had `temporal_run_id?`, `hitl_required?`, and `steps?` (optional).

The legacy standalone functions in `api.ts` still used the old URLs. These were updated:

| Function | Old URL | New URL |
|---|---|---|
| `runE2ECompliance` | `POST /api/v1/compliance/run-e2e` | `POST /api/v1/runs` |
| `fetchComplianceRuns` | `GET /api/v1/compliance/runs` | `GET /api/v1/runs` |

The `runE2ECompliance` body was also updated to wrap params under `{ type: "e2e_compliance", params }` to match the `RunInput` shape.

## D2 — Blank hardcoded defaults in audit/page.tsx

**Files changed:** None

Both `useState` calls in `audit/page.tsx` already used `useState("")` (empty string), and both `TextField` components already had the required `placeholder` props (`"e.g. RECYC-ORG-001"` and `"e.g. PLANT-001"`). No change was needed.

## D3 — Verify dispatch page

**Files changed:** None

`dashboard/app/dispatch/page.tsx` uses `useSettlementService()` exclusively and makes no direct HTTP calls to any compliance or run endpoint. No code change was required.

## D4 — Handle 410 gracefully

**Files changed:**
- `dashboard/app/lib/services/base.service.ts`
- `dashboard/app/lib/api.ts`

In `base.service.ts`, the 410 error message was updated from:
> "This endpoint has moved. Please use the new Runs interface."

to the required:
> "This endpoint has moved. Please refresh the page."

In `api.ts`, both updated functions (`runE2ECompliance` and `fetchComplianceRuns`) also explicitly check for `res.status === 410` and throw/propagate the message "This endpoint has moved. Please refresh the page."

## Bonus fix — app/page.tsx

Two TypeScript errors were found and fixed in `dashboard/app/page.tsx`:

1. `complianceSvc.runE2E(...)` was passing flat params directly instead of the `RunInput` shape `{ type, params }`. Fixed by wrapping under `{ type: "e2e_compliance", params: { ... } }`.
2. `latestRun.steps.length` was used after `steps` was made optional. Fixed by using `latestRun.steps?.length ?? 1`.

## TypeScript compiler output

```
(empty — 0 errors)
```

## Issues encountered

None. All changes compiled cleanly on the first verification pass after the `page.tsx` fixes.
