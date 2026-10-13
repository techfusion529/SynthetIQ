# SynthetIQ — Gap Analysis and Gap Register

Oct 13, 2026 · @TechFusion

This register compares the current repository with the goal: an organisation registers, assigns users, loads its own data through connectors, runs the multi-agent system and gets verified output, with nothing hardcoded. It also checks the five features in the technical specification. It is a static read of the code; nothing was executed. It finds 82 gaps: 11 blockers, 17 critical, 34 high, 19 medium and 1 low.

## Where it stands

The perimeter work is real: the auth bypasses are gone, there is a Temporal-first `/runs` API with preflight, tenancy columns exist, and the stubs for GST and CPCB are now honest. The core is not done. By this reading no run can start (preflight fails), and past that point the pipeline fails closed or fills in defaults at most stages. Results are not written back, so the dashboards stay empty. Several security gaps would let one tenant reach another.

**Severity legend.** Blocker: a run cannot start or finish, or a core user step cannot be done. Critical: integrity, legal or cross-tenant security failure. High: major feature gap or likely defect. Med and Low: quality and hygiene.

## Summary by domain

| Domain | Gaps | Blocker | Critical | High | Med/Low |
| --- | --- | --- | --- | --- | --- |
| Run lifecycle (RUN) | 11 | 4 | 1 | 4 | 2 |
| Data onboarding (DATA) | 10 | 3 | 3 | 4 | 0 |
| Agents and domain logic (AGT) | 15 | 1 | 6 | 6 | 2 |
| Dynamic configuration (CFG) | 6 | 1 | 0 | 4 | 1 |
| Persistence (PER) | 5 | 0 | 1 | 2 | 2 |
| Tenancy and identity (IAM) | 9 | 0 | 3 | 4 | 2 |
| Security and infrastructure (SEC) | 8 | 0 | 2 | 1 | 5 |
| UI (UI) | 8 | 1 | 0 | 5 | 2 |
| Marketplace (MKT) | 5 | 1 | 0 | 3 | 1 |
| Quality and delivery (QA) | 5 | 0 | 1 | 1 | 3 |
| **Total** | **82** | **11** | **17** | **34** | **20** |

## Specification acceptance criteria

| AC | Requirement (short) | Status | Why | Gaps |
| --- | --- | --- | --- | --- |
| 1.1 | Pub/Sub telemetry ingest under 500 ms | Not met | No consumer; telemetry hardcoded in the workflow | DATA-09 |
| 1.2 | 3σ tamper flag vs baseline | Partial | 3σ on aggregate SEC only; no per-frame check or `DATA_INTEGRITY_TAMPER` | AGT-03 |
| 1.3 | SHA-256 hash chain over raw frames | Not met | New in-memory chain per activity; not persisted | AGT-06 |
| 2.1 | Durable workflows with exponential retry | Partial | Durable, but flat retry policy and no non-retryable classes | RUN-10 |
| 2.2 | Resume from last checkpoint | Unverified | Temporal provides it; no crash test exists | QA-01 |
| 2.3 | Queryable lifecycle states | Partial | Workflow queries exist; no API endpoint; state names differ | RUN-04 |
| 3.1 | Multimodal extraction, 95% or better | Not met | No extraction pipeline | DATA-10 |
| 3.2 | Claimed tonnage vs machine runtime and SEC | Not met | Energy is derived from the claim unless real frames arrive | AGT-03 |
| 3.3 | Discrepancy over 2% gives a dossier | Not met | Delta never reaches the workflow; no dossier | AGT-04 |
| 4.1 | Reconciled data mapped to Form-1 schema | Partial | `Form1Data` exists but is fed defaults | AGT-10 |
| 4.2 | Provenance from report to telemetry and invoices | Not met | No provenance links stored | AGT-10, PER-02 |
| 4.3 | Signed PDF and JSON within 5 s | Not met | Unsigned PDF in worker `/tmp`; no JSON export | AGT-09, AGT-10 |
| 5.1 | Halt when confidence under 80% or risk over 0.65 | Partial | Flags are dropped; thresholds not wired | AGT-04 |
| 5.2 | Dual-pane inspection UI | Not met | Console is always empty | UI-04 |
| 5.3 | Authenticated resume with reason codes | Partial | Signal and codes exist; approve-only and spoofable resolver | UI-04 |

## Gap register

### 1. Run lifecycle (RUN)

