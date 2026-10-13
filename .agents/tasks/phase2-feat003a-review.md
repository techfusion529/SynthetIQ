# FEAT-003a: Worker Activity Result Models and Fail-Closed Gates

FEAT-003a adds typed result contracts (six Pydantic models) and fail-closed gates (`_require` calls plus deterministic Python verdicts) to `agent_activities.py`, replacing hardcoded defaults that allowed fraudulent or incomplete agent results to pass silently through workflows.

Watch for: the auction activity calls `_require(result, "clearing_price", ...)` but the treasury agent returns `clearing_price_inr` — this mismatch will cause retryable failures on every real auction run until the agent or a normalisation line is updated (confirmed). The PO activity never wraps its return value in `POResult`, leaving it the one activity whose output is unvalidated against its declared model (confirmed).

**Verdict**: NEEDS_CHANGES

---

## High-level view

The PO activity's hardcoded `audit_verdict="APPROVED"` and `human_approved=True` defaults are gone, replaced with non-retryable `ApplicationError` if either is absent at call time. The form1 activity no longer defaults `portal_status` to `"CPCB_ACCEPTED"`. For the audit path, `delta_percent` is required from the agent and the verdict is overwritten entirely in Python — no LLM verdict string can reach a downstream workflow step.

Two field name mismatches leave activities operationally broken until corresponding agent updates land: the auction activity gates on `clearing_price` but the treasury agent returns `clearing_price_inr`; the audit activity gates on `delta_percent` but the auditor agent may return `delta_mass`. Both will fail retryably on every production run. The report documents both and defers resolution to the agent side.

The PO activity defines `POResult` but returns the raw `run_erp_agent` dict. Every other activity wraps its return in `Model(**result).model_dump()`; the PO path is the exception and skips validation of `po_id`, `escrow_amount`, and `audit_verdict` on the way out.

---

<details>
<summary>Issues (4)</summary>

1. **Auction `clearing_price` field mismatch** — `_require(result, "clearing_price", "auction")` fires on every run because the treasury agent returns `clearing_price_inr`, not `clearing_price`. Add `result.setdefault("clearing_price", result.get("clearing_price_inr"))` before the `_require` call, or rename the agent output key. Until resolved, the auction activity fails retryably on every invocation.

2. **`delta_percent` vs `delta_mass` key contract** — The auditor agent may return `delta_mass` rather than `delta_percent`. `_require(result, "delta_percent", "audit")` will catch this and fail retryably, but it means the audit activity breaks on every real run until the agent is updated. This needs to be tracked and landed alongside or before this change goes to production.

3. **`POResult` model unused** — `create_escrow_split_po_activity` returns the raw agent dict rather than `POResult(**result).model_dump()`. A missing `po_id` or `escrow_amount` from `run_erp_agent` passes silently. Fix: replace `return result` with `return POResult(**result).model_dump()`.

4. **`non_retryable=True` in PO gates vs `non_retryable=False` in `_require`** — Missing `audit_verdict` or `human_approved` in the PO activity raises a non-retryable error (permanent workflow failure); all other fail-closed gates via `_require` are retryable. If the intent is that a missing PO parameter is a caller bug rather than a transient agent failure, this distinction is correct but should be documented. If unintentional, align to `non_retryable=False`.

</details>

---

<details>
<summary>Details</summary>

### Auction and audit field name mismatches

The auction activity sets a fallback for `clearing_price_inr` but never maps it to the canonical `clearing_price` that both `_require` and `AuctionResult` expect:

```python
result.setdefault("clearing_price_inr", result.get("clearing_price_inr", statutory_base_rate * 0.65))
# ...
_require(result, "clearing_price", "auction")   # ← fires if agent only returns clearing_price_inr
```

A one-line normalisation fixes this: `result.setdefault("clearing_price", result.get("clearing_price_inr"))`.

The audit activity has the same shape of problem: the gate requires `delta_percent`, but the report notes the auditor agent may return `delta_mass`. Unlike the auction case, no normalisation was added and no setdefault exists for `delta_percent`. The fail-closed behavior is correct — but it means audit activities will fail retryably on every real run until the agent is patched.

### `POResult` unused in return path

Five of six activities return `Model(**result).model_dump()`. The PO activity does not:

```python
result.setdefault("po_number", f"PO-{uuid.uuid4().hex[:8].upper()}")
return result   # ← raw dict; POResult never instantiated
```

`POResult` requires `po_id`, `escrow_amount`, and `audit_verdict`. A `run_erp_agent` response that omits `po_id` propagates undetected into downstream workflow steps. The fix is `return POResult(**result).model_dump()`.

### `non_retryable` asymmetry

The PO activity raises `ApplicationError(..., non_retryable=True)` for missing `audit_verdict` and `human_approved`. The `_require` helper always uses `non_retryable=False`. The difference matters in Temporal: a non-retryable failure halts the activity permanently and surfaces to the workflow as a terminal error, while retryable errors trigger the activity's retry policy. For a parameter that must be supplied by the calling workflow (not something a transient agent failure could fix), non-retryable is defensible — but the asymmetry with every other fail-closed gate in this file is a silent footgun for future maintainers who assume all `FAIL_CLOSED:` errors behave the same way.

</details>

---

<details>
<summary>File map</summary>

| File | Change |
|---|---|
| `worker/src/activities/agent_activities.py` | Added six Pydantic result models, `_require` helper, deterministic audit verdict logic, and fail-closed gates across five activities; removed hardcoded defaults |

Full diff: `git diff main -- worker/src/activities/agent_activities.py`

</details>
