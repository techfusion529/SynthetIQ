---
id: overview
title: Platform Architecture
sidebar_position: 1
---

# SynthetIQ Architecture Overview

SynthetIQ is organized as a microservices architecture communicating over HTTP REST, gRPC (Temporal & OTLP), and MCP (Model Context Protocol).

## Microservices Topology

| Service | Technology | Role | Port | Ingress Route |
| :--- | :--- | :--- | :--- | :--- |
| **`dashboard`** | Next.js 14 / TypeScript | Executive Web UI & Live Monitoring | `3000` | `/` |
| **`api`** | FastAPI / Python 3.13 | Public API Gateway, JWT Auth & HITL | `8000` | `/api` |
| **`worker`** | Temporal Worker / Python 3.13 | AI Agents, JEV Reflex & Sagas | `9090` (Metrics) | Internal |
| **`mcp`** | FastMCP / Python 3.13 | Zero-Trust Tool Execution Gateway | `8001` | Internal |
| **`simulator`** | Python 3.13 | High-Frequency SCADA Streamer | `9091` | Internal |
| **`temporal-server`** | Temporal.io Go Core | Distributed Workflow State Engine | `7233` | Internal |
| **`temporal-ui`** | Temporal Web UI | Workflow History & Execution Graph | `8080` | `/temporal` |
| **`prometheus`** | Prometheus v2.51 | Time-Series Metrics Scraper & TSDB | `9090` | Internal |
| **`grafana`** | Grafana v10.4 | Visualization Dashboards & Alerting | `3000` | `/grafana` |
| **`otel-collector`** | OTel Contrib 0.98 | OpenTelemetry Trace & Metric Hub | `4317` / `4318` | `/otel` |
| **`docs`** | Docusaurus / NGINX | Interactive Documentation Portal | `80` | `/docs` |

---

## Data Flow & Ingestion Pipeline

1. **SCADA Sensor Data**: Extruder motors transmit telemetry (RPM, VFD torque, power factor, energy kWh) to Pub/Sub or Simulator.
2. **JEV Reflex Validation**: Physics engine compares actual electric energy consumed against the theoretical thermodynamic melt balance.
3. **Nimble System 1**: Local fast classifier spots anomalies under 50ms before triggering heavy LLM models.
4. **Google ADK & Vertex AI**: Gemini 3.8 Flash assesses statutory liability, invoice validity, and recycler legitimacy.
5. **Human-in-the-Loop (HITL)**: Any anomaly > 5% delta triggers a suspension signal in Temporal awaiting compliance officer review.
6. **CPCB Form-1 Dossier**: Upon verification, an authenticated report with digital signature verification is generated.
