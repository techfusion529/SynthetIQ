# Phase 5 Backend Implementation Plan

## Codebase findings

### Latest Alembic revision
`e7f8a9b0c1d2` (file: `e7f8a9b0c1d2_add_ingestion_runs.py`) — all migrations in Phase 5 must chain from this ID.

### Key model facts discovered
- `BidRecord` (`bids` table) already has `volume_tons FLOAT` and `price_per_kg FLOAT` columns — **no migration needed for these two columns**. Migration only needs `corridor_min`/`corridor_max` on `auction_records` (table name: `auctions`).
- `AuctionRecord` (`auctions` table) has `floor_price_inr` and `ceiling_price_inr` but **no** `corridor_min`/`corridor_max` dedicated columns — add them for the clearing algorithm.
- `EscrowPORecord` (`escrow_pos` table) already has `advance_amount_inr` and `retention_amount_inr` — repurpose `retention_amount_inr` as `holdback_amount` in code (no migration needed) or add new canonical columns `advance_amount` + `holdback_amount` as aliases. Decision: add explicit `advance_amount FLOAT` + `holdback_amount FLOAT` in migration for clarity, leaving existing columns intact.
- `OrgType` enum already has `recycler` — no changes needed to the enum.
- `TenantCtx` exposes `org_id` and `role` — use `role == "recycler"` for bid submission guard.
- `RunConfig.calibrations` is `list[PlantCalibrationSnapshot]`; `PlantCalibrationSnapshot` has `sec_baseline_kwh_per_ton` and `sec_variance` — exactly what Task 3 needs.
- `RunConfig.pack` has `escrow_split_primary` and `escrow_split_holdback` — ready to use in Task 5.
- `audit_scada_telemetry_activity` currently accepts positional args including `org_id` and `delta_threshold`; the workflow passes them correctly but `sec_baseline` and `sec_variance` are not yet passed — need to add two new params.
- `reportlab` is NOT in `worker/pyproject.toml` — must be added.
- `privacy.py` does not yet exist; `privacy_service.py` exists (in `services/`) but that is a different service — create `worker/src/agents/privacy.py` as specified.
- `fetch_recycler_bids` in `treasury_agent.py` returns `[]` (empty list with a `logger.warning`) — this is already non-fabricating. The task says "remove any existing fetch_recycler_bids call returning fabricated bids"; the function is already gutted; the rewrite in Task 2 will replace the whole activity with a direct DB query, so the function becomes dead code.
- `verify_eway_bill` tool in `logistics_agent.py` returns a hardcoded `"status": "VERIFIED"` dict — must be replaced with UNVERIFIED.
- MCP `gst_tool.py` returns `"status": "VALID"` + `"cryptographic_proof"` — replace with UNVERIFIED + remove proof field.
- MCP `cpcb_tool.py` returns `"status": "ACTIVE"` with a pseudo-random registry fingerprint — replace with UNVERIFIED.
- `generate_and_dispatch_form1_activity` calls `run_legal_agent` which uses `dispatch_to_cpcb_portal` — for Task 6 we wrap before/after the agent call to generate the PDF and set `portal_status='READY_FOR_MANUAL_UPLOAD'`.
- Worker tests use `pytest`; no test directory discovered for the worker (to be created for Task 7 unit test).

---

## Implementation Order

Tasks must be implemented in this order to avoid import errors:

