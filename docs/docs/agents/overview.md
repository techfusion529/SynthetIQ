---
id: overview
title: Autonomous EPR Agent Fleet
sidebar_position: 1
---

# Autonomous EPR Agent Fleet

<div className="gcp-badge">
  <img src="/docs/img/google-cloud.svg" width="16" height="16" alt="GCP" />
  Google ADK Architecture
</div>
<div className="gemini-badge">
  <img src="/docs/img/gemini.svg" width="16" height="16" alt="Gemini" />
  Powered by Gemini 2.5 Flash
</div>

---

## Overview

SynthetIQ deploys an ensemble fleet of **8 specialized autonomous agents** built on the **Google Agent Development Kit (ADK)** and powered by **Gemini 2.5 Flash on Vertex AI**.

Each agent specializes in a distinct forensic domain—verifying physical thermodynamics, financial tax records, satellite factory footprints, or legal CPCB schedules—before arriving at a unified anti-fraud consensus.

```
                         +-----------------------------+
                         |  Temporal Distributed Saga  |
                         +--------------+--------------+
                                        |
                 +----------------------+----------------------+
                 |                      |                      |
                 v                      v                      v
     +-----------------------+ +--------------------+ +-----------------------+
     | Upstream Liability Ag.| | Physical SCADA Ag. | | Financial Forensic Ag.|
     | - BigQuery Sales Data | | - JEV Reflex (SEC) | | - Gemini Multimodal   |
     | - CPCB Schedule Slabs | | - VFD Torque/Power | | - GST / e-Way Bills   |
     +-----------+-----------+ +---------+----------+ +-----------+-----------+
                 |                       |                        |
                 +-----------------------+------------------------+
                                         |
                                         v
                         +-----------------------------+
                         | Cross-Check Synthesis Agent |
                         | - Ensemble Consensus        |
                         | - Fraud Probability Score   |
                         +--------------+--------------+
                                        |
                        +---------------+---------------+
                        | (Pass < 0.05)                 | (Anomaly > 0.05)
                        v                               v
         +-----------------------------+ +-----------------------------+
         | CDA Market & Escrow Release | | Human-in-the-Loop Review    |
         | - 80% Immediate Settlement  | | - CPCB Inspector Dashboard  |
         | - 20% Warranty Retention    | | - Temporal Signal Approval  |
         +-----------------------------+ +-----------------------------+
```

---

## Roster of the 8 Autonomous Agents

| # | Agent Name | Domain & Responsibility | Google Cloud & System Tools |
| :-: | :--- | :--- | :--- |
| **1** | **Upstream Liability Agent** | Calculates quarterly packaging obligation across CPCB plastic Categories I, II, III, and IV. | **Google BigQuery** (`sales_data`), CPCB Schedule Matrix |
| **2** | **Physical Audit Agent** | Analyzes SCADA feeds, VFD motor torque curves, active/reactive power, and Specific Energy Consumption. | **Cloud Pub/Sub**, JEV Reflex Physics Engine |
| **3** | **Financial Forensic Agent** | Inspects scanned GST invoices, verifies e-Way bill dates, and reconciles bank transaction manifests. | **Gemini 2.5 Flash** Multimodal, Document AI |
| **4** | **Geo-Spatial Sentinel** | Analyzes satellite optical imagery and GPS boundaries to verify recycling plant operational footprint. | **Gemini Vision**, Google Earth Engine, GeoJSON |
| **5** | **Cross-Check Synthesis Agent**| Synthesizes verdicts from all agents, calculates weighted fraud scores, and detects circular round-tripping. | **Gemini Reasoning Ensemble**, Pydantic Schemas |
| **6** | **CDA Auctioneer Agent** | Operates real-time limit order book matching with CPCB statutory floor and ceiling price corridors. | Continuous Double Auction Matching Engine |
| **7** | **Escrow Dispatcher Agent** | Manages automated financial settlement: 80% immediate release, 20% warranty holdback in escrow. | Escrow Vault Contract, Payment Webhooks |
| **8** | **Regulatory Filing Agent** | Generates statutory CPCB Form-1 inspection dossier PDFs with SHA-256 digital certificate hashes. | ReportLab PDF Engine, **Google Cloud Storage (GCS)** |

---

## Consensus & Fraud Scoring Mechanism

Every batch evaluated by the fleet receives a normalized **Fraud Risk Score (`F ∈ [0.0, 1.0]`)**:

```text
Fraud_Risk_Score = (w1 * S_physics) + (w2 * S_mass_balance) + (w3 * S_financial) + (w4 * S_geospatial)
```

Where weights are tuned to prioritize physical and mass-balance impossibility:
- `w_physics = 0.35` (Motor torque, power factor, SEC enthalpy balance)
- `w_mass_balance = 0.30` (BigQuery input-output yield conservation)
- `w_financial = 0.20` (GST tax invoices, e-Way bills, bank reconciliations)
- `w_geospatial = 0.15` (Satellite optical footprint & GPS tracking)

- **`F < 0.05` (Clean)**: Immediate automated minting and CDA marketplace qualification.
- **`0.05 <= F <= 0.20` (Suspect)**: Additional SCADA telemetry sample requested; escrow holdback increased to 40%.
- **`F > 0.20` (Fraud / Anomaly)**: Instant workflow suspension, CPCB Form-1 block, and automated referral to Human-in-the-Loop (HITL) compliance officers.