| ID | Gap | Where | Sev |
| --- | --- | --- | --- |
| RUN-01 | Preflight can never pass: it filters `DataSource.mapping`, but the ORM lacks `mapping`, `secret_ref` and `AuditRecord.ingestion_run_id` that migration `e7f8…` adds. Every `POST /runs` returns 422. | `runs.py`, `models/organization.py` | Blocker |
| RUN-02 | UI posts `{type, params}` but the API reads fields at top level, so runs start with 0 tons, empty category and empty fiscal year. | `api.ts`, `runs.py` | Blocker |
| RUN-03 | Activity result models require keys the agents never emit (`gross_liability_tons`, `category`, `winner_org_id`, `total_volume_tons`, `po_id`, `escrow_amount`, `audit_verdict`, `delta_percent`, `energy_total_kwh`). Stages fail closed. | `agent_activities.py`, agent prompts | Blocker |
| RUN-04 | Nothing writes run status, result or `hitl_required` back to `WorkflowRun`. | `runs.py`, `worker/main.py` | Blocker |
| RUN-05 | Stages are not chained: `recycler_id`, `plant_id`, `eway_bill_ref`, `volume_tons` and `company_id` are client inputs. Liability does not set volume; the auction winner is unused. | `workflows.py`, `runs.py` | High |
| RUN-06 | Temporal-down branch is dead (`TEMPORAL_UNAVAILABLE` returned, `DISPATCH_FALLBACK` checked). Run stays RUNNING. DB persist failures only warn. | `temporal_service.py`, `runs.py` | High |
| RUN-07 | Pack version defaults to the literal `"default"`, which must match an active pack exactly. | `runs.py`, `config_activities.py` | High |
| RUN-08 | Master workflow returns a fixed `SUCCESS_FULLY_COMPLIANT` and says Form-1 was accepted by CPCB, whatever happened. | `workflows.py` | Critical |
| RUN-09 | Standalone W1–W4 entry points keep hardcoded defaults (`COMP-IN-001`, rate 12.0, torque 45, `human_approved=True`). `/audit/trigger` passes arguments that do not match the W3 signature. | `liability.py`, `auctions.py`, `audit.py` | High |
| RUN-10 | One flat `RetryPolicy(3)` for every activity; no non-retryable validation errors; task queue name hardcoded. | `workflows.py` | Med |
| RUN-11 | `simulate_spoof` test hook is a production input, with hardcoded spoof telemetry in the workflow. | `runs.py`, `workflows.py` | Med |

### 2. Data onboarding (DATA)

| ID | Gap | Where | Sev |
| --- | --- | --- | --- |
| DATA-01 | CSV upload returns a 5-row preview and stores nothing; the connector needs a relative path on the worker's disk. No tenant can load a file. | `datasources.py`, `data_connector.py` | Blocker |
| DATA-02 | Column mapping is not persisted (see RUN-01) and is never applied at read time; only `/validate` uses it. | `datasources.py`, connectors | Blocker |
| DATA-03 | The liability agent queries MCP first, and the MCP BigQuery tool synthesizes hash-seeded sales when results are empty or on error. This can mask the tenant's own connector. | `brand_liability_agent.py`, `mcp/tools/bigquery_tool.py` | Critical |
| DATA-04 | Tenant key is the client-supplied `company_id`; `get_connector_for_org` falls back to the platform BigQuery project. | `data_connector.py`, `runs.py` | Critical |
| DATA-05 | Hardening (SSRF guard, `service_account_ref`) exists only in the shim's fallback classes. Real connectors skip the allowlist when empty, use platform ADC or a config `credentials_path`, and interpolate identifiers. | `data_connector_shim.py`, `data_connector.py` | Critical |
| DATA-06 | Postgres connector: `INTERVAL ':hours hours'` bind bug; audit write stores `str(dict)`. | `data_connector.py` | High |
| DATA-07 | Credentials stored as plaintext JSON; `secret_ref` unused; masking is exact-key only. | `organizations.py` | High |
| DATA-08 | No canonical normalisation, validation or quarantine in the run path; `IngestionRun` has no writer; no lineage on results. | worker, `ingestion_run.py` | High |
| DATA-09 | Telemetry is hardcoded in the workflow and in `fetch_scada_telemetry`; no Pub/Sub consumer; `query_telemetry` unused by runs; preview hardcodes `PLANT-OKHLA-2`. | `workflows.py`, `auditor_agent.py` | Blocker |
| DATA-10 | No document ingestion for weighbridge slips, invoices or e-way bills; schemas exist, pipeline does not. | `schemas/logistics.py` | High |

