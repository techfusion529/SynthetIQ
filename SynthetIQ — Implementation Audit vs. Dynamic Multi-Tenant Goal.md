# SynthetIQ — Implementation Audit vs. Dynamic Multi-Tenant Goal

*Static review of the local repository, October 11, 2026. Nothing was executed.*

## Bottom line

The skeleton is good, but the running product is not yet a dynamic multi-tenant system, and in several places it fabricates compliance outputs. Real foundations exist: Temporal workflows with a working HITL signal, Google ADK agents, tenant tables, a connector abstraction, RBAC scaffolding, and a physics-check idea. But the path the dashboard actually exercises is a hardcoded simulation, and the self-service flow has security holes that need closing first. `REFACTORING_SUMMARY.md` ("production-ready") and `ANALYSIS_FINDINGS.md` ("no LLM integration") are both inaccurate against the current code, so neither should be used as a status reference.

## The central problem: two pipelines

`POST /compliance/run-e2e` (`api/src/routes/orchestrator.py`) starts the Temporal workflow and never awaits it. It then runs about 300 lines of inline code with `volume_tons * 4.5` for liability, a fixed `7.80` clearing price, `RECYC-DELHI-01` as the winner, a generated `ACK-CPCB-…` number, and `CPCB_ACCEPTED`. That inline result is what the UI shows and what gets written to `AuditRecord`, `EscrowPORecord` and `Form1Record`. If Temporal is down, `start_workflow` returns `DISPATCH_FALLBACK` and the run still reports `SUCCESS_FULLY_COMPLIANT`. `/audit/trigger`, `/settlement/*` and `/agents/*/test` each contain their own copies of the logic.

## The target journey, step by step

| Step | Status | Why |
| --- | --- | --- |
| Register org | Works, unsafe | No org type (brand vs recycler), no verification. Registration copies demo-org values into every tenant (`historical_debt_default_tons: 3600`, base rate 12.0). |
| Assign users | CRUD only | Four roles fixed in code. The admin sets the password (default `Password123!`). No invite or reset flow. Email is globally unique, so one auditor can't serve two orgs. |
| Load data via connectors | Framework only | No canonical schema or column mapping. UI config templates use different keys than the connectors read (`database` vs `dbname`, `auth_token` vs `token`, `table_name` vs `sales_table`). The Postgres telemetry SQL is malformed. CSV is path-based, with no upload. |
| Run agents | Not what executes | The Temporal path has no `org_id`. It hardcodes the recycler, plant, e-way bill and telemetry. The per-org `AgentConfiguration` is never read by the worker (no code path found). |
| End goal: verified, signed Form-1 and settlement | Not achieved | The "DSC signature" is a SHA-256 string, the CPCB ack is a UUID, and the ERP step is handed `human_approved=True` regardless of the audit result. |

## Stop-ship security findings

| Finding | Where | Effect |
| --- | --- | --- |
| Any token starting `dev-` is accepted as admin of `ORG-DEV-001`, even with `AUTH_DEV_MODE=false` | `auth_service.py` | The dashboard auto-uses `dev-synthetiq-admin-token` when there's no session, and falls back to a fake admin session on any login error. |
| `Password123!` logs into any existing account | `routes/auth.py` login | The failed-password check is skipped when the password equals that string. |
| Any org's admin is a platform admin | `_verify_org_access` and equivalents skip the org check for `role == "admin"` | Open `/register` makes everyone a superuser: list all orgs, create admins in other orgs, delete other tenants' data sources. |
| Business data isn't tenant-scoped | `AuditRecord` has no org column; list endpoints have no filter; HITL `resolve` and run detail check no ownership | Every user sees every tenant's audits, POs, Form-1s and auctions. |
| JWT secret default in source | `jwt_utils.py` | `.env.example` sets `JWT_SECRET` but the code reads `JWT_SECRET_KEY`, so following the template uses the public default. Tokens last 7 days with role and org baked in. Passwords are SHA-256 with a static salt. |
| Unauthenticated `GET /config` and `POST /config/test-gemini` | `routes/config.py` | Leaks the first 6 and last 4 characters of the API key. One org's admin can change global thresholds and the key for all tenants. |
| Connector abuse | `data_connector.py` | CSV path read plus preview endpoint gives arbitrary file read. `base_url` allows SSRF. BigQuery runs on the platform's credentials. Table names are interpolated into SQL. Credentials are stored as plaintext JSON, though the UI says "encrypted at rest". |
| Forgery paths | `audit.py`, `settlement.py` | `/audit/report/{any-id}/pdf` fabricates an APPROVED record for unknown IDs. `/json` hardcodes `VALID_DIGITAL_SIGNATURE` and `hash_chain_verified: true`. `/form1/dispatch` emits `CPCB_ACCEPTED` without calling any portal. |
| Seed-on-first-read, CORS `*` | auctions, audit, settlement | Fictional recyclers and audits are inserted into whatever DB the route first touches. |

## Hardcoding inventory

