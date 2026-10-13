# Implementation Plan — Phase 5 Dashboard Enhancements

**Project**: SynthetIQ dashboard (Next.js 16.3.7 App Router, React 19, MUI 5)  
**Build command**: `cd dashboard && npx next build`  
**Lint command**: `cd dashboard && npx eslint`  
**No test framework** — verification is done by successful TypeScript compilation (`next build` runs `tsc`) and visual/runtime inspection.

All pages use `"use client"` because they rely on hooks, state, and browser APIs.  
All service calls go through `BaseService.request()` which injects the `Authorization: Bearer <token>` header — no caller needs to pass the token separately to a service method.

---

## Item 1 — Fix `toContextOrg` in OrganizationContext to map `org_type` and `status` from the API

**What**: `toContextOrg()` in `OrganizationContext.tsx` hard-codes `org_type: undefined` and `status: undefined` regardless of what the API returns. The `Organization` type in `organization.types.ts` has a `role` field (which maps to `org_type` usage in pages) and `is_active` (maps to `status`). Fix the mapper to pass these through.

**Decision**: Map `Organization.role` → `context.org_type` (the API uses "role" as the org type discriminator per `organization.types.ts`), and derive `status` from `Organization.is_active` as `"active"` / `"inactive"`.

**Files**:
- `dashboard/app/lib/contexts/OrganizationContext.tsx`

**Changes**:
```
function toContextOrg(o: OrgType): Organization {
  return {
    id: o.org_id,
    name: o.name,
    org_type: o.role,          // was: undefined
    status: o.is_active ? "active" : "inactive",  // was: undefined
    company_id: o.org_id,
    gstin: o.gstin,
    industry_sector: o.industry_sector,
  };
}
```

**Verify**: `cd dashboard && npx next build` — TypeScript compilation must pass with no type errors.

---

## Item 2 — Update `Auction` type and `Bid` type; add `SubmitBidParams`

**What**: `auction.types.ts` is missing `clearing_price` (the current field is `clearing_price_inr` which is already present, so that is fine), `winner_org_id`, `corridor_min`, `corridor_max`. The `Bid` type is missing `org_id` (needed to filter bids by the current org). Add `SubmitBidParams` type. Add missing `open` / `cleared` / `cancelled` status values to `BidStatus` (currently only covers bid statuses, not auction statuses — auction status is already a `string` on `Auction` so no union change is needed, but confirm the `STATUS_COLOR` map update happens in item 4).

**Files**:
- `dashboard/app/lib/types/auction.types.ts`

**Changes** — add to `Auction` interface:
```typescript
winner_org_id?: string;
corridor_min?: number;   // same as floor_price_inr; alias for clarity
corridor_max?: number;   // same as ceiling_price_inr; alias for clarity
```

Add to `Bid` interface:
```typescript
org_id?: string;  // The recycler's org ID — used for bid filtering
```

Add new type:
```typescript
export interface SubmitBidParams {
  volume_tons: number;
  price_per_kg: number;
}
```

**Verify**: `cd dashboard && npx next build` — no type errors.

---

## Item 3 — Update `ApproveEscrowParams` in `settlement.types.ts` to include `run_id`

**What**: `ApproveEscrowParams` currently has `audit_id`, `workflow_id?`, and `action?`. The settlement approve endpoint (Phase 2) also requires `run_id`. Add `run_id: string` as a required field.

**Files**:
- `dashboard/app/lib/types/settlement.types.ts`

**Changes** — update `ApproveEscrowParams`:
```typescript
export interface ApproveEscrowParams {
  run_id: string;      // ADD — required by the rewired Phase 2 endpoint
  audit_id: string;
  workflow_id?: string;
  action?: "APPROVE" | "REJECT";
}
```

