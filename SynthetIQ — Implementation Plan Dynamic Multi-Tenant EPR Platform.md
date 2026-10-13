# SynthetIQ — Implementation Plan: Dynamic Multi-Tenant EPR Platform

Oct 11, 2026 · @TechFusion

This plan takes SynthetIQ from today's partly simulated build to a platform where any organisation can register, add users, load its own data through connectors, run the multi-agent workflows and get verified outputs, with no business literals in code. It runs in seven phases, ordered so that security and tenancy come before anything that depends on them. Total effort is roughly 48 engineer-days (about 5 calendar weeks for two engineers), an estimate to be re-checked after Phase 0.

## Phase overview

| Phase | Outcome | Est. effort | Exit gate |
| --- | --- | --- | --- |
| 0. Stop-ship security | No auth bypass, no cross-tenant admin, no unauthenticated config, no forged reports | 3 days | Negative auth tests pass on every route |
| 1. Tenancy | `org_id` on every table, RLS, org types, invites, memberships | 6 days | Two-org isolation suite passes |
| 2. Single execution path | API starts Temporal runs only; activities write all results; fail-closed gates | 8 days | Worker kill mid-run resumes; Temporal down returns 503 |
| 3. Dynamic configuration | Regulatory pack, org policy, plant calibration; worker reads agent config | 5 days | Changing a pack version changes new runs, old runs reproduce |
| 4. Data onboarding | Canonical schemas, mapping, upload, secrets, preflight, Pub/Sub ingest | 8 days | A new org with different column names runs end to end |
| 5. Marketplace, physics, integrations | Two-sided auction, physics v2, real or honestly unverified GST/CPCB/ERP/DSC | 12 days | Scripted two-org scenario passes |
| 6. HITL console and hardening | Dual-pane console, observability, cost caps, load and chaos tests | 6 days | Definition of done below met |

Phases 3 and 4 can run in parallel once Phase 2 lands. Phase 6 work (tests, CI gates) starts in Phase 0 and continues throughout.

## Working rules for every phase

- **Fail closed.** A missing or invalid gate field stops the run or routes it to HITL. It never defaults to a pass value.
- **No literals.** No org, plant, recycler, GSTIN, rate, threshold or fiscal-year value in code outside tests and fixtures. A CI scan enforces it from Phase 1.
- **One writer.** Workflow activities write business records. The API reads them.
- **Tenancy test per PR.** Any new route or table ships with a cross-tenant denial test.
- **Simulated means labelled.** Anything produced by `simulator/` or a mock carries a visible `SIMULATED` flag in run records and the UI.

## Phase 0: Stop-ship security (3 days)

1. **Auth bypasses.** In `api/src/services/auth_service.py`, delete the `dev-` prefix and fixed-token acceptance. Allow dev mode only when `ENV=local`, and refuse to start if `ENV` is production and `AUTH_DEV_MODE` is set.
2. **Login.** In `api/src/routes/auth.py`, remove the `Password123!` fallback. Move to argon2id hashing, add login rate limiting, and drop the default password in `CreateUserRequest` (replaced by invites in Phase 1).
3. **Tokens.** In `jwt_utils.py`, fail startup if `JWT_SECRET_KEY` is missing, align `.env.example` and the Helm secret, cut token life to 15–60 minutes with refresh, and re-check user status and role per request.
4. **Cross-tenant admin.** Add a `platform_admin` role. Replace every `_verify_org_access` / `_verify_tenant_access` copy with one `assert_same_org` helper that has no admin exemption.
5. **Config routes.** Require auth on `GET /config` and `POST /config/test-gemini`, remove the key mask, and make runtime config read-only for tenants.
6. **Forgery paths.** Remove the fabricated record in `/audit/report/{id}/pdf` (return 404). Remove hardcoded `VALID_DIGITAL_SIGNATURE` and `hash_chain_verified` in the JSON report. Make `/settlement/form1/dispatch` return `501 NOT_INTEGRATED` until Phase 5.
7. **Seeds and CORS.** Delete seed-on-first-read in auctions, audit and settlement. Replace CORS `*` with an allowlist.
8. **Dashboard.** In `SessionContext.tsx`, remove the auto dev session and the fake-admin login fallback. Remove the hardcoded bearer in `api.ts` and send the real token on every call.
9. **Connectors, interim.** Disable path-based CSV and restrict REST `base_url` to an allowlist until Phase 4.
10. **Secrets.** Rotate the JWT secret, Gemini key and any credentials that were ever committed. Confirm `.env` and `certs/` are gitignored.