| Kind | Examples |
| --- | --- |
| Identities | `RECYC-DELHI-01`, `PLANT-OKHLA-2`, `EWB-2026-99210`, `COMP-IN-001`, `ORG-DEV-001`. The Legal agent signs every org's Form-1 with GSTIN `27AAACH1234F1Z5`. |
| Statutory numbers | Conversion-factor table copied in 3 places, SEC table in 3, torque/PF thresholds in at least 6. The 12.0 base rate, 3.6 floor, 80/20 split, 2% delta, 0.92 η and `FY2026-27` appear throughout. |
| Business data | Historic debt 3600/2500 for every company. The agent-config "test" endpoint returns fixed liability and category totals. |
| Invented data on missing input | `query_erp_sales` generates sales from a hash of `company_id`. `fetch_recycler_bids` invents bids. `get_connector_for_org` silently falls back to the seed CSV when no source is registered. |
| "Verification" tools | The GST and CPCB MCP tools derive pseudo-random output from a hash of the input and always return `VALID`/`ACTIVE`, with the hash labelled `cryptographic_proof`. The Logistics agent's e-way tool returns a constant `VERIFIED`. |
| Test hooks in production paths | `simulate_spoof` workflow parameter, live `/audit/scada/live?mode=SPOOF` route, startup schedule seeded for `ORG-DEV-001`. |

## Where it departs from the spec

- **Probabilistic/deterministic separation (§3).** An LLM tool-calls PO creation, DSC signing and CPCB dispatch. Liability sums are also done by the LLM. The spec says these should be deterministic.
- **The mass-balance check is circular.** Without a measured `energy_total_kwh`, E is derived from the claimed mass. By hand calculation the default "genuine" telemetry gives Δ≈23% on the Temporal path and ≈48% on the API fallback numbers, so the happy path would route to HITL. A global per-category SEC is also unrealistic; it needs a per-plant baseline and measured kWh over the audited window.
- **Fail-open gates.** Missing `delta_mass` defaults to 0.0, `physical_melt_verified` defaults to `True`, the fallback price is 7.8, and the LLM's JSON verdict is trusted if it contains `verdict`.
- **No sell side.** No recycler org type, bid-submission route or CTO check; the Recycler Bidder agent doesn't exist; the workflow never updates the `AuctionRecord`.
- **Privacy layer is out of the data path.** Scrubbing is applied to a `sales_data` argument that is never passed, while agent tools feed raw records to Gemini. It is also off by default in compose.
- **Hash chain (AC 1.3).** A process-global in-memory singleton shared by all tenants, chaining verdicts rather than raw frames. No Pub/Sub ingestion path (AC 1.1), no 3σ baseline (AC 1.2), and no document-upload/extraction path (AC 3.1) were found.

## Bugs found along the way

- `agent_activities.py` uses `hashlib` without importing it; with no explicit retry policy, that PDF activity retries indefinitely.
- Nimble is called with `run_until_complete` inside a running loop; the broad `except` swallows the error and it silently falls back to Jev (compose also never pulls the model).
- `/settlement/approve` signals `HumanApprovalSignal`, which no workflow defines, yet still marks the PO `advance_released`.
- The API's audit ID and the workflow's audit ID differ.
- Tests assert hardcoded values (`net_liability_tons == 17200.0`, which the route no longer returns) and rely on the dev bypass.
- The Alembic migration covers 6 of 11 tables. The scheduler is in-memory, ignores `workflow_type`, calls `run-e2e` with `Bearer scheduler-internal`, and runs once per API replica.

## What "fully dynamic" requires

1. **Tenant context everywhere.** `org_id` NOT NULL on every table with Postgres RLS or a scoped repository; a separate `platform_admin` role; workflow IDs and search attributes prefixed by org; `org_id` passed into every workflow and activity.
2. **Three config layers.** A versioned, effective-dated regulatory pack (conversion factors, targets, base rate, corridor, escrow split), platform-owned and approved via maker-checker, with each workflow pinning a version. Org policy within validated bounds (roles, approval thresholds, schedules, signatory). Per-plant calibration (SEC, η, baseline mean and σ) feeding the 3σ rule.
3. **Data onboarding.** Canonical schemas (sales line, telemetry frame, weighbridge slip, PO); a column-mapping and unit-conversion layer; Pydantic validation with quarantine; per-tenant upload storage; secrets in Secret Manager; an egress allowlist; and a data-readiness check that fails with an actionable error instead of inventing data.
4. **Temporal-first execution.** The API only starts and queries workflows. Liability, clearing, physics, escrow and Form-1 become deterministic activities that write their own results. LLMs are limited to extraction, rule-change summaries and narrative, with low confidence routed to HITL. Everything fails closed, and Temporal Schedules replace APScheduler.
5. **Real or honestly unverified integrations.** Real GST, CPCB, ERP and DSC (KMS/HSM) integrations, or an explicit "unverified, manual evidence" state. Never a generated ack.
6. **Tests that enforce it.** A two-org isolation suite, a CI scan for literal org/plant/recycler IDs, a physics property test, and an e2e run where two orgs are onboarded purely through the API.

## Suggested order of work

1. **Days:** remove the dev bypasses, password fallback, default secret, admin cross-tenant bypass, open config endpoints and PDF fallback. Rotate secrets.
2. **Tenancy:** add `org_id` and migrations, remove the in-memory stores, seeds and `companies` route, add `platform_admin`.
3. **One execution path:** delete the inline simulation, wire org context through workflows, persist results from activities with fail-closed gates.
4. **Dynamic config:** build the regulatory pack, org policy and plant calibration, and make the worker read them.
5. **Data onboarding:** mapping, upload, secrets and validation.
6. **Marketplace and integrations:** recycler orgs and bids, real GST/CPCB/ERP/DSC, physics redo, Pub/Sub ingest, and the HITL console.

## What was not checked

`.env` and `certs/` were not opened (confirm `private.key` and `.env` are gitignored, and rotate them if ever committed). Also skipped: `ai_service.py`, `gemma_privacy.py`, the PDF generators, simulator/mocks internals, Helm/CI, and most dashboard pages including the audit console. The Δ figures are hand-computed and should be confirmed with a unit test.