Also add `signed?: boolean` to `Form1Payload` (needed for item 8's "Form-1 signed" badge):
```typescript
signed?: boolean;
```

**Verify**: `cd dashboard && npx next build` — TypeScript will surface any callsite that is now missing `run_id`.

---

## Item 4 — Add `submitBid()` to `AuctionService`

**What**: `AuctionService` is missing `submitBid`. Add it. `BaseService.request()` handles auth, so no token parameter needed on the method signature.

**Files**:
- `dashboard/app/lib/services/auction.service.ts`

**Changes** — add import and method:
```typescript
import type { Auction, Bid, BroadcastRfpParams, SubmitBidParams } from "../types/auction.types";

// Add to class:
async submitBid(auctionId: string, bid: SubmitBidParams): Promise<Bid> {
  return this.request<Bid>("POST", `/api/v1/auctions/${encodeURIComponent(auctionId)}/bids`, {
    body: bid,
  });
}
```

**Verify**: `cd dashboard && npx next build` — no type errors; method signature matches `SubmitBidParams` from item 2.

---

## Item 5 — Fix `approveEscrow` in `api.ts` to send `run_id`

**What**: The standalone `approveEscrow()` function in `api.ts` sends `{ audit_id, action }` but is missing `run_id`. Update its signature and body. Note: `SettlementService.approve()` goes through `BaseService` and uses `ApproveEscrowParams` (updated in item 3) — that service method is already correct structurally; the body shape is passed through. The `api.ts` function is the legacy path used by any code that calls `approveEscrow` directly.

**Files**:
- `dashboard/app/lib/api.ts`

**Changes** — update `approveEscrow`:
```typescript
export async function approveEscrow(
  auditId: string,
  runId: string,        // ADD
  token: string,
  action: string = "APPROVE",
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/settlement/approve`, {
    method: "POST",
    headers: makeAuthHeaders(token),
    body: JSON.stringify({ audit_id: auditId, run_id: runId, action }),  // ADD run_id
  });
  if (!res.ok) throw new Error(`approveEscrow failed: ${res.status}`);
  return await res.json();
}
```

**Verify**: `cd dashboard && npx next build` — TypeScript will flag any existing callsites with the wrong arity; fix them as part of this item.

---

## Item 6 — Add a `RunService` and register it in `useServices`

**What**: The dispatch/page.tsx run panel needs `GET /runs/{id}` (poll) and `POST /runs` (submit). `ComplianceService` already has `runE2E`, `listRuns`, and `getRun`. Rather than creating a separate `RunService`, the existing `ComplianceService` is the correct home. However, `useServices` / `useComplianceService` is not imported in dispatch/page.tsx yet. This item prepares the hook export so dispatch/page.tsx can use it.

**Decision**: Use `ComplianceService` directly (it already has every needed method). No new file needed. Expose a named re-export `useRunService` in `useServices.ts` as an alias for `useComplianceService` to keep the dispatch page's import intent readable.

**Files**:
- `dashboard/app/lib/hooks/useServices.ts`

**Changes** — add at the bottom:
```typescript
/** Alias for useComplianceService — used by the run submission & polling panel. */
export function useRunService() { return useServices().compliance; }
```

**Verify**: `cd dashboard && npx next build` — no errors.

---

## Item 7 — Enhance `auction/page.tsx`: status chip, cleared state, bid filter, submit bid form

**What**: Four enhancements to the auction page, applied together because they all touch the same component and share state:

1. **Auction status chip** on the active auction header: map `auction.status` values `open` / `cleared` / `cancelled` / `BIDDING` / `MATCHED` to colours. Add `AUCTION_STATUS_COLOR` map and render a `<Chip>` next to the auction header title.

2. **Cleared state panel**: when `activeAuction?.status === "cleared"`, show a summary card displaying `clearing_price_inr` (already on `Auction` type as `clearing_price_inr`) and `winner_org_id` (added in item 2). Remove any hardcoded `"RECYC-DELHI-01"` references.

3. **Bid table filter**: if `currentOrg.org_type === "recycler"`, only show bids where `bid.org_id === currentOrg?.id`. Platform admins (any other org_type) see all bids. Use `useOrganization as useCompany` which is already imported.

4. **Submit Bid form**: a collapsible `<Card>` rendered only when `currentOrg?.org_type === "recycler"` AND `activeAuction` is not null AND `activeAuction.status !== "cleared"`. Fields: `volume_tons` (number TextField) and `price_per_kg` (number TextField). Submit button calls `auctionSvc.submitBid(activeAuction.id, { volume_tons, price_per_kg })`, then refreshes bids. Show inline success/error Alert.

**Files**:
- `dashboard/app/auction/page.tsx`

**Key implementation notes**:
- Import `useOrganization as useCompany` is already present — destructure `currentOrg` from it (it currently only destructures `companyId`). Change `const { companyId } = useCompany()` to `const { companyId, currentOrg } = useCompany()`.
- `CorridorVisualizer` reads `clearing_price_inr` which is already on the `Auction` type — no change needed there.
- Add state: `bidVolume: string`, `bidPrice: string`, `submittingBid: boolean`, `bidSubmitResult: string | null`, `bidSubmitError: string | null`.
- `STATUS_COLOR` map already covers bid statuses. Add a separate `AUCTION_STATUS_COLOR` map for auction-level statuses:
  ```typescript
  const AUCTION_STATUS_COLOR: Record<string, "success"|"warning"|"error"|"info"|"default"> = {
    open:      "info",
    cleared:   "success",
    cancelled: "error",
    BIDDING:   "warning",
    MATCHED:   "success",
  };
  ```
- Render the auction status chip in the auction selector chip row and also in the active auction panel header.
- The "cleared" summary card is inserted between the corridor visualiser card and the order book card, only when `activeAuction?.status === "cleared"`.

**Verify**: `cd dashboard && npx next build` — no TypeScript errors.

---

## Item 8 — Update `dispatch/page.tsx`: add Run panel, HITL banner, approve button, Form-1 status, PDF download

**What**: Add a "Run Submission & Monitoring" panel to the top of the existing dispatch page (Option A chosen over Option B). 

**Rationale for Option A**: The sidebar already has "CPCB Form-1 Vault" pointing to `/dispatch`. Adding a new `/runs` route would require a new nav entry in `AppSidebar.tsx`. The run panel is operationally connected to dispatch (run → audit → Form-1); keeping them on the same page reflects the workflow sequence and requires no nav changes.

This item is the largest and covers D3 + D5 together since both touch `dispatch/page.tsx`.

### D3 — Run panel additions

**New state** (add to `DispatchPage`):
```typescript
const [runResult, setRunResult]       = useState<E2ERunResult | null>(null);
const [runPolling, setRunPolling]     = useState(false);
const [runError, setRunError]         = useState<string | null>(null);
const [submittingRun, setSubmittingRun] = useState(false);
const [approving, setApproving]       = useState(false);
const [approveError, setApproveError] = useState<string | null>(null);
const [approveResult, setApproveResult] = useState<string | null>(null);
const runPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

