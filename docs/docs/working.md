---
id: working
title: How SynthetIQ Works
sidebar_position: 5
---

# How SynthetIQ Works: End-to-End Lifecycle

<div className="gcp-badge">
  <img src="/docs/img/google-cloud.svg" width="16" height="16" alt="GCP" />
  End-to-End Workflow
</div>
<div className="gemini-badge">
  <img src="/docs/img/gemini.svg" width="16" height="16" alt="Gemini" />
  Automated Multi-Agent Pipeline
</div>

---

## 6-Stage Autonomous Operational Workflow

SynthetIQ enforces an unbroken, mathematically verified pipeline connecting physical factory machinery with statutory compliance filings.

```
+------------------------------------------------------------------------------------+
| 1. INGESTION       SCADA IoT (Pub/Sub)  |  GST e-Way Bills  |  Weighbridge Slips   |
+------------------------------------------------------------------------------------+
                                          |
                                          v
+------------------------------------------------------------------------------------+
| 2. JEV REFLEX      Motor Torque | Power Factor | Thermodynamic SEC (kWh/kg)        |
+------------------------------------------------------------------------------------+
                                          |
                                          v
+------------------------------------------------------------------------------------+
| 3. BIGQUERY        Mass-Balance Yield SQL | National EPR Credit Ledger Audit       |
+------------------------------------------------------------------------------------+
                                          |
                                          v
+------------------------------------------------------------------------------------+
| 4. GEMINI AGENTS   Multimodal Invoice Audit | Geospatial Verification | Synthesis  |
+------------------------------------------------------------------------------------+
                                          |
                        +-----------------+-----------------+
                        | (Verified)                        | (Discrepancy > 5%)
                        v                                   v
+---------------------------------------------+  +-----------------------------------+
| 5. CDA MARKETPLACE & ESCROW                 |  | 5B. HUMAN-IN-THE-LOOP (HITL)      |
| - Limit Order Matching (Continuous Auction) |  | - Temporal Workflow Suspended     |
| - 80% Immediate Release / 20% Holdback      |  | - SPCB Officer Dossier Review     |
+---------------------------------------------+  +-----------------------------------+
                        |
                        v
+------------------------------------------------------------------------------------+
| 6. REGULATORY FILING  CPCB Form-1 Certificate PDF | SHA-256 Hash Anchored in GCS   |
+------------------------------------------------------------------------------------+
```

---

## Detailed Step-by-Step Breakdown

### Stage 1: Multichannel Data Ingestion
1. **SCADA Sensor Telemetry**: Plastic recycling machinery (extruders, shredders, agglomerators) stream real-time motor readings to **Google Cloud Pub/Sub** at high frequency (10–100 Hz).
2. **Financial Records**: Recyclers and PIBOs upload GST invoices, e-Way bills, and weighbridge weight receipts via the FastAPI gateway or automated enterprise ERP connectors.
3. **Geo-Spatial GPS Coordinates**: Vehicle manifest coordinates and plant facility boundaries are captured for satellite ground validation.

---

### Stage 2: JEV Reflex Physics Engine (Sub-50ms)
Before any expensive AI reasoning is triggered, the **JEV Reflex Physics Engine** executes sub-second physical validation:
- **Motor Torque & Power Factor**: Reads Variable Frequency Drive (VFD) output torque (`τ`), angular velocity (`ω`), active power (`P = √3 * V * I * cos(φ)`), and reactive power (`Q`).
- **Thermodynamic Specific Energy Consumption (SEC)**:
  ```text
  SEC = (∫ P(t) dt) / m_plastic
  ```
  The physics engine verifies whether the calculated SEC falls within the physical thermodynamic envelope (`ΔH_m ≈ 0.35 - 0.55 kWh/kg` for HDPE/PP).
- **Nimble System 1 Triage**: If an extruder claims 10 metric tons of processing in 2 hours with only 100 kWh of energy consumed, the system immediately flags a **Thermodynamic Impossibility Anomaly** in < 50ms.

---

### Stage 3: Google BigQuery Mass-Balance Analytics
1. The **Upstream Liability Agent** queries BigQuery's `sales_data` table to compute the producer's exact quarterly packaging obligations across Categories I, II, III, and IV.
2. BigQuery runs multi-table joins against `recycling_events` and `weighbridge_inward` to verify mass conservation:
   ```text
   Mass_Input = Mass_Output_Pellets + Mass_Process_Loss
   ```
3. If yield exceeds 96% or drops below 65%, BigQuery triggers an automated audit flag.

---

### Stage 4: Google Gemini Multi-Agent Forensic Investigation
The request enters a **Temporal.io distributed workflow**, dispatching 8 specialized Google ADK agents powered by **Gemini 2.5 Flash on Vertex AI**:
- **Financial Forensic Agent**: Extracts structured line-items from GST tax invoices, cross-checks HSN codes (3915 - Plastic waste/scrap), and verifies GSTIN active status against tax databases.
- **Physical Audit Agent**: Correlates the JEV physics output with claimed production batches.
- **Geo-Spatial Sentinel**: Examines satellite optical imagery over plant coordinates to confirm physical factory infrastructure.
- **Cross-Check Synthesis Agent**: Weighs verdicts from all agents, computing a normalized **Fraud Risk Score (0.0 to 1.0)** with statutory justification.

---

### Stage 5: Continuous Double Auction (CDA) & Escrow Matching
Once an EPR recycling credit batch is verified (Fraud Risk Score < 0.05), it enters the live marketplace:
- **Continuous Double Auction (CDA)**: The matching engine matches buyer bids (PIBOs needing compliance credits) and seller asks (verified recyclers) in an order book.
- **Statutory Price Corridors**: Automatically enforces statutory floor (30%) and ceiling (100%) penalty rates to maintain market stability.
- **80/20 Escrow Vault**:
  - **80% Immediate Settlement**: Transferred to the recycler immediately upon transaction execution.
  - **20% Warranty Holdback**: Retained in escrow for 90 days pending post-production physical audit and CPCB filing confirmation.

---

### Stage 6: CPCB Form-1 Regulatory Filing & Immutable Storage
1. The **Regulatory Filing Agent** compiles all forensic evidence, SCADA graphs, and auction transaction receipts.
2. A formal statutory **CPCB Form-1 Inspection Dossier PDF** is generated with SHA-256 digital certificate hashes.
3. The resulting PDF is stored permanently in **Google Cloud Storage (GCS)** (`gs://synthetiq-cpcb-dossiers/`) with signed URL access for government regulators.
4. Compliance metrics and audit status are mirrored to **Grafana** and the **Next.js Executive Dashboard** for real-time compliance officer monitoring.
