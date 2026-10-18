---
id: google-cloud-stack
title: Google Cloud & Gemini AI Stack
sidebar_position: 4
---

# Google Cloud & Gemini AI Architecture

<div className="gcp-badge">
  <img src="/docs/img/google-cloud.svg" width="16" height="16" alt="GCP" />
  Google Cloud Platform
</div>
<div className="gemini-badge">
  <img src="/docs/img/gemini.svg" width="16" height="16" alt="Gemini" />
  Vertex AI & Gemini Flash
</div>

---

## Architectural Role of Google Technologies

SynthetIQ is purpose-built to harness the full power of **Google Cloud Platform** and **Gemini Multimodal AI** to achieve sub-second fraud detection, petabyte-scale mass-balance reconciliation, and high-assurance regulatory auditing.

<div className="tech-grid">

  <div className="tech-card">
    <div className="tech-card-header">
      <img src="/docs/img/gemini.svg" alt="Gemini" />
      <div>
        <h4>Google Gemini (Vertex AI)</h4>
        <small>Multimodal Anti-Fraud Reasoning</small>
      </div>
    </div>
    <p>Powers the 8 autonomous Google ADK agents for cross-modal inspection of GST e-Way bills, weighbridge slips, satellite factory footprints, and statutory Form-1 generation.</p>
  </div>

  <div className="tech-card">
    <div className="tech-card-header">
      <img src="/docs/img/bigquery.svg" alt="BigQuery" />
      <div>
        <h4>Google BigQuery</h4>
        <small>Mass-Balance Data Lakehouse</small>
      </div>
    </div>
    <p>Executes ultra-low latency analytical queries over millions of packaging sales transactions, continuous credit ledger auditing, and supply chain reconciliation.</p>
  </div>

  <div className="tech-card">
    <div className="tech-card-header">
      <img src="/docs/img/google-cloud.svg" alt="Pub/Sub" />
      <div>
        <h4>Cloud Pub/Sub</h4>
        <small>Real-Time SCADA Event Bus</small>
      </div>
    </div>
    <p>Ingests high-frequency IoT sensor telemetry (100Hz motor torque, power factor, energy meters) from distributed recycling machinery.</p>
  </div>

  <div className="tech-card">
    <div className="tech-card-header">
      <img src="/docs/img/vertex-ai.svg" alt="Vertex AI" />
      <div>
        <h4>Vertex AI Model Garden</h4>
        <small>Enterprise Model Serving</small>
      </div>
    </div>
    <p>Provides managed model endpoints, structured JSON schema enforcement, prompt management, and low-latency inference pipelines.</p>
  </div>

</div>

---

## 1. Google Gemini & Vertex AI Integration

### Multimodal Document & Visual Forensics
SynthetIQ leverages **Gemini 2.5 Flash** (via Vertex AI) as the primary cognitive engine for the Autonomous Agent Fleet:
- **Tax Invoice & e-Way Bill Verification**: Gemini extracts and validates 15+ structured fields from scanned GST invoices (GSTIN, HSN codes, tax amounts, dispatch addresses) and cross-checks with e-Way bill movement timestamps.
- **Weighbridge Optical Slips**: Gemini Multimodal analyzes physical weight slips, identifying signs of font tampering, duplicate ticket numbers, or physical vehicle weight inconsistencies.
- **Geospatial Satellite Verification**: Cross-references recycling plant GPS coordinates with historical optical satellite imagery to detect phantom recycling facilities located on barren land or residential plots.

```python
# Gemini on Vertex AI Structured Inference (Excerpt from synthetiq_shared)
from vertexai.generative_models import GenerativeModel, Part

model = GenerativeModel("gemini-2.5-flash")

response = model.generate_content(
    [
        Part.from_data(invoice_bytes, mime_type="application/pdf"),
        Part.from_data(scada_summary_json, mime_type="application/json"),
        "Perform CPCB Form-1 forensic cross-check. Verify thermodynamic SEC balance "
        "and calculate fraud probability score (0.0 to 1.0) with statutory justification."
    ],
    generation_config={
        "response_mime_type": "application/json",
        "temperature": 0.1,
    }
)
```