### 3. Agents and domain logic (AGT)

| ID | Gap | Where | Sev |
| --- | --- | --- | --- |
| AGT-01 | Liability is computed by the LLM from raw rows. Historic debt is fixed at 3600 and 2500. The loaded ledger and the pack's targets and amortisation are unused. | `brand_liability_agent.py` | Critical |
| AGT-02 | Auction cannot clear: no `auction_id` is passed, `fetch_recycler_bids` returns empty, DB clearing sorts high to low (confirm intent), names the marginal bidder as sole winner and swallows its own error. | `agent_activities.py`, `treasury_agent.py` | Blocker |
| AGT-03 | Physics: energy is derived from claimed mass unless real frames arrive; `calibrations[0]` ignores plant and grade; delta threshold units (percent vs fraction) are ambiguous. | `workflows.py`, `agent_activities.py` | Critical |
| AGT-04 | Deterministic verdict is ignored. `AuditResult` drops `delta_mass`, `is_spoofed` and `requires_hitl`, which the workflow still reads; `verdict == "HITL"` is never consulted. | `agent_activities.py`, `workflows.py` | Critical |
| AGT-05 | PO gate bypass: `audit_verdict` defaults to `"APPROVED"`, `logistics_verdict="APPROVE"` is hardcoded, and the e-way result does not gate. | `workflows.py`, `agent_activities.py` | Critical |
| AGT-06 | Hash chain restarts from GENESIS per activity, is not persisted and covers one synthetic frame, not raw frames. | `hash_chain.py` | High |
| AGT-07 | Logistics: the QR ledger tool fabricates provenance; `qr_code_id` is never passed. | `logistics_agent.py` | High |
| AGT-08 | ERP: PO creation is fictional (`SAP_S4HANA`, `ADVANCE_RELEASED`, 0.8/0.2 literals); no ERP connector; no 20% holdback release step; PO saved with `category=""`. | `erp_agent.py` | High |
| AGT-09 | Legal: seed GSTIN `27AAACH1234F1Z5` as default; the DSC is a SHA-256 string reported as `signed: True`; an ack number is still generated; category, factor and signatory are not passed. | `legal_agent.py` | Critical |
| AGT-10 | Form-1 and audit PDFs use defaults (category I, fiscal year from the month, 100% compliance, empty chain head, 112000 kWh and 0.45 SEC). The Form-1 PDF goes to worker `/tmp`; the audit report bytes are discarded. | `agent_activities.py` | Critical |
| AGT-11 | The spec's separation of probabilistic and deterministic logic is violated: the LLM tool-calls PO creation, signing, dispatch and liability math. | all agents | High |
| AGT-12 | Agent factory is never called; model and temperature are unused even inside it; the allowlist excludes the API default model; `LlmUsageLog` has no writer so the cost cap is inert. | `agent_factory.py` | High |
| AGT-13 | Privacy covers prompts only; tool results (sales, e-way) reach Gemini raw; scrubbing is off by default; no golden test. | `privacy.py`, agents | High |
| AGT-14 | Regulatory agent output is unused; input text is hardcoded; no draft-pack generation. | `workflows.py` | Med |
| AGT-15 | Carried from the first audit, not re-verified: Nimble call uses `run_until_complete` inside a running loop; IsolationForest is trained on 7 synthetic samples. | `auditor_agent.py`, `jev_auditor.py` | Med |

### 4. Dynamic configuration (CFG)

| ID | Gap | Where | Sev |
| --- | --- | --- | --- |
| CFG-01 | No bootstrap for the first `platform_admin` or active pack. Maker-checker needs two platform admins. No UI for packs, policy, calibrations or ledger. | `regulatory.py`, `org_config.py` | Blocker |
| CFG-02 | Org policy is not consumed (threshold, categories, signatory, timezone). Validation compares tons with a delta threshold. | `org_config.py`, `workflows.py` | High |
| CFG-03 | Pack fields used inconsistently: corridor not passed to the auction; `conversion_factors.get(category, 1.0)` fails open; targets and amortisation unused. | `workflows.py` | High |
| CFG-04 | Literals remain: `/auctions/rfp` (12.0, 3.6, 12.0, 1000 t), treasury 0.30 and 1.00, legal factor table, API runtime thresholds, UI fiscal year and volume. | several | High |
| CFG-05 | Plant calibrations are entered by hand, not derived from data; no review step; no tolerance logic beyond 3σ. | `org_config.py` | Med |
| CFG-06 | Calibrations are per org but plants belong to recycler orgs. A run loads only the initiating org's calibrations, so the data model has no owner for recycler plant baselines. | `config_activities.py` | High |

