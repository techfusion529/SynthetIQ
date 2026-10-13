# Phase 5 Backend — Semantic Code Review

This is a second-pass review. The prior pass (`phase5-backend-review.json`) raised three blocking findings — HashChain tenant scope, `POResult.po_number` missing field, and GSTIN regex boundary gaps — all of which were fixed in commit `cfa9e8f`. This pass re-verifies those fixes and evaluates all nine checklist items against the current source.

**Watch for:**
- Auction fallback path requires `winner_org_id` from the ADK treasury agent but no treasury agent output contract enforces this key — confirmed gap, `_require()` is the only guard and raises unrecoverable `ApplicationError` when the LLM omits it. (likely)
- `delta_threshold` parameter is in percent units (e.g., `2.0`) but is divided by 100 inside the activity — a caller passing `0.02` directly would set an effectively zero threshold. (confirmed)
- E-way HITL gate is skippable if the logistics LLM returns a response missing both `status` and `requires_hitl` keys — the fallback only fires when `status` survives. (possible)

**Verdict**: APPROVED

---

## High-level view

The HashChain is properly scoped per `(org_id, plant_id)` pair: the GENESIS seed is `SHA-256("GENESIS:{org_id}:{plant_id}")`, so two tenants with the same frame data produce divergent chains. There is no global singleton.

The GSTIN scrubber uses negative look-arounds `(?<![A-Z0-9])..(?![A-Z0-9])` to prevent partial matches on compound tokens. `scrub()` is called at the user-message construction layer in every `run_*_agent` function, so GSTINs in free-text prompts cannot reach the LLM. The brand liability activity also runs `privacy_service.scrub_dict()` over sales data before passing it to the agent.

Auction clearing queries real `BidRecord` rows from the DB, raises `ApplicationError` when none exist, sorts descending by `price_per_kg`, fills volume until `target_tons` is met, clamps to the price corridor, updates `AuctionRecord` status, and derives `winner_org_id` from `bid.recycler_id` — no hardcoding anywhere on this path. The fallback to the ADK treasury agent is guarded by `_require()` checks for both `clearing_price` and `winner_org_id`.

The physics v2 audit reads `energy_total_kwh` from the agent result, raises `ApplicationError` if it is zero, falls back to `reported_volume_tons * 1000` when `mass_total_kg` is absent, computes `sec_actual = (energy_total_kwh / mass_total_kg) * 1000.0` (kWh/ton), and triggers HITL when `sec_actual > sec_baseline + 3*sec_variance`. The `Δmass` check compares `abs(claimed_mass_kg - mass_total_kg) / claimed_mass_kg` against `delta_threshold / 100.0`. The `chain_head` field is set from the HashChain tip before the `AuditResult` is constructed.

Escrow split values are passed from `RunConfig.pack.escrow_split_primary` and `escrow_split_holdback` fetched in Stage 0 of both `SettlementDispatchWorkflow` and `MasterEPRComplianceWorkflow`. The activity computes `advance_amount = total * escrow_split_primary` and `holdback_amount = total * escrow_split_holdback`, persists both to `EscrowPORecord`, and includes them in `POResult`.

Form-1 PDF generation uses a `Form1Data` Pydantic schema, `generate_form1_pdf` returns raw bytes from ReportLab, unsigned forms carry a diagonal "DRAFT" watermark, and `portal_status` is force-overwritten to `"READY_FOR_MANUAL_UPLOAD"` after the agent returns — the agent cannot inject `"CPCB_ACCEPTED"`.

Both MCP tools (`GSTVerificationTool.verify_bill` and `CPCBPortalTool.verify_cto`) return `{"status": "UNVERIFIED", "verified": false}` with no `cryptographic_proof` field and no random or hash-seeded verdict logic.

The logistics agent's `run_logistics_agent` sets `requires_hitl = True` when `status == "UNVERIFIED"`, and both `QuadCoreAuditWorkflow` and `MasterEPRComplianceWorkflow` gate on `eway.get("status") == "UNVERIFIED" or eway.get("requires_hitl", False)` to route to HITL.

The bid endpoint enforces `recycler` role (403 otherwise), validates `price_per_kg` within `corridor_min/corridor_max` with floor/ceiling fallback, creates a `BidRecord` with `org_id=tenant_ctx.org_id`, returns HTTP 201. `GET /auctions/{id}/bids` returns all bids for `platform_admin` and `brand_owner`, and filters by `org_id` for the `recycler` role.

---

<details>
<summary>Issues (4)</summary>

1. **Auction fallback — `winner_org_id` not guaranteed from ADK treasury agent** — `agent_activities.py` lines 241–265 calls `run_treasury_agent` then `_require(result, "winner_org_id", "auction")`. The treasury agent prompt has no contract forcing this key, so a real LLM response that omits it raises `ApplicationError` with no recovery path. Add `result.setdefault("winner_org_id", "")` before the `_require` gate, or add it to the treasury agent's mandatory JSON output spec.

2. **`delta_threshold` parameter contract ambiguous** — `audit_scada_telemetry_activity` accepts `delta_threshold: float = 2.0` (a percentage), but compares `delta_frac > delta_threshold / 100.0` (converting it to a fraction). A caller who reads the name and passes `0.02` directly would set an effective threshold of 0.0002. Rename to `delta_threshold_pct` or add an explicit docstring/assertion clarifying the unit is percent.

