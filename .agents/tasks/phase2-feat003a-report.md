# FEAT-003a Report — Worker Activity Result Models + Fail-Closed Gates

**File modified:** `worker/src/activities/agent_activities.py`

---

## C1 — Fix missing `import hashlib`

Added `import hashlib` at the top of the file. It was already used in
`generate_audit_report_pdf_activity` but not imported, causing a `NameError` at
runtime whenever that activity executed.

---

## C2 — Activity result models

Added the following imports and model classes after the existing top-level imports:

```
from pydantic import BaseModel          (added)
from typing import Any, Literal         (merged — Literal added to existing typing import)
from temporalio.exceptions import ApplicationError  (added)
```

Six Pydantic `BaseModel` classes added:

| Model | Fields |
|---|---|
| `LiabilityResult` | `net_liability_tons: float`, `gross_liability_tons: float`, `category: str` |
| `AuctionResult` | `clearing_price: float`, `winner_org_id: str`, `total_volume_tons: float` |
| `AuditResult` | `delta_percent: float`, `verdict: Literal["PASS","FAIL","HITL"]`, `physical_melt_verified: bool`, `audit_id: str` |
| `POResult` | `po_id: str`, `escrow_amount: float`, `audit_verdict: str` |
| `Form1Result` | `form1_id: str`, `signed: bool = False`, `portal_status: str` |
| `PDFResult` | `pdf_path: str`, `hash_hex: str` |

---

## C3 — Fail-closed gates

### Helper function `_require`

Added after model definitions:

```python
def _require(d: dict, key: str, activity_name: str):
    """Raise a retryable ApplicationError if key is missing or None."""
    if key not in d or d[key] is None:
        raise ApplicationError(
            f"FAIL_CLOSED: {key} missing from {activity_name} result",
            non_retryable=False,
        )
    return d[key]
```

### `calculate_brand_liability_activity`

- Added `_require(result, "net_liability_tons", "liability")` before return.
- Return changed to `return LiabilityResult(**result).model_dump()`.

### `execute_double_auction_activity` (auction)

- Added `_require(result, "clearing_price", "auction")`.
- Added `_require(result, "winner_org_id", "auction")`.
- Removed hardcoded `"RECYC-DELHI-01"` winner default (none was present in source; no `setdefault` existed for `winner_org_id`).
- Return changed to `return AuctionResult(**result).model_dump()`.

### `audit_scada_telemetry_activity`

- Added `_require(result, "delta_percent", "audit")`.
- Replaced any LLM-sourced verdict with deterministic Python computation:
  ```python
  delta = result["delta_percent"]
  threshold = result.get("threshold", 2.0)
  if delta > threshold * 2:
      verdict = "FAIL"
  elif delta > threshold:
      verdict = "HITL"
  else:
      verdict = "PASS"
  result["verdict"] = verdict
  ```
- Removed `result.setdefault("physical_melt_verified", not result.get("is_spoofed", False))`.
  Replaced with `_require(result, "physical_melt_verified", "audit")`.
- Return changed to `return AuditResult(**result).model_dump()`.

### `create_escrow_split_po_activity`

- Added `audit_verdict: str | None = None` and `human_approved: bool | None = None`
  as explicit parameters (previously hardcoded).
- Raises `ApplicationError(..., non_retryable=True)` if `audit_verdict is None`.
- Raises `ApplicationError(..., non_retryable=True)` if `human_approved is None`.
- Removed `audit_verdict="APPROVED"` and `human_approved=True` from the `run_erp_agent` call.
- Now passes caller-supplied values through to the agent.

### `generate_and_dispatch_form1_activity`

- Removed `result.setdefault("cpcb_portal_status", result.get("portal_status", "CPCB_ACCEPTED"))` line.
- Added `_require(result, "portal_status", "form1")` after agent call.
- Added `result.setdefault("form1_id", ...)` to ensure the `Form1Result` required field is present.
- Return changed to `return Form1Result(**result).model_dump()`.

---

## Verification

Command run from `c:\Users\HP\SynthetIQ\worker\src`:

```powershell
python -c "import sys; sys.path.insert(0,'.'); from activities.agent_activities import audit_scada_telemetry_activity; import hashlib; print('ok')"
```

**Output:**
```
ok
```

Exit code: 0 — no import errors.

---

## Issues encountered and resolutions

1. **`form_id` vs `form1_id`**: The original code used `form_id` as the setdefault key; `Form1Result` requires `form1_id`. Added `result.setdefault("form1_id", ...)` and kept a `result.setdefault("form_id", result["form1_id"])` alias so downstream callers that read `form_id` are not broken.

2. **`delta_percent` vs `delta_mass`**: The existing audit activity stored the fraud delta as `delta_mass`. `AuditResult` and the spec require `delta_percent`. The activity now calls `_require(result, "delta_percent", "audit")`, meaning the `run_auditor_agent` agent must return this key. If the agent returns `delta_mass` instead, the activity will raise a retryable `ApplicationError` — which is the intended fail-closed behavior.

3. **`clearing_price` vs `clearing_price_inr`**: The treasury agent result uses `clearing_price_inr`; `AuctionResult` requires `clearing_price`. The `_require` call will catch a missing `clearing_price` key and fail closed. The agent must be updated to return `clearing_price` directly, or a normalisation line added. No normalisation was added here per the instruction to make only the specified changes.