**Exit gate:** a `dev-x` token returns 401; `Password123!` returns 401; an org A admin gets 403 on every org B route (parametrised over all routers); unknown audit ID returns 404.

## Phase 1: Tenancy (6 days)

1. **Schema.** Add `org_id` NOT NULL and indexed to `AuditRecord`, `AuctionRecord`, `BidRecord`, `EscrowPORecord` and `Form1Record`. Create a single baseline Alembic migration for all 11 tables and stop calling `create_all` at API startup.
2. **One tenant concept.** Retire the in-memory `/companies` route and `OnboardedCompany`. Keep `Organization`, and add a `legal_entities` child table (GSTIN, name) for orgs with several entities.
3. **Org types.** Add `org_type`: `brand_owner`, `recycler`, `external_auditor`, `platform`. Registration collects the type and shows type-specific fields.
4. **Memberships and roles.** Replace the single `User.org_id` with a `memberships` table (user, org, role), so one auditor can serve several orgs. Store roles and permission sets as rows, with today's four roles as seeded defaults.
5. **Tenant context.** Add a `TenantCtx` FastAPI dependency derived from the verified token and active membership. Use it in a scoped repository layer, and enforce Postgres RLS via `SET LOCAL app.org_id`.
6. **Invites and verification.** Add email verification on registration, invite tokens with set-password, forced reset, and an optional approval toggle for new tenants. Validate GSTIN format.
7. **Runs from the DB.** Delete the `_RUNS_DB`, `_AUDITS_DB`, `_ESCROW_POS`, `_FORM1_DB`, `_AUCTIONS_CACHE` and `_COMPANIES_DB` in-memory stores.

**Exit gate:** a two-org isolation suite (list, get, create, update, delete, signal) passes for every route; a query without tenant context returns zero rows under RLS.

## Phase 2: Single execution path (8 days)

1. **API contract.** `POST /runs {type, params}` creates a `WorkflowRun`, starts Temporal with workflow ID `{org_id}/{type}/{run_id}`, sets search attributes `OrgId` and `RunId`, and returns 202. If Temporal is unreachable, return 503 and write nothing.
2. **Delete the inline simulation.** Remove the stage code in `orchestrator.py`, the inline physics in `audit.py` `/trigger`, the fabricated outputs in `settlement.py`, and the duplicated logic in `agent_config.py` `/test` (replace with a dry-run workflow).
3. **Thread tenant context.** Every workflow and activity takes `RunInput {org_id, run_id, params_ref, regulatory_pack_version}`. Remove the hardcoded recycler, plant, e-way bill, telemetry, `simulate_spoof`, 12.0 rate and 1.0 conversion factor from `workflows.py`. Derive each stage's inputs from the previous stage's output.
4. **Fail-closed contracts.** Give every activity a strict Pydantic output model with no defaults on gate fields. A validation error raises a non-retryable `ApplicationError` that either fails the run or routes to HITL. Add explicit `RetryPolicy` and timeouts, and fix the missing `hashlib` import.
5. **Deterministic core.** Liability math, auction clearing, physics, PO creation, Form-1 assembly, signing and dispatch become plain Python activities. LLMs are limited to document extraction, regulatory-text drafting and narrative. Never trust an LLM `verdict` field.
6. **Real approvals.** Add real signals for settlement approval (or remove `HumanApprovalSignal`), with maker-checker. Keep the existing `wait_condition` HITL pause and add a review timeout and escalation.
7. **Schedules.** Replace APScheduler and the in-memory dict with Temporal Schedules created per org. Schedules run as the org's service identity and honour `workflow_type`.
8. **Progress.** The UI reads progress from the run record and Temporal queries, not from route-level pushes.

**Exit gate:** killing the worker mid-run resumes from the last activity; with Temporal down, run creation returns 503 and writes no records; a literals scan of `worker/src/flows` is clean; an end-to-end run on a test org touches only the workflow path.

