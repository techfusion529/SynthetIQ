# FEAT-004 Fix Pass: 410 propagation and duplicate E2ERunResult

Both blocking issues from the prior review pass have been addressed in `dashboard/app/lib/api.ts`. The 410 error in `fetchComplianceRuns` now re-throws before returning `[]`, and the duplicate `E2ERunResult` interface has been deleted in favour of an import+re-export from the canonical `compliance.types.ts`. The TypeScript build reported zero errors after the changes.

Watch for: neither concern is blocking post-fix — confirmed by direct code inspection below.

**Verdict**: APPROVED

---

## High-level view

The `fetchComplianceRuns` catch block now discriminates by error message: if the thrown `Error` starts with `"This endpoint has moved"` it is re-thrown; everything else returns `[]`. This is structurally sound — the 410 `throw` is inside the `try` block, the `catch` sees the `Error` object, and the `startsWith` check matches the exact string used at the throw site.

`E2ERunResult` has exactly one `interface` declaration across the codebase, located in `compliance.types.ts`. The `api.ts` file now imports and re-exports both `E2ERunResult` and `E2EStep` from that canonical source. The canonical definition carries `temporal_run_id?`, `hitl_required?`, and `steps?` as optional fields, resolving the type gap that was confirmed in the prior pass.

No other files in the diff touched unrelated functionality, so regression surface is limited to the two changed behaviours.

<details>
<summary>Issues (0)</summary>

No blocking concerns remain.

</details>

<details>
<summary>Details</summary>

### 410 re-throw in fetchComplianceRuns — confirmed resolved

The live code in `api.ts` (lines 145–159) reads:

```ts
export async function fetchComplianceRuns(token: string): Promise<E2ERunResult[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/runs`, {
      cache: "no-store",
      headers: makeAuthHeaders(token),
    });
    if (res.status === 410) {
      throw new Error("This endpoint has moved. Please refresh the page.");
    }
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    // Re-throw 410 errors so the caller can surface "Please refresh the page."
    // Swallow all other network/parse errors and return an empty list.
    if (e instanceof Error && e.message.startsWith("This endpoint has moved")) throw e;
    return [];
  }
}
```

The 410 guard throws an `Error` whose message starts with `"This endpoint has moved"`. The catch block tests for exactly that prefix and re-throws. Any `await fetchComplianceRuns()` call site wrapped in `try/catch` — including the `page.tsx` handlers described in the fix report — will receive the rejection. The fix report's call-path trace is accurate.

`runE2ECompliance` was already correct and is unchanged.

### Single source of truth for E2ERunResult — confirmed resolved

`interface E2ERunResult` appears exactly once in the codebase: `dashboard/app/lib/types/compliance.types.ts`. The definition includes all required optional fields:

- `temporal_run_id?: string`
- `hitl_required?: boolean`
- `steps?: E2EStep[]` (optional, not required)

`api.ts` no longer declares its own `E2ERunResult` or `E2EStep`. It imports both from `compliance.types.ts` and re-exports them, preserving backward compatibility for callers that import from `api.ts` directly. `compliance.service.ts` already imported from `compliance.types.ts` directly and is unaffected.

### Regression scan

The only changed lines in `api.ts` are: the `import type` and `export type` at the top (lines 2–3, replacing the removed interface declarations), and the `catch` block inside `fetchComplianceRuns`. No other functions were modified. The `compliance.types.ts` file was not changed in this fix pass. There are no unrelated edits bundled in the diff.

</details>

<details>
<summary>Files changed</summary>

- `dashboard/app/lib/api.ts` — duplicate `E2ERunResult` and `E2EStep` interfaces removed; `import type` + `export type` added from `compliance.types.ts`; `fetchComplianceRuns` catch now re-throws on 410 message prefix
- `dashboard/app/lib/types/compliance.types.ts` — no change (canonical source, already correct)

</details>