**New hooks** (add at top of component):
```typescript
const runSvc = useRunService();   // from useServices — import useRunService
const { user } = useSession();    // import useSession
```

**Run submission**:
- Add `<Card>` at the top of the page (above the breadcrumbs section would be visually wrong; insert it as the **second card** after the breadcrumbs and title, before the existing "Dispatch Action Panel").
- The card has a "Submit Compliance Run" section: fields `company_id` (pre-filled from `useOrganization` or empty string), `category` (dropdown matching the auction categories), `volume_tons` (number input), `simulate_spoof` (checkbox). Submit calls:
  ```typescript
  const result = await runSvc.runE2E({ type: "e2e_compliance", params: { company_id, category, volume_tons, simulate_spoof } });
  setRunResult(result);
  startRunPolling(result.run_id);
  ```

**Run polling** (`startRunPolling(runId)`):
- Clears any existing interval.
- Sets `runPolling = true`.
- Every 5 seconds calls `runSvc.getRun(runId)`, updates `runResult`.
- Stops polling when `result.status` is `"completed"` or `"failed"` (not `"pending"` / `"running"`).
- Cleanup: clear interval on component unmount (add to `useEffect` cleanup).

**HITL banner**: when `runResult?.hitl_required === true` AND `runResult.status !== "completed"`, show:
```tsx
<Alert severity="warning" icon={<WarningIcon />}>
  Human-in-the-loop approval required for run {runResult.run_id}
</Alert>
```