1. **TASK 4** first (create `hash_chain.py` — no dependencies, pure new file)
2. **TASK 7** second (create `agents/privacy.py` — no dependencies on other new code)
3. **TASK 1** third (Alembic migration + API bid routes — depends on existing models only)
4. **TASK 5** fourth (Alembic migration + escrow state machine — depends only on existing RunConfig)
5. **TASK 3** fifth (rewrite audit activity — depends on `hash_chain.py` from Task 4, `RunConfig.calibrations`)
6. **TASK 2** sixth (rewrite auction activity — depends on migration from Task 1 adding `corridor_min`/`corridor_max`)
7. **TASK 6** seventh (Form-1 pipeline — depends on `AuditResult.chain_head` from Task 4's AuditResult addition)
8. **TASK 8** eighth (MCP tool stubs — independent, no deps)
9. **TASK 9** ninth (logistics agent UNVERIFIED — independent, no deps)

---

## Plan Items

- [ ] 1. **[TASK 4] Create `worker/src/services/hash_chain.py`**
      Create a `HashChain` class with `append(frame: TelemetryFrame) -> str` and `head` property.
      `append` serialises the frame as `json.dumps(frame.model_dump(), sort_keys=True, default=str)`,
      computes `sha256(previous_head + payload_json)`, stores it as the new head, and returns it.
      Initial head is `sha256(b"GENESIS")`. Class is pure Python with no external dependencies.
      Files: `worker/src/services/hash_chain.py`
      Verify: `cd worker && python -c "from services.hash_chain import HashChain; print('ok')"` — prints `ok`.

- [ ] 2. **[TASK 7] Create `worker/src/agents/privacy.py`**
      Create `scrub(text: str, org_id: str) -> str` function.
      Uses a compiled regex `r'[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}'`
      to replace all GSTIN matches with `[GSTIN-REDACTED]`.
      Also add `scrub_dict(data: dict, org_id: str) -> dict` that `json.dumps`/`json.loads` round-trips
      the dict through `scrub()`.
      Files: `worker/src/agents/privacy.py`
      Verify: `cd worker && python -c "from agents.privacy import scrub; assert '[GSTIN-REDACTED]' in scrub('27AAACH1234F1Z5', 'ORG-1'); print('ok')"` — prints `ok`.

- [ ] 3. **[TASK 1 — migration] Add Alembic migration for bid and auction schema changes**
      Create `packages/synthetiq-shared/alembic/versions/f1a2b3c4d5e6_phase5_bids_corridor.py`.
      Revision ID: `f1a2b3c4d5e6`. `down_revision = 'e7f8a9b0c1d2'`.
      `upgrade()`:
        - `op.add_column('auctions', sa.Column('corridor_min', sa.Float(), nullable=True))`
        - `op.add_column('auctions', sa.Column('corridor_max', sa.Float(), nullable=True))`
      `downgrade()`:
        - `op.drop_column('auctions', 'corridor_max')`
        - `op.drop_column('auctions', 'corridor_min')`
      Note: `BidRecord` already has `volume_tons` and `price_per_kg` — no bid table changes needed.
      Files: `packages/synthetiq-shared/alembic/versions/f1a2b3c4d5e6_phase5_bids_corridor.py`
      Verify: `cd packages/synthetiq-shared && alembic upgrade head` — completes without error.

- [ ] 4. **[TASK 1 — API] Add bid submission and bid listing endpoints to `api/src/routes/auctions.py`**
      Add `POST /auctions/{auction_id}/bids`:
      - Accept body `BidSubmitRequest(volume_tons: float, price_per_kg: float)` (Pydantic model inline or in a local schema).
      - Require `tenant_ctx.role == "recycler"` else raise `HTTPException(403, "recycler role required")`.
      - Fetch the `AuctionRecord` for `auction_id`; if not found raise 404; if `status != "ACTIVE"` raise 400.
      - Validate `corridor_min <= price_per_kg <= corridor_max` (fall back to `floor_price_inr`/`ceiling_price_inr` if corridor columns are NULL); raise 422 if out-of-corridor.
      - Create `BidRecord(bid_id=f"BID-{uuid4().hex[:8].upper()}", auction_id=auction_id, recycler_id=tenant_ctx.org_id, org_id=tenant_ctx.org_id, volume_tons=..., price_per_kg=..., category=auction.category, status="BIDDING")`.
      - Return 201 with the bid dict.
      Update `GET /auctions/{auction_id}/bids` (already exists as `list_auction_bids`):
      - Add `tenant_ctx` dependency.
      - If `tenant_ctx.is_platform_admin`: return all bids.
      - If `tenant_ctx.role == "brand_owner"`: return all bids for this auction (brand owner is the auction creator).
      - If `tenant_ctx.role == "recycler"`: filter `BidRecord.org_id == tenant_ctx.org_id`.
      Files: `api/src/routes/auctions.py`
      Verify: `cd api && python -m pytest tests/ -q` (or `python -c "from src.routes.auctions import router; print('ok')"`) — no import errors.

- [ ] 5. **[TASK 5 — migration] Add Alembic migration for escrow advance/holdback columns**
      Create `packages/synthetiq-shared/alembic/versions/g2b3c4d5e6f7_phase5_escrow_split.py`.
      Revision ID: `g2b3c4d5e6f7`. `down_revision = 'f1a2b3c4d5e6'` (chains from Task 1 migration).
      `upgrade()`:
        - `op.add_column('escrow_pos', sa.Column('advance_amount', sa.Float(), nullable=True))`
        - `op.add_column('escrow_pos', sa.Column('holdback_amount', sa.Float(), nullable=True))`
        - `op.add_column('escrow_pos', sa.Column('escrow_status', sa.String(32), nullable=True, server_default='advance_pending'))`
      `downgrade()`: drop the three columns.
      Files: `packages/synthetiq-shared/alembic/versions/g2b3c4d5e6f7_phase5_escrow_split.py`
      Verify: `cd packages/synthetiq-shared && alembic upgrade head` — completes without error.

- [ ] 6. **[TASK 5 — ORM + activity] Update `EscrowPORecord` model and `create_escrow_split_po_activity`**
      In `packages/synthetiq-shared/synthetiq_shared/models/organization.py`:
      - Add three mapped columns to `EscrowPORecord`: `advance_amount: Mapped[float | None]`, `holdback_amount: Mapped[float | None]`, `escrow_status: Mapped[str]` (default `"advance_pending"`).
      - Update `to_dict()` to include these fields.
      In `worker/src/activities/agent_activities.py`, update `create_escrow_split_po_activity`:
      - Add params `escrow_split_primary: float = 0.8` and `escrow_split_holdback: float = 0.2`.
      - After calling `run_erp_agent`, compute `total_value = plastic_tons * unit_price_inr * 1000`.
      - `advance_amount = total_value * escrow_split_primary`, `holdback_amount = total_value * escrow_split_holdback`.
      - Persist an `EscrowPORecord` row with `advance_amount`, `holdback_amount`, `escrow_status="advance_pending"` using `get_db_session`.
      - Include `advance_amount` and `holdback_amount` in the returned dict.
      - Update `POResult` model to add `advance_amount: float = 0.0` and `holdback_amount: float = 0.0`.
      In `worker/src/flows/workflows.py` Stage 4:
      - Pass `escrow_split_primary=run_config.pack.escrow_split_primary` and `escrow_split_holdback=run_config.pack.escrow_split_holdback` in the `create_escrow_split_po_activity` args list.
      Files: `packages/synthetiq-shared/synthetiq_shared/models/organization.py`, `worker/src/activities/agent_activities.py`, `worker/src/flows/workflows.py`
      Verify: `cd worker && python -c "from activities.agent_activities import create_escrow_split_po_activity; print('ok')"` — no import errors.

- [ ] 7. **[TASK 3] Rewrite `audit_scada_telemetry_activity` with Physics v2 and hash chain**
      In `worker/src/activities/agent_activities.py`:
      - Add `chain_head: str = ''` field to `AuditResult`.
      - Update `audit_scada_telemetry_activity` signature to accept `sec_baseline: float = 450.0` and `sec_variance: float = 30.0` (kWh/ton units, matching `PlantCalibrationSnapshot.sec_baseline_kwh_per_ton`).
      - Inside the activity:
        1. Fetch `TelemetryFrame` rows from DB for `(org_id, plant_id)` using `get_db_session` (query the `telemetry_frames` table if it exists, or use the agent result's embedded frames — see note below).
        2. Sum `energy_total_kwh = sum(f.energy_kwh for f in frames)` and `mass_total_kg = sum(f.mass_processed_kg for f in frames)`.
        3. If `energy_total_kwh == 0`: raise `ApplicationError("FAIL_CLOSED: zero energy total", non_retryable=False)`.
        4. `sec_actual = energy_total_kwh / mass_total_kg * 1000` (kWh/ton).
        5. `band_upper = sec_baseline + 3 * sec_variance`. If `sec_actual > band_upper`: `verdict = "HITL"` with reason `DATA_INTEGRITY_TAMPER`.
        6. `delta = abs(claimed_mass - mass_total_kg) / claimed_mass`. If `delta > delta_threshold / 100`: `verdict = "HITL"`.
        7. Both pass → `verdict = "PASS"`.
        8. Build `HashChain`, append each frame, store `chain.head` in result.
      - **Note on frames**: The `run_auditor_agent` still runs for its existing checks; if it doesn't return frame data, instantiate synthetic frames from `(energy_total_kwh, mass_total_kg)` it provides, or accept the agent result and use `reported_volume_tons` as `claimed_mass`. The deterministic physics verdict from steps 3-7 **overrides** any LLM verdict string.
      In `worker/src/flows/workflows.py`:
      - At Stage 3b: add `sec_baseline` and `sec_variance` args to `audit_scada_telemetry_activity` call, sourced from `run_config.calibrations[0]` (`sec_baseline_kwh_per_ton` and `sec_variance`).
      - Before calling the activity, check `if not run_config.calibrations: raise ApplicationError("FAIL_CLOSED: no calibrations found", non_retryable=True)`.
      Files: `worker/src/activities/agent_activities.py`, `worker/src/flows/workflows.py`
      Verify: `cd worker && python -c "from activities.agent_activities import audit_scada_telemetry_activity, AuditResult; assert hasattr(AuditResult, '__fields__') or True; print('ok')"` — no import errors.

- [ ] 8. **[TASK 2] Rewrite `execute_double_auction_activity` with deterministic uniform-price clearing**
      In `worker/src/activities/agent_activities.py`, replace the body of `execute_double_auction_activity`:
      - Change signature to accept `org_id: str = ""`, `auction_id: str = ""`, `corridor_min: float = 0.0`, `corridor_max: float = 0.0` alongside existing params (keep `rfp_id`, `category`, `target_tons`, `statutory_base_rate`).
      - Fetch `BidRecord` rows from DB: `SELECT * FROM bids WHERE auction_id = auction_id AND status = 'BIDDING'` ordered by `price_per_kg DESC`.
      - If no DB rows found, fall back to calling `run_treasury_agent` (preserves backward compat for tests without bids).
      - Uniform-price clearing algorithm:
        1. Sort accepted bids by `price_per_kg` descending.
        2. Walk bids until `cumulative_volume >= target_tons`; the last accepted bid's `price_per_kg` is `clearing_price`.
        3. Clamp: `clearing_price = max(corridor_min, min(corridor_max, clearing_price))`.
        4. `winner_org_id` = recycler_id of the last accepted bid (or first if single).
        5. `total_volume_tons` = cumulative accepted volume.
      - Update `AuctionRecord` in DB: set `clearing_price_inr = clearing_price`, `total_cleared_tons = total_volume_tons`, `status = "CLEARED"`.
      - Mark accepted `BidRecord` rows with `status = "ACCEPTED"`.
      - Return `AuctionResult(clearing_price=clearing_price, winner_org_id=winner_org_id, total_volume_tons=total_volume_tons)`.
      Files: `worker/src/activities/agent_activities.py`
      Verify: `cd worker && python -c "from activities.agent_activities import execute_double_auction_activity; print('ok')"` — no import errors.

- [ ] 9. **[TASK 6] Create Form-1 Pydantic schema and PDF generator**
      Create `worker/src/reporting/__init__.py` (empty).
      Create `worker/src/reporting/form1_schema.py`:
      - `Form1Data(BaseModel)` with fields: `org_name: str`, `fiscal_year: str`, `category: str`, `volume_tons: float`, `compliance_pct: float`, `audit_id: str`, `po_reference: str`, `chain_head: str`, `generated_date: str`, `is_signed: bool = False`.
      Create `worker/src/reporting/pdf_generator.py`:
      - `generate_form1_pdf(data: Form1Data) -> bytes` using `reportlab`.
      - A4 page, table layout: org name, fiscal year, category, volumes, compliance %, audit ID, PO reference, chain head hash (first 16 chars + "..."), generated date.
      - If `not data.is_signed`: draw a diagonal "DRAFT" watermark in grey at 45°.
      Add `reportlab>=4.2.0` to `worker/pyproject.toml` dependencies.
      Update `worker/src/activities/agent_activities.py` — `generate_and_dispatch_form1_activity`:
      - After calling `run_legal_agent`, build `Form1Data` from the result + `org_id`.
      - Call `generate_form1_pdf(form1_data)` → `pdf_bytes`.
      - Write to `/tmp/form1_{form1_id}.pdf`.
      - Set `result["portal_status"] = "READY_FOR_MANUAL_UPLOAD"` (overrides whatever the agent returned).
      - Include `pdf_path` in the returned `Form1Result` (add `pdf_path: str = ""` field to `Form1Result`).
      Files: `worker/src/reporting/__init__.py`, `worker/src/reporting/form1_schema.py`, `worker/src/reporting/pdf_generator.py`, `worker/pyproject.toml`, `worker/src/activities/agent_activities.py`
      Verify: `cd worker && python -c "from reporting.pdf_generator import generate_form1_pdf; from reporting.form1_schema import Form1Data; print('ok')"` — no import errors.

- [ ] 10. **[TASK 7 — apply scrub] Apply `scrub()` in all agent runners**
       In each of the following files, import `from agents.privacy import scrub` and call `text = scrub(text, org_id)` before passing `user_message` text to `run_agent()` (the message is assembled from org data; the org_id arg can be passed through or defaulted to `""`):
       - `worker/src/agents/treasury_agent.py` — in `run_treasury_agent`, scrub the `user_message` string.
       - `worker/src/agents/legal_agent.py` — in `run_legal_agent`, scrub the `user_message` string.
       - `worker/src/agents/logistics_agent.py` — in `run_logistics_agent`, scrub the `user_message` string.
       - `worker/src/agents/auditor_agent.py` — in `run_auditor_agent`, scrub the `user_message` string.
       - `worker/src/agents/regulatory_agent.py` — in `run_regulatory_agent`, scrub the `user_message` string.
       - `worker/src/agents/brand_liability_agent.py` — in `run_brand_liability_agent`, scrub the user message string.
       - `worker/src/agents/erp_agent.py` — in `run_erp_agent`, scrub the user message string.
       Each runner's signature may not currently take `org_id`; add `org_id: str = ""` param if not present and pass it to `scrub`.
       Create `worker/tests/__init__.py` and `worker/tests/test_privacy.py`:
       - Test that `scrub("GSTIN: 27AAACH1234F1Z5 is the supplier", "")` returns a string with no raw GSTIN pattern.
       - Test that a string with no GSTIN is returned unchanged.
       Files: `worker/src/agents/treasury_agent.py`, `worker/src/agents/legal_agent.py`, `worker/src/agents/logistics_agent.py`, `worker/src/agents/auditor_agent.py`, `worker/src/agents/regulatory_agent.py`, `worker/src/agents/brand_liability_agent.py`, `worker/src/agents/erp_agent.py`, `worker/tests/__init__.py`, `worker/tests/test_privacy.py`
       Verify: `cd worker && python -m pytest tests/test_privacy.py -v` — both tests pass.

- [ ] 11. **[TASK 8] Replace fake GST / CPCB MCP tools with UNVERIFIED state**
       In `mcp/src/tools/gst_tool.py`, replace the `verify_bill` return dict:
       - Remove `"status": "VALID"`, `"is_valid": True`, all dynamic fields, and `"cryptographic_proof"`.
       - Return `{"status": "UNVERIFIED", "message": "Live GST E-Way Bill API not connected. Manual verification required.", "verified": False, "eway_bill_number": bill_str}`.
       In `mcp/src/tools/cpcb_tool.py`, replace the `verify_cto` return dict:
       - Remove all dynamic seed-based fields and `"registry_fingerprint"`.
       - Return `{"status": "UNVERIFIED", "message": "Live CPCB registry API not connected. Manual verification required.", "verified": False, "recycler_id": rec_id, "plant_id": p_id}`.
       Files: `mcp/src/tools/gst_tool.py`, `mcp/src/tools/cpcb_tool.py`
       Verify: `cd mcp && python -c "import asyncio; from src.tools.gst_tool import gst_tool; r = asyncio.run(gst_tool.verify_bill('EWB-TEST')); assert r['status'] == 'UNVERIFIED'; assert 'cryptographic_proof' not in r; print('ok')"` — prints `ok`.

- [ ] 12. **[TASK 9] Retire fake e-way bill verifier in logistics agent**
       In `worker/src/agents/logistics_agent.py`:
       - Replace the body of `verify_eway_bill(eway_bill_number)` tool function:
         ```python
         return {
             "eway_bill_number": eway_bill_number,
             "status": "UNVERIFIED",
             "message": "Live GST E-Way Bill API not connected. Manual verification required.",
             "verified": False,
         }
         ```
       - In `run_logistics_agent` (and therefore transitively in `verify_eway_bill_activity`): after obtaining the logistics agent result, check if `result.get("verdict") == "APPROVE"` — if the bill is unverified, override verdict to `"MANUAL_REVIEW"` and set `result["requires_hitl"] = True`.
       - In `worker/src/flows/workflows.py` Stage 3a: after the `verify_eway_bill_activity` call, check `if eway.get("requires_hitl") or eway.get("status") == "UNVERIFIED"`. If the run requires e-way verification (add a flag `run_config.policy` check or simply always route to HITL on UNVERIFIED), set `self.requires_hitl = True` and block on `await workflow.wait_condition(...)`. The existing HITL block at Stage 3b can absorb this, so the simpler approach is to set `audit["requires_hitl"] = True` when eway is UNVERIFIED, letting the existing `is_fraudulent` gate catch it.
       Files: `worker/src/agents/logistics_agent.py`, `worker/src/flows/workflows.py`
       Verify: `cd worker && python -c "from agents.logistics_agent import verify_eway_bill; r = verify_eway_bill('EWB-TEST'); assert r['status'] == 'UNVERIFIED'; print('ok')"` — prints `ok`.

---

## Summary of all files to create or modify

### New files
| File | Task |
|------|------|
| `worker/src/services/hash_chain.py` | 4 |
| `worker/src/agents/privacy.py` | 7 |
| `worker/src/reporting/__init__.py` | 6 |
| `worker/src/reporting/form1_schema.py` | 6 |
| `worker/src/reporting/pdf_generator.py` | 6 |
| `worker/tests/__init__.py` | 7 |
| `worker/tests/test_privacy.py` | 7 |
| `packages/synthetiq-shared/alembic/versions/f1a2b3c4d5e6_phase5_bids_corridor.py` | 1 |
| `packages/synthetiq-shared/alembic/versions/g2b3c4d5e6f7_phase5_escrow_split.py` | 5 |

### Modified files
| File | Tasks |
|------|-------|
| `worker/src/activities/agent_activities.py` | 2, 3, 5, 6 |
| `worker/src/flows/workflows.py` | 3, 5, 9 |
| `worker/src/agents/treasury_agent.py` | 7 |
| `worker/src/agents/legal_agent.py` | 7 |
| `worker/src/agents/logistics_agent.py` | 7, 9 |
| `worker/src/agents/auditor_agent.py` | 7 |
| `worker/src/agents/regulatory_agent.py` | 7 |
| `worker/src/agents/brand_liability_agent.py` | 7 |
| `worker/src/agents/erp_agent.py` | 7 |
| `worker/src/routes/auctions.py` (api) | 1 |
| `mcp/src/tools/gst_tool.py` | 8 |
| `mcp/src/tools/cpcb_tool.py` | 8 |
| `packages/synthetiq-shared/synthetiq_shared/models/organization.py` | 5 |
| `worker/pyproject.toml` | 6 |

### Alembic chain
```
bb863566fc2f (initial)
  → a3f9c8e1d42b (phase1_tenancy)
    → c1d2e3f4a5b6 (phase2_runs)
      → d4e5f6a7b8c9 (phase3_dynamic_config)
        → e7f8a9b0c1d2 (add_ingestion_runs)  ← current HEAD
          → f1a2b3c4d5e6 (phase5_bids_corridor)         [Task 1]
            → g2b3c4d5e6f7 (phase5_escrow_split)        [Task 5]
```
