# Dashboard URL migration and 410 handling — FEAT-004

This change migrates the dashboard's legacy standalone API functions off the deprecated `/compliance/run-e2e` and `/compliance/runs` endpoints onto the new `/api/v1/runs` resource, adds explicit 410 handling at both the `BaseService` layer and in the standalone functions in `api.ts`, and fixes two TypeScript errors in `page.tsx` that were exposed by making `steps` optional. D2 (blank defaults and placeholder strings) and D3 (dispatch page isolation) required no code changes — both were already compliant.

Watch for: The 410 guard in `fetchComplianceRuns` is swallowed by the surrounding `catch {}` block (confirmed), meaning a 410 silently returns an empty array instead of surfacing the "Please refresh" message to the user.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The URL and auth header corrections in `api.ts` are clean. Both `runE2ECompliance` and `fetchComplianceRuns` now POST/GET against `/api/v1/runs`, wrap the body under `{ type, params }`, and use `makeAuthHeaders(token)` on every call. The type additions (`temporal_run_id?`, `hitl_required?`, `steps?`) land in `compliance.types.ts` with correct optionality.

The 410 handling has a structural gap: `fetchComplianceRuns` wraps its entire fetch — including the 410 `throw` — in a `try/catch` that returns `[]` on any error. The thrown `Error` never escapes to the caller, so the UI sees an empty list rather than the required message. `runE2ECompliance` does not have this problem; its 410 throw is outside any catch block and propagates correctly.

D2 and D3 are confirmed clean by direct file inspection. `audit/page.tsx` uses `useState("")` for both fields and carries the exact placeholder strings. `dispatch/page.tsx` operates entirely through `useSettlementService()` with no direct run or compliance endpoint calls.

The `page.tsx` fix for `steps?.length ?? 1` is correct given the newly optional field, and the `RunInput` wrapping fix resolves the type mismatch that the compiler caught.

---

<details>
<summary>Issues (2)</summary>

1. **410 swallowed in fetchComplianceRuns** — The `throw new Error("This endpoint has moved. Please refresh the page.")` inside `fetchComplianceRuns` sits within a `try/catch {}` that returns `[]` on any thrown error. The 410 message never reaches the caller; the UI silently shows an empty run list. Either remove the outer try/catch (letting 410 propagate like `runE2ECompliance` does), or catch only non-410 errors specifically.

2. **E2ERunResult in api.ts diverges from compliance.types.ts** — `api.ts` defines its own `E2ERunResult` with `steps: E2EStep[]` (required) and no `temporal_run_id` or `hitl_required` fields. This is the type used by `runE2ECompliance` and `fetchComplianceRuns`. Any caller importing from `api.ts` directly will see the old shape and miss the new fields at compile time, causing a silent runtime gap when the new `/runs` endpoint returns `hitl_required: true`. Update `api.ts` to import and re-export `E2ERunResult` from `compliance.types.ts`, or delete the duplicate definition.

</details>

---

<details>
<summary>Details</summary>

### 410 guard asymmetry between the two updated functions

`runE2ECompliance` throws unconditionally on 410 before any catch:

```ts
if (res.status === 410) {
  throw new Error("This endpoint has moved. Please refresh the page.");
}
if (!res.ok) { throw new Error(...) }
return await res.json();
```

`fetchComplianceRuns` wraps the identical throw inside `try { ... } catch { return []; }`. The catch has no status discrimination — it absorbs every thrown value including the 410 error. The caller receives `[]` and has no signal that the endpoint is gone. `BaseService.request` has the same 410 path but also propagates correctly because `BaseService` does not swallow its own errors.

The fix is to either match `runE2ECompliance`'s structure (no outer try/catch, let errors propagate) or to rethrow specifically on 410:

```ts
} catch (e) {
  if (e instanceof Error && e.message.startsWith("This endpoint has moved")) throw e;
  return [];
}
```

### E2ERunResult in api.ts still lacks the new fields

`compliance.types.ts` has the correct `temporal_run_id?`, `hitl_required?`, and `steps?` fields. The parallel `E2ERunResult` interface defined directly in `api.ts` (used as the return type of `runE2ECompliance` and `fetchComplianceRuns`) still has `steps: E2EStep[]` as required and is missing `temporal_run_id` and `hitl_required`. This is a confirmed type gap — callers that import from `api.ts` directly rather than from `compliance.types.ts` will see the old shape. No TypeScript error surfaces because `api.ts`'s own type is used consistently within that file, but the divergence will cause a runtime mismatch when the new endpoint returns `hitl_required: true` and a caller checks for it on the `api.ts` type.

</details>

---

<details>
<summary>Files changed</summary>

- `dashboard/app/lib/api.ts` — `runE2ECompliance` URL → `/api/v1/runs`, body wrapped under `RunInput`, 410 guard added; `fetchComplianceRuns` URL → `/api/v1/runs`, 410 guard added (but swallowed)
- `dashboard/app/lib/services/base.service.ts` — 410 message updated to "Please refresh the page."
- `dashboard/app/lib/types/compliance.types.ts` — `temporal_run_id?`, `hitl_required?`, `steps?` added; `RunInput` interface added
- `dashboard/app/page.tsx` — `runE2E` call wrapped under `RunInput` shape; `steps?.length ?? 1` optional chaining fix
- `dashboard/app/audit/page.tsx` — no change (D2 already compliant)
- `dashboard/app/dispatch/page.tsx` — no change (D3 already clean)

Full diff: `git diff main -- dashboard/`

</details>