**Approve button**: rendered when `runResult?.hitl_required === true` AND `user?.role === "admin"` AND `runResult.status !== "completed"`:
```tsx
<Button
  variant="contained"
  color="warning"
  startIcon={approving ? <CircularProgress size={14} /> : <CheckCircleIcon />}
  disabled={approving}
  onClick={handleApprove}
>
  {approving ? "Approving…" : "HITL Approve"}
</Button>
```

`handleApprove` calls `settlementSvc.approve({ run_id: runResult.run_id, audit_id: runResult.audit_hash ?? "" })`. On success sets `approveResult` message and refreshes `runResult` once.

**Run stage display**: a `<Stepper>` or a simple status row showing `pending → running → completed/failed`. Map `runResult.status` to a coloured `<Chip>` using:
```typescript
const RUN_STATUS_COLOR = { pending: "default", running: "info", completed: "success", failed: "error", hitl_required: "warning" };
```
Remove any hardcoded stage output strings.

### D5 — Form-1 status and PDF download

**`FormCard` chip fix**: change the chip colour logic from `status.includes("ACCEPTED")` to an explicit map:
```typescript
const PORTAL_STATUS_COLOR: Record<string, "success"|"warning"|"secondary"|"error"> = {
  READY_FOR_MANUAL_UPLOAD: "success",
  SUBMITTED: "secondary",
  REJECTED: "error",
};
const chipColor = PORTAL_STATUS_COLOR[status] ?? "secondary";
```
Replace label `"CPCB_ACCEPTED"` display: the existing code does not hardcode this in the label (it reads from `f.portal_status`), so this only affects the chip colour logic above.

**"Ready for manual upload" text**: in `FormCard`, below the chip, add:
```tsx
{status === "READY_FOR_MANUAL_UPLOAD" && (
  <Typography variant="caption" color="success.light" sx={{ mt: 0.5, display: "block" }}>
    Form-1 generated — ready for manual upload to CPCB portal
  </Typography>
)}
```

**"Form-1 signed" badge**: in `FormCard`, when `f.signed === true`:
```tsx
<Chip label="Signed ✓" size="small" color="success" variant="outlined" sx={{ fontSize: "0.6rem" }} />
```
(`signed` field added to `Form1Payload` in item 3.)

**PDF download button**: add to `FormCard` actions row and also in the detail Dialog's `DialogActions`:
```tsx
<Button
  size="small"
  variant="outlined"
  startIcon={<DownloadIcon />}
  href={`${API_BASE}/api/v1/audit/report/${f.audit_hash_sha256}/pdf`}
  target="_blank"
  rel="noopener noreferrer"
  download
>
  Download PDF
</Button>
```
Import `DownloadIcon` from `@mui/icons-material/Download`.

The `audit_hash_sha256` field is already on `Form1Payload`. No new API call needed — use a plain `<a>`-style `href` via MUI Button's `component="a"` pattern for the PDF endpoint (it returns a file, not JSON, so `BaseService.request` is not appropriate here — direct href is correct).

**Dialog ACK chip fix**: in the `DialogTitle` chip, replace the hardcoded `"ACCEPTED"` fallback label with `selectedForm.portal_status ?? selectedForm.cpcb_portal_submission?.portal_status ?? "—"`.

**Files**:
- `dashboard/app/dispatch/page.tsx`

**New imports to add**:
```typescript
import WarningIcon from "@mui/icons-material/Warning";
import DownloadIcon from "@mui/icons-material/Download";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import { useRunService } from "../lib/hooks/useServices";
import { useSession } from "../lib/contexts/SessionContext";
import { useOrganization } from "../lib/contexts/OrganizationContext";
import type { E2ERunResult } from "../lib/types/compliance.types";
```

**Verify**: `cd dashboard && npx next build` — no TypeScript errors. All new state and imported types must resolve cleanly.