### 5. Persistence (PER)

| ID | Gap | Where | Sev |
| --- | --- | --- | --- |
| PER-01 | Migrations are dialect-broken: phase 1 uses SQLite-only `randomblob` defaults, phase 4 uses PG-only `gen_random_uuid()` and `now()`; RLS statements sit in try/except. | `alembic/versions` | Critical |
| PER-02 | `AuditRecord`, `Form1Record` and auction clearing results are not written by the pipeline (only POs, and auctions only with an `auction_id`). | `agent_activities.py` | High |
| PER-03 | Escrow PO has two schemas (`advance_amount_inr` and `status` vs `advance_amount` and `escrow_status`); approve updates the old one; the UI reads the old one. | `organization.py`, `settlement.py` | High |
| PER-04 | ORM `org_id` is nullable on domain tables while the DB is NOT NULL; `company_id` and `org_id` are duplicated concepts. | `organization.py` | Med |
| PER-05 | SQLite database files committed (`synthetiq.db`, `api/synthetiq.db`, `test_feat001.db`). | repo root | Med |

### 6. Tenancy and identity (IAM)

| ID | Gap | Where | Sev |
| --- | --- | --- | --- |
| IAM-01 | Invite `role` is not validated and `accept_invite` assigns it, so any org admin can mint a `platform_admin`. | `organizations.py`, `auth.py` | Critical |
| IAM-02 | `list_organizations` shows every org to any org admin; any org admin can create orgs. | `organizations.py` | Critical |
| IAM-03 | Cross-tenant reads by ID: `/compliance/runs/{id}` and `/steps`, `/audit/verdict/{id}`, `/audit/report/*`, `/settlement/form1/{id}`, `/liability/report/{company_id}`, `/stream/*`. | several routes | Critical |
| IAM-04 | RLS never engages: nothing sets `app.org_id` and there is no `FORCE ROW LEVEL SECURITY`. | migrations, `database.py` | High |
| IAM-05 | Registration has no `org_type`, sends no email and does not enforce verification; `POST /users` still sets passwords. | `auth.py`, `users.py` | High |
| IAM-06 | One org per user; memberships are cosmetic; roles fixed in code with no recycler or brand roles. | `rbac.py`, `users.py` | High |
| IAM-07 | Refresh tokens work as access tokens; no rotation or revocation; `id_token` login can re-mint tokens; hand-rolled JWT. | `auth_service.py`, `jwt_utils.py` | High |
| IAM-08 | No password reset, change, lockout policy or MFA. | `auth.py` | Med |
| IAM-09 | Firebase is vestigial: no client SDK, lookup by `user_id` not `firebase_uid`, `/ready` hardcodes it as ready. | `auth_service.py`, `health.py` | Med |

### 7. Security and infrastructure (SEC)

| ID | Gap | Where | Sev |
| --- | --- | --- | --- |
| SEC-01 | MCP `/call` has no authentication; the middleware is unused and defaults to allow; any `company_id` can be queried. | `mcp/src/main.py` | Critical |
| SEC-02 | Temporal (7233, 8080) is published unauthenticated; anyone can send `human_approval`, bypassing API auth and four-eyes. | `deploy/docker-compose.yml` | Critical |
| SEC-03 | Grafana `admin/admin`; Prometheus, Ollama and the Pub/Sub emulator are published. | `deploy/docker-compose.yml` | High |
| SEC-04 | `/metrics`, `/api/docs` and `/ready` are open; OpenAPI declares no Bearer scheme. | `main.py`, `health.py` | Med |
| SEC-05 | Access tokens stored in `localStorage`. | `SessionContext.tsx` | Med |
| SEC-06 | No audit trail of admin actions beyond log lines. | API | Med |
| SEC-07 | `.env.local` and `certs/private.key` exist in the tree (not opened); confirm ignored and rotated. | repo | Med |
| SEC-08 | `/config/test-gemini` relays any key and model; config disclosure to all users. | `config.py` | Low |

### 8. UI (UI)

