---
id: problem-statement
title: Problem Statement
sidebar_position: 2
---

# The EPR Compliance & Anti-Fraud Crisis

<div className="gcp-badge">
  <img src="/docs/img/google-cloud.svg" width="16" height="16" alt="GCP" />
  Google Cloud AI Builder Hackathon
</div>
<div className="gemini-badge">
  <img src="/docs/img/gemini.svg" width="16" height="16" alt="Gemini" />
  Sustainability & Social Impact
</div>

---

## Executive Summary

India produces over **4.1 million tonnes of plastic packaging waste every year**. Under the **Plastic Waste Management (PWM) Rules** mandated by India's **Central Pollution Control Board (CPCB)**, all Producers, Importers, and Brand Owners (PIBOs) are legally obligated to purchase statutory recycling certificates to satisfy their Extended Producer Responsibility (EPR) targets.

Despite strict regulations, India's EPR credit market is paralyzed by **systemic fraud, phantom recycling, paper round-tripping, and manual inspection bottlenecks**, threatening the ecological integrity of circular economy initiatives.

```
       TRADITIONAL PAPER AUDIT (CURRENT BROKEN SYSTEM)
       
  +------------------+         Fake Invoices         +--------------------+
  | Fraudulent       | ----------------------------> | CPCB Portal        |
  | Recycling Plant  | <---------------------------- | (Self-declaration) |
  +------------------+     Bogus EPR Certificates    +--------------------+
          |                                                    |
          | No Motor Power Validation                          | Multi-Crore
          | No Thermodynamic Energy Check                      | Credit Sale
          v                                                    v
  [ Plastics Dumped Into Oceans & Landfills ]     [ Fictitious Compliance ]
```

---

## Critical Pain Points & Systemic Failure Modes

### 1. Phantom Recycling & Fictitious Certificate Generation
- **Paper Audits Without Ground Truth**: Recyclers claim credit for processing thousands of metric tons of Category I (Rigid), Category II (Flexible), and Category III (Multi-layered) plastics, while the material is simply dumped in landfills or open incinerators.
- **Invoice Round-Tripping**: Shell recycling entities generate circular GST invoices and e-Way bills to artificially inflate recycling volumes without handling physical waste.

### 2. Total Disconnect Between Financial Claims & Physical Laws
- **Absence of Sensor & Energy Verification**: Current compliance portals rely entirely on self-reported PDF invoices and static weighbridge slips.
- **Thermodynamic Impossibility**: Auditing bodies have no mechanism to cross-reference whether the electricity consumed by the plant's extruder motors matches the theoretical specific energy consumption (`SEC ≈ 0.35 - 0.55 kWh/kg`) required to melt and pelletize the claimed tonnage.

### 3. Acute Regulatory & Manual Inspection Bottlenecks
- Over **30,000 registered PIBOs** and thousands of registered recyclers submit quarterly compliance filings.
- State Pollution Control Boards (SPCBs) and CPCB employ a limited cadre of field inspectors, leading to a **< 2% physical inspection rate**. Audits take months, creating huge backlogs and opportunities for corruption.

### 4. Fragmented, Opaque Credit Trading Markets
- Existing bilateral EPR credit trading occurs in unregulated, opaque over-the-counter (OTC) settings without transparent price discovery.
- Buyers have zero visibility into whether the credits they purchased correspond to genuine recycling or will be retroactively cancelled during regulatory crackdowns.

### 5. Multi-Crore Financial & Environmental Damage
- Legitimate recyclers investing in high-grade recycling machinery are undercut by phantom operators selling bogus credits at dumping rates.
- Millions of metric tons of toxic plastics accumulate unrecovered in rivers, oceans, and municipal dumpsites.

---

## The Core Challenge

> **How can we construct an autonomous, zero-trust regulatory platform that mathematically links physical factory SCADA sensor data, high-throughput financial records, and statutory filing workflows to guarantee 100% fraud-proof EPR compliance?**

SynthetIQ answers this challenge by fusing **Google Cloud Platform (BigQuery, Vertex AI, Gemini 2.5 Flash, Cloud Pub/Sub, and GCS)** with thermodynamic physics verification and Continuous Double Auction mechanics.
