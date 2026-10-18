---
id: overview
title: System & Cloud Architecture
sidebar_position: 1
---

# SynthetIQ System Architecture

<div className="gcp-badge">
  <img src="/docs/img/google-cloud.svg" width="16" height="16" alt="GCP" />
  GKE Cluster (asia-south1)
</div>
<div className="gemini-badge">
  <img src="/docs/img/gemini.svg" width="16" height="16" alt="Gemini" />
  Vertex AI & Gemini Flash
</div>

---

## Architectural Topology

SynthetIQ is engineered as a cloud-native, microservices-driven distributed system hosted on **Google Kubernetes Engine (GKE)** in `asia-south1` (Mumbai), tightly integrated with **Google Cloud Platform data, AI, and storage services**.

```
                           +-----------------------------------------------+
                           |          GCP NGINX INGRESS CONTROLLER         |
                           |             (synthetiq.ddns.net)              |
                           +-------+-------------------+---------------+---+
                                   |                   |               |
             /                     | /api              | /temporal     | /grafana
             v                     v                   v               v
  +--------------------+  +------------------+  +-------------+  +-------------+
  | Next.js Dashboard  |  | FastAPI Gateway  |  | Temporal UI |  | Grafana     |
  | (Port 3000)        |  | (Port 8000)      |  | (Port 8080) |  | (Port 3000) |
  +--------------------+  +--------+---------+  +------+------+  +------+------+
                                   |                   |                |
                                   v                   v                |
                          +------------------------------------+        |
                          |      Temporal Workflow Server      |        |
                          |            (Port 7233)             |        |
                          +-----------------+------------------+        |
                                            |                           |
                                            v                           |
                          +------------------------------------+        |
                          |     SynthetIQ Temporal Worker      |        |
                          |  - JEV Reflex Physics Engine       |        |
                          |  - 8 Google ADK Autonomous Agents  |        |
                          |  - Continuous Double Auction (CDA) |        |
                          +---+-------------+--------------+---+        |
                              |             |              |            |
                              |             |              |            |
      +-----------------------+             |              +-------+    |
      |                                     |                      |    |
      v                                     v                      v    v
+------------------------+      +-----------------------+     +-------------------+
| Google Vertex AI       |      | Google BigQuery       |     | Prometheus & OTel |
| - Gemini 2.5 Flash     |      | - Dataset: epr_compl..|     | - Metrics Scraper |
| - Multimodal Reasoning |      | - Mass-Balance Ledger |     | - OTLP Collector  |
+------------------------+      +-----------------------+     +-------------------+
      |                                     |
      v                                     v
+------------------------+      +-----------------------+
| Cloud Storage (GCS)    |      | Cloud Pub/Sub         |
| - CPCB Form-1 Dossiers |      | - SCADA IoT Telemetry |
+------------------------+      +-----------------------+
```

---

## Core Microservices Roster

| Service | Technology | Role | Port | Routing / Ingress |
| :--- | :--- | :--- | :--- | :--- |
| **`dashboard`** | Next.js 14 / TypeScript | Real-Time Executive UI & Auction Desk | `3000` | `https://synthetiq.ddns.net/` |
| **`api`** | FastAPI / Python 3.13 | Public API Gateway, JWT Auth & HITL | `8000` | `https://synthetiq.ddns.net/api/` |
| **`worker`** | Temporal Worker / Python 3.13 | AI Agents, JEV Reflex Physics & Sagas | `9090` | Internal (ClusterIP) |
| **`mcp`** | FastMCP / Python 3.13 | Zero-Trust Tool Execution Gate | `8001` | Internal (ClusterIP) |
| **`simulator`** | Python 3.13 | SCADA Extruder Telemetry Generator | `9091` | Internal (ClusterIP) |
| **`temporal-server`**| Temporal.io Go Engine | Distributed Orchestration Engine | `7233` | Internal (ClusterIP) |
| **`temporal-ui`** | Temporal Web UI | Workflow Visualizer & Execution Graph | `8080` | `https://synthetiq.ddns.net/temporal/` |
| **`prometheus`** | Prometheus v2.51 | Microservice Metrics TSDB | `9090` | Internal (ClusterIP) |
| **`grafana`** | Grafana v10.4 | Pod Health & OTel APM Dashboards | `3000` | `https://synthetiq.ddns.net/grafana/` |
| **`otel-collector`**| OpenTelemetry Contrib 0.98 | Distributed Tracing & Metrics Hub | `4317`/`4318`| `/otel` |
| **`docs`** | Docusaurus 3 / NGINX | Documentation & Architecture Portal | `80` | `https://synthetiq.ddns.net/docs/` |

---

## Google Cloud Managed Services Integration

### 1. Vertex AI Model Garden & Gemini 2.5 Flash
- **Deployment**: Managed model endpoint running `gemini-2.5-flash` in region `asia-south1`.
- **Latency & Reliability**: Sub-second multimodal document extraction with fallback to `gemini-1.5-pro` for deep legal clause synthesis.
- **Structured Schema Enforcing**: Strictly validated Pydantic JSON schemas preventing hallucinations during CPCB Form-1 field populating.

### 2. Google BigQuery Lakehouse
- **Dataset**: `synthetiq-dev.epr_compliance`
- **Partitioning & Clustering**: Partitioned by `batch_date` (day) and clustered by `recycler_id` and `category` for ultra-fast queries across millions of transactions.
- **SQL Transformations**: Executes automated mass-balance sanity algorithms, detecting anomalies where recycling output exceeds physical inputs.

### 3. Google Cloud Pub/Sub Streaming
- **Topic**: `scada-telemetry-stream`
- **Subscription**: `scada-telemetry-sub`
- **Role**: Decouples high-frequency factory telemetry streams (100 Hz) from backend analytics, ensuring zero dropped readings even during network spikes.

### 4. Google Cloud Storage (GCS)
- **Bucket**: `gs://synthetiq-dev-cpcb-dossiers`
- **Role**: Stores tamper-evident compliance audit certificates, raw high-resolution weighbridge photos, and signed inspection dossiers.