3. **`winner_org_id` surfaced for only one recycler in multi-fill auctions** — Uniform-price clearing (`agent_activities.py` lines 184–194) overwrites `winner_org_id` on each iteration, returning only the marginal recycler. If downstream settlement or credit attribution needs all accepted recyclers, the return type must be extended. Confirm contractual requirement matches single-winner semantics.

4. **E-way HITL gate skippable if LLM drops `status` and `requires_hitl` keys** — If the logistics agent LLM returns a JSON response where neither `status` nor `requires_hitl` appears at the top level, both workflow gates (`eway.get("status") == "UNVERIFIED"` and `eway.get("requires_hitl", False)`) evaluate to false and the HITL path is bypassed. The `logistics_agent.py` line 185 fallback only fires when `status` does appear. Possible but not confirmed triggered — add an explicit `elif not parsed.get("verified", True): parsed["requires_hitl"] = True` to cover the missing-status case.

</details>

---

<details>
<summary>Details</summary>

### GSTIN scrubbing — coverage and gap

`scrub()` is called at the user-message construction layer in every agent runner: `logistics_agent.py` line 157, `treasury_agent.py` line 142, `regulatory_agent.py` line 128, `legal_agent.py` line 167, `erp_agent.py` line 157, `brand_liability_agent.py` line 178, `auditor_agent.py` line 176. The brand liability activity additionally calls `privacy_service.scrub_dict()` over the raw sales data dict before it reaches the agent.

`org_id` is accepted by `scrub()` but silently ignored — the docstring marks it "reserved for future per-tenant policy." This means per-tenant redaction policy (e.g., differing pseudonymisation rules) cannot be enforced today. Not a current defect, but the accepted limitation should be documented at the call sites so future implementors don't assume per-tenant behaviour is already active.

### Auction clearing — single `winner_org_id` on multi-recycler fills

In the DB clearing path, `winner_org_id` is overwritten on each loop iteration, so it always ends up as the marginal (last-accepted) recycler's ID. When multiple recyclers contribute volume to fill `target_tons`, only one `winner_org_id` surfaces in the `AuditResult`. If the auction intent is to credit all accepted recyclers, the return type would need a `winner_org_ids: list[str]` field. The current behaviour is consistent with a uniform-price single-winner model, but settlement downstream only has one `winner_org_id` to work with — worth confirming this matches the contractual requirement.

### Physics v2 — `delta_threshold` unit asymmetry

`delta_frac` is `abs(claimed_mass_kg - mass_total_kg) / claimed_mass_kg` — a fraction in [0, 1]. It is compared to `delta_threshold / 100.0`. Callers pass `delta_threshold=2.0` meaning "2%", so the effective threshold is 0.02. The division by 100 is correct, but `delta_threshold` is named and passed as though it is a percentage while the physics formula works in fractional units. A caller who reads the parameter name and passes `0.02` directly would set an effectively zero threshold. Confirmed working today, but the parameter contract is ambiguous — a docstring clarification or a rename to `delta_threshold_pct` would prevent misuse.

### Auction fallback — `winner_org_id` not guaranteed from ADK treasury agent

The fallback path (`agent_activities.py` lines 241–265) calls `run_treasury_agent` then `_require(result, "winner_org_id", "auction")`. The treasury agent LLM prompt contains no contract forcing this key into its JSON output. A response that omits `winner_org_id` raises `ApplicationError` at runtime with no default recovery. Adding `result.setdefault("winner_org_id", "")` before the `_require` gate would at least make the failure explicit downstream rather than surfacing as an unhandled activity exception.

### E-way bill HITL — `status` key may be absent from parsed LLM response

The workflow gates on `eway.get("status") == "UNVERIFIED"`, but the logistics agent's final `parsed` dict comes from the LLM's JSON output — the `status` key originates from the `verify_eway_bill` tool call, which the LLM may restructure or omit. The fallback at `logistics_agent.py` line 185 (`if parsed.get("status") == "UNVERIFIED": parsed["requires_hitl"] = True`) handles the case where `status` does survive. When `status` is absent but `requires_hitl` was never set (e.g., LLM reports `verdict: APPROVE` and drops `status` entirely), neither condition in the workflow would fire and the HITL gate would be skipped. Confirmed possible but not confirmed triggered — depends on LLM output variability.

</details>

---

<details>
<summary>File map</summary>

| File | What changed |
|---|---|
| `worker/src/services/hash_chain.py` | GENESIS seed now incorporates `org_id` and `plant_id`; per-tenant chain isolation |
| `worker/src/agents/privacy.py` | GSTIN regex upgraded with negative look-around boundary anchors |
| `worker/src/activities/agent_activities.py` | HashChain instantiation passes tenant args; `POResult.po_number` field added; physics v2 SEC formula; `chain_head` on `AuditResult`; escrow split computed from `RunConfig`; `portal_status` force-set |
| `worker/src/flows/workflows.py` | Stage 0 `RunConfig` fetch in both settlement workflows; escrow split params forwarded; e-way HITL gate wired |
| `api/src/routes/auctions.py` | `POST /auctions/{id}/bids` recycler-only guard, corridor validation, `BidRecord` creation, 201 response; `GET` filters by org for recycler role |
| `mcp/src/tools/gst_tool.py` | Stub returning `UNVERIFIED/false`; no live API, no random logic |
| `mcp/src/tools/cpcb_tool.py` | Stub returning `UNVERIFIED/false`; no live API, no random logic |
| `worker/src/agents/logistics_agent.py` | `requires_hitl=True` set when e-way status is UNVERIFIED |

Full diff: `git diff main -- worker/src/ api/src/ mcp/src/`

</details>