---

## 2. Google BigQuery: The EPR Compliance Lakehouse

BigQuery provides the analytical muscle for real-time national mass-balance reconciliation.

### Dataset Architecture
- **Dataset ID**: `epr_compliance`
- **Location**: `asia-south1` (Mumbai)
- **Primary Tables**:
  1. `sales_data`: Upstream plastic packaging dispatched by PIBOs (Category I, II, III, IV).
  2. `recycling_events`: Verified plastic processing batches reported by recycling units.
  3. `scada_readings`: Downsampled time-series sensor readings (RPM, VFD torque, energy kWh).
  4. `credit_ledger`: Real-time double-entry EPR credit minting, holding, and retirement.

### Real-Time Mass-Balance SQL Query
```sql
-- BigQuery Mass-Balance Reconciliation Query
WITH material_inputs AS (
    SELECT 
        recycler_id,
        category,
        SUM(gross_weight_kg - tare_weight_kg) AS total_input_kg
    FROM `synthetiq-dev.epr_compliance.weighbridge_inward`
    WHERE batch_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    GROUP BY recycler_id, category
),
pellet_outputs AS (
    SELECT 
        recycler_id,
        category,
        SUM(pellets_produced_kg) AS total_output_kg
    FROM `synthetiq-dev.epr_compliance.extruder_outward`
    WHERE batch_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    GROUP BY recycler_id, category
)
SELECT 
    i.recycler_id,
    i.category,
    i.total_input_kg,
    o.total_output_kg,
    ROUND((o.total_output_kg / NULLIF(i.total_input_kg, 0)) * 100, 2) AS yield_percentage,
    CASE 
        WHEN (o.total_output_kg / NULLIF(i.total_input_kg, 0)) > 0.96 
        THEN 'FRAUD_FLAG_PHYSICALLY_IMPOSSIBLE_YIELD'
        WHEN (o.total_output_kg / NULLIF(i.total_input_kg, 0)) < 0.65 
        THEN 'ANOMALY_EXCESSIVE_PROCESS_LOSS'
        ELSE 'VALID_RECYCLING_RANGE'
    END AS audit_status
FROM material_inputs i
JOIN pellet_outputs o ON i.recycler_id = o.recycler_id AND i.category = o.category;
```

---

## 3. Google Cloud Pub/Sub: SCADA IoT Streaming Bus

- **Topic**: `scada-telemetry-stream`
- **Throughput**: Scalable to tens of thousands of messages per second across all industrial zones.
- **Telemetry Payload**:
  ```json
  {
    "device_id": "EXTRUDER-VFD-09",
    "timestamp": "2026-10-18T10:00:00.123Z",
    "rpm": 1420.5,
    "vfd_torque_nm": 348.2,
    "active_power_kw": 84.6,
    "power_factor": 0.94,
    "total_energy_kwh": 12845.8,
    "polymer_grade": "HDPE-CAT-1"
  }
  ```

---

## 4. Google Cloud Storage (GCS): Tamper-Proof Audit Vault

- **Bucket**: `gs://synthetiq-dev-cpcb-dossiers`
- **Features**:
  - **Object Versioning & Retention Policy**: Immutable compliance certificates preventing retroactive alterations.
  - **Signed URLs**: Generates temporary, cryptographically validated download links for CPCB and SPCB inspection officers.
  - **SHA-256 Checksums**: Every inspection dossier PDF stored in GCS is hashed and anchored into the audit ledger.

---

## 5. Google Kubernetes Engine (GKE): Production Cluster

- **Cluster Name**: `synthetiq-cluster`
- **Region**: `asia-south1-a` (Mumbai)
- **Deployment Spec**:
  - 13 interconnected microservices running in namespace `synthetiq`.
  - NGINX Ingress Controller with SSL termination (`synthetiq.ddns.net`).
  - Native integration with Google Cloud IAM Workload Identity for zero-secret cloud authentication.