---

## Item 9 — Add `"Compliance Runs"` nav entry to `AppSidebar` (optional enhancement, keep with dispatch)

**What**: The run panel lives inside `/dispatch`. No new route is created (Option A chosen). However, add a clearer label to the existing "CPCB Form-1 Vault" nav item to reflect the combined purpose, or leave it as-is. 

**Decision**: Leave the nav label unchanged — the page is still primarily the Form-1 Vault. The Run panel is an operational precursor section, not a separate page. No changes needed to `AppSidebar.tsx`.

**Files**: None (decision only — no code change).

**Verify**: N/A.

---

## Dependency Order Summary

| Item | Depends on |
|------|-----------|
| 1 (OrganizationContext fix) | — |
| 2 (auction.types.ts) | — |
| 3 (settlement.types.ts) | — |
| 4 (AuctionService.submitBid) | Item 2 |
| 5 (api.ts approveEscrow) | Item 3 |
| 6 (useRunService alias) | — |
| 7 (auction/page.tsx) | Items 1, 2, 4 |
| 8 (dispatch/page.tsx) | Items 3, 5, 6 |
| 9 (nav decision) | — (no-op) |

Items 1, 2, 3, 6 are independent and can be implemented in any order. Items 4, 5 must follow their respective type files. Items 7 and 8 must be last.

---

## Files Changed (complete list)

| File | Change type |
|------|------------|
| `dashboard/app/lib/contexts/OrganizationContext.tsx` | Fix `toContextOrg` mapper |
| `dashboard/app/lib/types/auction.types.ts` | Add `winner_org_id`, `corridor_min/max` to `Auction`; add `org_id` to `Bid`; add `SubmitBidParams` |
| `dashboard/app/lib/types/settlement.types.ts` | Add `run_id` to `ApproveEscrowParams`; add `signed?` to `Form1Payload` |
| `dashboard/app/lib/services/auction.service.ts` | Add `submitBid()` method |
| `dashboard/app/lib/api.ts` | Add `run_id` param to `approveEscrow()` |
| `dashboard/app/lib/hooks/useServices.ts` | Add `useRunService` alias |
| `dashboard/app/auction/page.tsx` | Status chip, cleared panel, bid filter, submit bid form |
| `dashboard/app/dispatch/page.tsx` | Run panel (submit + poll + HITL), Form-1 status labels, PDF download, chip fix |

---

## Key Decisions Recorded

- **D3 Option A chosen** (run panel in dispatch/page.tsx, not a new /runs route): The sidebar already maps `/dispatch` to "CPCB Form-1 Vault". Adding a `/runs` route would require a new NAV_ITEMS entry and a new page file. The run → audit → Form-1 sequence is one workflow; keeping it on one page reduces context switching and requires no nav changes.

- **`org_type` source is `Organization.role`**: The `organization.types.ts` file uses `role: "admin" | "compliance_officer" | "recycler"` as the discriminator. This is the correct field to map to `context.org_type` for the `currentOrg.org_type === "recycler"` gate.

- **PDF download is a direct `href`**, not a `BaseService.request()` call: the audit PDF endpoint returns a file, not JSON. MUI Button with `component="a"` + `href` is the correct pattern. The auth token is not sent (CPCB reports are not sensitive enough to gate behind a fresh fetch in the browser — if token gating is needed later, that's a separate task).

- **`ComplianceService` reused for runs**, not a new `RunService`: it already has `runE2E`, `getRun`, `listRuns`, and `getRunSteps`. A thin `useRunService` alias in `useServices.ts` gives the dispatch page a semantically clear import without introducing a new class.

- **`audit_id` in HITL approve** is populated from `runResult.audit_hash`: `E2ERunResult.audit_hash` is the closest available field returned by `POST /runs`. If the backend returns a dedicated `audit_id` field, the implementer should use that instead — it would need to be added to `E2ERunResult` in `compliance.types.ts`. The plan uses `audit_hash` as a safe fallback and notes this explicitly.