| ID | Gap | Where | Sev |
| --- | --- | --- | --- |
| UI-01 | No route guard; refresh token discarded; after 60 minutes calls fail silently. | `AppShell.tsx`, `SessionContext.tsx` | High |
| UI-02 | Preflight `detail` objects render as `[object Object]`; `.catch(() => [])` hides 401 and 500 as empty data. | `base.service.ts`, pages | High |
| UI-03 | Run banner expects `steps`, `message` and `portal_ack_number`, none returned; no run polling; `/runs/{id}/steps` does not exist. | `page.tsx`, `compliance.service.ts` | Blocker |
| UI-04 | HITL console is always empty, reads fields never stored, compares user id with an email for four-eyes, can only approve, and is hidden from the auditor role. | `hitl/page.tsx`, `AppSidebar.tsx` | High |
| UI-05 | No setup flow, although `/runs/preflight` already returns a checklist. | dashboard | High |
| UI-06 | Missing pages: packs, policy, calibrations, ledger, accept-invite, verify-email, reset, run list and detail, recycler onboarding and bids; no `org_type` on register. | dashboard | High |
| UI-07 | Static text shown as live (Gemini 3.8 Flash, Temporal Connected), hardcoded fiscal year and volume, demo-role chips, fraud toggle, "5-stage" label. | `page.tsx`, `login/page.tsx` | Med |
| UI-08 | Two client layers (`api.ts` and services); nav role gating differs from RBAC; ops tool links shown to every user. | dashboard | Med |

### 9. Marketplace (MKT)

| ID | Gap | Where | Sev |
| --- | --- | --- | --- |
| MKT-01 | No recycler org onboarding or role: `submit_bid` needs role `recycler`, which RBAC, users and invites do not have. | `auctions.py`, `rbac.py` | Blocker |
| MKT-02 | Auctions are scoped to the creating org, so recyclers cannot find them and brands cannot see bids (`brand_owner` role absent). | `auctions.py` | High |
| MKT-03 | No auction lifecycle (close, clear, notify); records stay ACTIVE; `/rfp` does not set corridor fields. | `auctions.py` | High |
| MKT-04 | No plant registry or CTO verification; MCP stub returns UNVERIFIED; no registration of recycler SCADA endpoints. | `cpcb_tool.py` | High |
| MKT-05 | Recycler Bidder agent from the spec is not implemented. | agents | Med |

### 10. Quality and delivery (QA)

| ID | Gap | Where | Sev |
| --- | --- | --- | --- |
| QA-01 | No end-to-end acceptance test; `scripts/test_integration.py` is stale (removed routes and seed IDs); no tenancy or negative-auth suite. | `scripts/`, `api/tests` | Critical |
| QA-02 | Review loops verify that code constructs exist, and reports mark non-functional items as passed. | `.agents/tasks` | High |
| QA-03 | Observability is partial: token counter increments by 0, `/ready` is fake, no run-level metrics. | `agent_factory.py`, `health.py` | Med |
| QA-04 | Documentation drift: README, quickstart and setup guide unverified; stale phase reports; exported docs and stray files in the repo root. | repo | Med |
| QA-05 | CI pipelines (`pipeline.yaml`, `deploy-pod.yaml`) were not reviewed. | `.github/workflows` | Med |

## Suggested closure order

1. **Define done first (QA-01).** Script the two-org scenario through the public API only and make it the gate. Also close the cheap critical holes: IAM-01, IAM-02, SEC-01, SEC-02.
2. **Make a run start and finish (Blockers).** RUN-01 to RUN-04, CFG-01, DATA-01, DATA-02, UI-03.
3. **Make the output true.** AGT-01 to AGT-05, AGT-09, AGT-10, RUN-05, RUN-08, DATA-03 to DATA-05, DATA-09, MKT-01 to MKT-03.
4. **Finish multi-tenancy.** IAM-03 to IAM-07, PER-01 to PER-03, CFG-06, SEC-03, SEC-04.
5. **Make it usable.** UI-01, UI-02, UI-04 to UI-08, then CFG-02 to CFG-05.
6. **Close the spec ACs.** AGT-06, AGT-11 to AGT-13, DATA-08, DATA-10, MKT-04.

## Scope and limits

Static read only. Not assessed: CI and Helm templates (secrets, ingress), the root `docker-compose.yml`, the simulator, `.env*` and `certs/`, `ai_service`, `observability`, the PDF generators, the API `scheduler_service`, and the liability, audit, settlement, datasources, organizations, schedules and agents dashboard pages. Findings that depend on what the LLM returns (RUN-03, AGT-02) are by reading and should be confirmed with one real run and logs.
