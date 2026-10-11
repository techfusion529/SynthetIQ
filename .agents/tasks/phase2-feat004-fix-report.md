# FEAT-004 Fix Report

**Fixes applied:** 2  
**TypeScript errors after fix:** 0  

---

## Fix 1 — 410 error now propagates to caller

**File:** `dashboard/app/lib/api.ts`  
**Function:** `fetchComplianceRuns`

### What was wrong

The `throw new Error("This endpoint has moved. Please refresh the page.")` inside
`fetchComplianceRuns` was wrapped by a bare `catch { return []; }` block. That catch
had no status discrimination — it absorbed every thrown value, including the 410 error,
and returned `[]` to the caller. The UI saw an empty list with no indication that the
endpoint is gone.

### What was changed

The `catch` block now re-throws specifically on the 410 message and swallows everything
else (network failures, JSON parse errors):

```ts
} catch (e) {
  // Re-throw 410 errors so the caller can surface "Please refresh the page."
  // Swallow all other network/parse errors and return an empty list.
  if (e instanceof Error && e.message.startsWith("This endpoint has moved")) throw e;
  return [];
}
```

This mirrors the existing behaviour of `runE2ECompliance`, which throws on 410 before
any catch block.

### Call-path trace — 410 now reaches the UI layer

```
HTTP 410 response from /api/v1/runs
  └─ fetchComplianceRuns (api.ts)
       throws Error("This endpoint has moved. Please refresh the page.")
         └─ caller: page.tsx — loadRuns() / useEffect
              catches the error in its try/catch
                └─ setRunError(e.message)   ← sets React state
                     └─ rendered as <Alert> or error UI with the message
```

The function now returns a **rejected promise** on 410, so any `await fetchComplianceRuns()`
call site that wraps the call in `try/catch` (as both `page.tsx` and `agents/page.tsx` do
via `ApiError`/`useComplianceService`) will receive the error and can display the message.
`runE2ECompliance` was already correct — its 410 throw sits outside any catch block.

---

## Fix 2 — Duplicate `E2ERunResult` removed from `api.ts`

**File:** `dashboard/app/lib/api.ts`

### What was wrong

`api.ts` contained its own `E2ERunResult` interface with:
- `steps: E2EStep[]` — **required** (should be optional; new endpoint does not return steps)
- Missing `temporal_run_id?` and `hitl_required?` fields

The canonical definition in `dashboard/app/lib/types/compliance.types.ts` already had
the correct shape (`steps?: E2EStep[]`, `temporal_run_id?`, `hitl_required?`).

`api.ts` also duplicated `E2EStep` with `data: Record<string, any>` vs the canonical
`data: Record<string, unknown>`.

### What was changed

1. Deleted both duplicate interface definitions (`E2ERunResult` and `E2EStep`) from
   `api.ts`.
2. Added an import + re-export at the top of `api.ts`:

```ts
import type { E2ERunResult, E2EStep } from "./types/compliance.types";
export type { E2ERunResult, E2EStep };
```

The re-export preserves backward compatibility for any future callers that import these
types from `api.ts` directly, while the single source of truth is now
`compliance.types.ts`.

**Result:** Exactly one definition of `E2ERunResult` exists in the codebase —
`dashboard/app/lib/types/compliance.types.ts`.

---

## TypeScript output

```
$ npx tsc --noEmit   (from dashboard/)
[no output — zero errors]
Exit code: 0
```

---

## Summary of changed files

| File | Change |
|------|--------|
| `dashboard/app/lib/api.ts` | Deleted duplicate `E2ERunResult` / `E2EStep`; added import+re-export from `compliance.types.ts`; `fetchComplianceRuns` catch now re-throws on 410 |
| `dashboard/app/lib/types/compliance.types.ts` | No change (canonical source — already correct) |