## Phase 3: Dynamic configuration (5 days)

1. **Regulatory pack.** Table `regulatory_packs`: version, jurisdiction, effective dates, status, approver, and a Pydantic-validated payload (category targets, conversion factors by chemistry, base rate, price corridor, escrow split, default delta threshold, fiscal year start, amortisation rule). The Regulatory agent drafts a pack from gazette text; a human approves it. Each run pins one version.
2. **Org policy.** Table `org_policies`: approval thresholds, categories in scope, escrow terms within platform bounds, signatory, timezone. Writes are validated against bounds, so a tenant cannot set a torque threshold to zero.
3. **Plant calibration.** Table `plant_calibrations`: plant, material grade, SEC baseline and variance, motor efficiency, validity window, source batches. The tolerance band is derived from this variance.
4. **Agent config consumed.** Replace module-level agent singletons with a per-run agent factory that reads `AgentConfiguration` (model from an allowlist, temperature, versioned prompt). Prompts can shape wording but cannot change gate logic, which lives in code.
5. **No demo defaults.** Remove `DEFAULT_AGENTS_CONFIG` demo values (3600 t debt, 12.0 rate, signatory). Introduce an `obligation_ledger` table for historic debt, loaded through onboarding or the ERP connector.
6. **Single source.** Delete the three conversion-factor copies, three SEC copies and scattered thresholds; read them from the pack and calibration tables.

**Exit gate:** publishing a new pack version changes new runs while an old run reproduces exactly; the literals scan finds no statutory number outside tests and fixtures.

## Phase 4: Data onboarding (8 days)

1. **Canonical schemas.** Pydantic models for `SalesLine`, `TelemetryFrame`, `WeighbridgeSlip`, `Invoice` and `PurchaseOrder`.
2. **Mapping layer.** `DataSource.mapping` holds source column to canonical field, transform and unit. A UI mapper shows a preview and a validation report. Bad rows go to quarantine with reasons.
3. **Ingestion runs.** Table `ingestion_runs`: rows read, accepted, quarantined, source hash, schema fingerprint. Every liability result records the ingestion run it used.
4. **Connector hardening.** Fix the Postgres interval binding, quote and allowlist identifiers, require read-only credentials, use tenant-owned BigQuery service accounts, and add SSRF protection to REST (resolve and block private ranges).
5. **Uploads and secrets.** Replace file paths with uploads to a per-tenant object-store prefix (size and type checks). Store only a `secret_ref` in `connection_config`, with the secret in Secret Manager. Generate the UI config form from each connector's JSON schema so keys match.
6. **No fallbacks.** `get_connector_for_org` raises `DataSourceNotConfigured`. Delete the synthetic sales generator and the seed-CSV fallback.
7. **Server-side scope.** Connector queries receive legal-entity and plant scope from the org's bindings, not from request parameters.
8. **Preflight.** `GET /runs/preflight` lists missing sources, mappings, regulatory pack, plant calibrations and ledger entries, with actionable messages. Runs refuse to start until it is clean.
9. **Telemetry ingest (AC 1.1).** A Pub/Sub consumer per plant writes frames to a per-plant hash chain and aggregates measured kWh per audited window.

**Exit gate:** a new org uploads a CSV with different column names, maps it, passes preflight and runs liability; a wrong schema or missing source blocks the run with a clear error.

## Phase 5: Marketplace, physics and integrations (12 days)

