---
id: overview
title: Autonomous EPR Agent Fleet
sidebar_position: 1
---

# Autonomous EPR Agent Fleet

SynthetIQ deploys 8 specialized Google ADK (Agent Development Kit) agents powered by **Gemini 3.8 Flash** on Vertex AI Model Garden.

## The 8 Autonomous Agents

| Agent | Responsibility | Core Tools |
| :--- | :--- | :--- |
| **1. Upstream Liability Agent** | Calculates quarterly packaging obligation across plastic categories. | BigQuery Sales Data, CPCB Schedule Tables |
| **2. Physical Audit Agent** | Analyzes SCADA feeds, VFD torque, power factor & mass balance. | JEV Physics Engine, PubSub Telemetry Stream |
| **3. Financial Forensic Agent** | Verifies GST tax invoices, e-Way bills & bank reconciliation. | Document AI, MCA Database, Bank APIs |
| **4. Geo-Spatial Sentinel** | Satellite optical imagery verification of recycling plant footprint. | Google Earth Engine, Plant Polygon GeoJSON |
| **5. Cross-Check Synthesis** | Synthesizes quad-core verdicts and flags inconsistencies. | Reasoning Ensemble, Rule Engine |
| **6. CDA Auctioneer Agent** | Manages order book, continuous double auction matching & corridors. | In-Memory Order Book, Escrow Vault |
| **7. Escrow Dispatcher** | Executes 80% immediate release and 20% warranty holdback. | Payment Gateway, Ledger DB |
| **8. Regulatory Filing Agent** | Generates statutory CPCB Form-1 filing PDFs with DSC signatures. | ReportLab PDF Engine, DSC Cryptography |