1. **Recycler side.** Recycler orgs register plants with CTO records, calibrations and SCADA credentials. Add a bid API for the recycler role, an order book, and deterministic uniform-price clearing inside the corridor, writing `AuctionRecord` and `BidRecord`. Keep the Recycler Bidder agent only as a labelled simulator.
2. **Physics v2** (in `packages/telemetry`). Use measured E\_total over the batch window, a calibrated band, a 3σ `DATA_INTEGRITY_TAMPER` rule (AC 1.2) and the Δmass check. Add unit and property tests. Fix the Nimble call to be async with typed fallback to physics, and make verdicts rule-based with models advisory. Retrain or drop the synthetic-trained IsolationForest.
3. **Proof chain.** Persist a per-plant, append-only hash chain (or Merkle root per batch) and write the head hash to a Temporal search attribute as an index only.
4. **Logistics.** Verify e-way bills through a real GSP/NIC integration if access is available; otherwise an explicit `UNVERIFIED` state with manual evidence upload. Extract weighbridge slips and invoices with Gemini into strict schemas, with confidence below 80% routed to HITL (AC 3.1).
5. **Settlement.** An escrow state machine and ledger: 80% on delivery and initial audit, 20% held until provenance passes. Use an ERP connector (SAP OData or Oracle); any mock is flagged `SIMULATED`.
6. **Form-1 pipeline.** A Pydantic Form-1 schema (AC 4.1); generation in `packages/reporting` on ReportLab or WeasyPrint; PDF signing with the org's DSC from KMS via a library such as pyHanko; provenance linking to telemetry runs and invoice IDs (AC 4.2). Dispatch shows `READY_FOR_MANUAL_UPLOAD` unless a real portal acknowledgement is ingested. `CPCB_ACCEPTED` is never generated.
7. **Privacy in the data path.** Deterministic regex and pseudonymisation of IDs before any model call on extraction inputs. Replace per-string LLM scrubbing of tables. Add a golden test proving no raw GSTIN reaches the model.
8. **Retire fake verifiers.** Replace the hash-seeded GST and CPCB MCP tools with real calls or the `UNVERIFIED` state.

**Exit gate:** the scripted two-org scenario in the definition of done passes, including a tampered-telemetry case routed to HITL.

## Phase 6: HITL console and hardening (6 days)

1. **Dual-pane console (AC 5.2).** Telemetry anomalies beside the agent's reasoning, with run history and evidence links.
2. **Resolution rules (AC 5.3).** Mandatory validated reason codes, bounded `override_tons`, four-eyes (resolver differs from initiator), and the signal checks the workflow's org.
3. **Observability.** OpenTelemetry traces and Prometheus metrics labelled with `org_id`, per-tenant LLM cost caps and alerts.
4. **Tests.** Load test the worker, chaos test (kill worker, drop Temporal), and a property test of the physics module.
5. **Docs and CI.** Rewrite the README and architecture notes to match the code, archive `REFACTORING_SUMMARY.md` and `ANALYSIS_FINDINGS.md`, and align Helm secrets and `.env.example`. CI gates: literals scan, isolation suite, mypy strict, ruff.

## Definition of done

A scripted end-to-end test, using only the public API:

1. Register a brand org and a recycler org; verify emails; invite one user into each.
2. Upload brand sales data with non-default column names, map it, and pass preflight.
3. Register a recycler plant with a calibration; stream telemetry through Pub/Sub.
4. Run the full workflow: liability, auction, audit, escrow, Form-1.
5. Inject tampered telemetry in a second run; it halts in HITL and a different user resolves it.
6. Confirm a third org sees none of this data through any route.
7. Kill the worker mid-run; the run completes after restart.
8. The literals scan and isolation suite pass in CI.

## Open decisions

| Decision | Options | Recommendation |
| --- | --- | --- |
| Identity provider | Firebase Auth with custom claims, or the local JWT | Pick one. Firebase is already integrated, so use it with memberships stored in the DB. |
| Company vs org | Keep both, or org plus `legal_entities` | Org plus `legal_entities`. |
| Isolation mechanism | App-level scoping only, or plus Postgres RLS | Both; RLS as the backstop. |
| Delta threshold | Fixed 2%, or calibrated band | Calibrated per-plant band; the 2% stays as the platform default ceiling. |
| Regulatory content owner | Platform team, or per-org uploads | Platform-owned packs with maker-checker approval. Verify EPR target percentages against current CPCB guidelines, since the code applies none. |
| CPCB and GST access | Direct API, via a provider, or manual upload | Unknown; confirm access early. Build the `UNVERIFIED` and manual-upload states regardless. |

## Assumptions

Estimates are rough working days for a team of two, not measured. They assume Python 3.13, Temporal, Postgres and the current ADK agents are kept. No deadline was given, so phases are ordered by dependency, not by date. This plan is based on a static read of the repository; findings are in the companion audit doc.
