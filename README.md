# SynthetIQ — Autonomous EPR Compliance & Anti-Fraud Engine

<div align="center">

![SynthetIQ Logo](synthetiq-logo.svg)

**Zero-Trust, Multi-Agent Autonomous Plastic Waste Compliance, Physics-Enforced Anti-Fraud Auditing & Credit Marketplace**

[![Google Cloud](https://img.shields.io/badge/Google_Cloud-Vertex_AI-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://cloud.google.com/)
[![Gemini](https://img.shields.io/badge/Model-Gemini_3.8_Flash-8E75C2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Temporal](https://img.shields.io/badge/Orchestration-Temporal.io-000000?style=for-the-badge&logo=temporal&logoColor=white)](https://temporal.io/)
[![Kubernetes](https://img.shields.io/badge/Platform-GKE_Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![OpenTelemetry](https://img.shields.io/badge/Observability-OpenTelemetry-7F52FF?style=for-the-badge&logo=opentelemetry&logoColor=white)](https://opentelemetry.io/)
[![Grafana](https://img.shields.io/badge/Dashboards-Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)](https://grafana.com/)

</div>

---

## 🏆 Hackathon Submission Details

- **Hackathon**: Google Cloud AI Builder Hackathon
- **Theme**: **Sustainability & Social Impact**
- **Team Name**: **Techfusion**
- **Team Leader**: **Sayantika Bose**
- **Core Developer**: **Sai Sudhane G**

---

## 🌐 Live Deployed Application & Cloud Portals

The complete SynthetIQ platform is deployed on **Google Kubernetes Engine (GKE)** in the `synthetiq` namespace with SSL/TLS encryption:

| Portal | URL | Description |
| :--- | :--- | :--- |
| 🖥️ **Executive Dashboard** | [**synthetiq.ddns.net**](https://synthetiq.ddns.net/) | Live management console for PIBOs, recyclers, order books, and real-time fraud alerts |
| 📚 **Documentation Portal** | [**synthetiq.ddns.net/docs/**](https://synthetiq.ddns.net/docs/) | Comprehensive Docusaurus portal detailing architecture, agents, JEV physics, and APIs |
| 📊 **Grafana Observability** | [**synthetiq.ddns.net/grafana/**](https://synthetiq.ddns.net/grafana/) | 5 Production dashboards for pod saturation, OTel APM traces, SCADA torque, and workflows |
| ⚡ **API Gateway (FastAPI)** | [**synthetiq.ddns.net/api/docs**](https://synthetiq.ddns.net/api/docs) | Interactive OpenAPI Swagger documentation for audit triggers and HITL exception routing |
| 🔄 **Temporal Orchestration UI** | [**synthetiq.ddns.net/temporal/**](https://synthetiq.ddns.net/temporal/) | Visual workflow DAG execution histories, retry states, and saga compensation ledgers |

> **Credentials**:
> - **Grafana**: Username: `admin` | Password: `admin` (Dashboards located in folder `SynthetIQ`)
> - **Executive Dashboard**: Pre-configured with administrative and auditor personas

---

## 🌍 The Problem Statement

India generates over **3.4 million tonnes of plastic waste annually**, with less than 30% recycled. To tackle this ecological crisis, the **Ministry of Environment, Forest and Climate Change (MoEFCC)** and the **Central Pollution Control Board (CPCB)** mandated statutory **Extended Producer Responsibility (EPR)** guidelines. Brand Owners, Producers, and Importers (PIBOs) are legally obligated to purchase recycling credits to offset their packaging footprint across four polymer categories:
- **Category I**: Rigid Plastic Packaging
- **Category II**: Flexible Single or Multi-Layer Plastic Packaging
- **Category III**: Multi-Layered Plastic Packaging (MLP)
- **Category IV**: Compostable Plastic Packaging

### The Crisis of "Phantom Recycling" & Fraud
1. **Paper-Only Recycling**: Recyclers generate fraudulent invoices and fake certificate claims without actually running extruders or melting physical plastic.
2. **Double Counting**: The same batch of recycled polymer is sold to multiple brands across state borders due to siloed verification.
3. **Regulatory Auditing Bottleneck**: Manual inspection of hundreds of thousands of recycling facilities is physically impossible, resulting in massive backlogs and systemic fraud.
4. **Financial Escrow Risk**: Brands pay millions in advance for unverified credits, risking heavy statutory non-compliance penalties (up to ₹10,000/tonne) if audits fail retroactively.

---

## 💡 The SynthetIQ Solution

**SynthetIQ** transforms EPR compliance from a retroactive paperwork exercise into an **autonomous, physics-enforced, zero-trust verification ecosystem**. By fusing **Google Vertex AI (Gemini 3.8 Flash)**, **Temporal.io durable workflows**, and **sub-second SCADA motor physics**, SynthetIQ makes fraudulent plastic claims mathematically impossible.

```
                      +-----------------------------+
                      | Next.js Executive Dashboard |
                      |    (Port 3000 / Ingress /)  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |     FastAPI API Gateway     |
                      |   (Port 8000 / Ingress /api)|
                      +--------------+--------------+
                                     |
                    +----------------+----------------+
                    |                                 |
                    v                                 v
     +-----------------------------+   +-----------------------------+
     |   Temporal Workflow Engine  |   |    MCP Tool Execution Gate  |
     | (Port 7233 / Port 8080 UI)  |   |    (Model Context Protocol) |
     +--------------+--------------+   +-----------------------------+
                    |
                    v
     +-------------------------------------------------------------+
     |                  SynthetIQ Temporal Worker                  |
     |  +-----------------------+    +--------------------------+  |
     |  | Google ADK Multi-Agent|    |   JEV Reflex Physics     |  |
     |  | (Gemini 3.8 Flash)    |    |   (Thermodynamic Enthalpy|  |
     |  +-----------------------+    +--------------------------+  |
     |  +-----------------------+    +--------------------------+  |
     |  | Offline PII Scrubbing |    |   Nimble System 1 Fraud  |  |
     |  | (Gemma 2B via Ollama) |    |   (Fast Anomaly Hunter)  |  |
     |  +-----------------------+    +--------------------------+  |
     +-------------------------------------------------------------+
                                     |
                    +----------------+----------------+
                    v                                 v
     +-----------------------------+   +-----------------------------+
     |  OpenTelemetry Collector    |   |     Prometheus & Grafana    |
     |  (OTLP :4317 / :4318)       |   |     (5 Pod & APM Dashboards)|
     +-----------------------------+   +-----------------------------+
```

---

## 🔬 Core Innovations & Key Pillars

### 1. JEV Reflex Physics Engine (Hardware-Grounded Truth)
To detect phantom recycling, SynthetIQ connects directly to plant SCADA telemetry via Google Cloud Pub/Sub and applies thermodynamic first principles:
- **Specific Melt Enthalpy ($H_m$)**: The engine computes the theoretical thermodynamic energy required to convert solid polymer pellets to melt:
  $$E_{\text{theoretical}} = m \cdot [c_p \cdot (T_{\text{melt}} - T_{\text{ambient}}) + \Delta H_{\text{fusion}}] \cdot \eta_{\text{thermal}}^{-1}$$
  If sub-metered electricity consumption deviates by $> 5\%$ from the mass balance expectation, the claim is instantly flagged.
- **VFD Shaft Torque Curves (Nm)**: Genuine polymer shear creates continuous torque resistance ($400\text{--}500\text{ Nm}$). Empty spinning screws run at $< 80\text{ Nm}$, exposing motors idling solely to fake sensor data.
- **Power Factor Signatures**: Distinguishes inductive shear loads ($\text{PF} \in [0.85, 0.92]$) from idling magnetic losses ($\text{PF} < 0.40$).

### 2. Autonomous Multi-Agent Fleet (8 Google ADK Agents)
Powered by **Gemini 3.8 Flash** on Vertex AI and Google ADK:
1. **Brand Liability Agent**: Scans BigQuery ERP sales databases to compute exact plastic packaging deficits across polymer categories.
2. **Physical SCADA Audit Agent**: Ingests high-frequency motor drive streams to verify thermal conversion.
3. **Financial Forensics Agent**: Reconciles GSTN e-Invoices, e-Way bills, and bank settlements against tax ledgers.
4. **Geo-Spatial Sentinel**: Cross-references recycling plant satellite footprints and boundary polygons.
5. **Cross-Check Synthesis Agent**: Weighs multi-dimensional evidence to issue mathematically verified verdicts.
6. **CDA Auctioneer Agent**: Operates continuous double auctions with statutory price corridors (30% to 100%).
7. **Escrow Dispatcher Agent**: Enforces an 80/20 retention model (80% immediate release, 20% held until final CPCB audit).
8. **Regulatory Filing Agent**: Automatically compiles CPCB Form-1 inspection dossiers with cryptographic hashes and digital signatures.

### 3. Human-in-the-Loop (HITL) Exception Resolution
Audits exhibiting borderline anomalies ($> 5\%$ variance) pause dynamically via Temporal signals. Compliance officers inspect real-time VFD torque curves, mass balances, and agent rationales in the Executive Dashboard to approve overrides or reject submissions.

### 4. Enterprise Observability & OpenTelemetry APM
- **OTel Ingestion Pipeline**: In-pod instrumentation pushes traces and metrics to the OpenTelemetry Collector (`synthetiq-otel-collector`).
- **5 Curated Grafana Dashboards**:
  - `SynthetIQ — Pods & Services Infrastructure Health`: Monitored per-pod CPU cores, memory working sets, network I/O, throttling rates, and microservice latencies.
  - `SynthetIQ — OpenTelemetry (OTel) Distributed Traces & APM`: Real-time span throughput, trace latencies (p50/p90/p99), and LLM cost tracking ($ USD).
  - `SynthetIQ — EPR Compliance Overview`: Tonnage counters, statutory price corridors, and escrow statuses.
  - `SynthetIQ — SCADA Audit Telemetry`: Motor torque curves and thermodynamic energy balances.
  - `SynthetIQ — Temporal Workflows`: Workflow durations, activity retries, and saga compensations.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Cloud Infrastructure** | Google Cloud Platform (GCP), Google Kubernetes Engine (GKE), Google Artifact Registry |
| **AI & LLM Services** | Google Vertex AI, Gemini 3.8 Flash, Google ADK, Gemma 2B (Ollama PII Scrubber) |
| **Workflow Engine** | Temporal.io (Python SDK) with durable execution & saga rollbacks |
| **Big Data & Telemetry** | Google Cloud BigQuery, Google Cloud Pub/Sub, Redis 7, PostgreSQL 15 |
| **Zero-Trust Tooling** | Model Context Protocol (FastMCP) with tool isolation |
| **Observability Stack** | OpenTelemetry Contrib Collector, Prometheus v2.51, Grafana v10.4 |
| **Frontend Applications** | Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide Icons |
| **Documentation Portal** | Docusaurus v3, React 19, NGINX static server |
| **CI/CD Automation** | GitHub Actions, Helm 3, Docker Multi-Stage Builds |

---

## 👥 The Team Behind SynthetIQ — Techfusion

SynthetIQ was designed, architected, and built by **Team Techfusion** for the **Google Cloud AI Builder Hackathon**:

| Member | Role | Key Contributions |
| :--- | :--- | :--- |
| **Sayantika Bose** | **Team Leader** | Product Architecture, Regulatory EPR Alignment, Multi-Agent Coordination & Compliance Modeling |
| **Sai Sudhane G** | **Core Developer** | Full-Stack Development, JEV Reflex Physics Engine, OpenTelemetry Pipeline, Helm & GKE Deployment |

---

<div align="center">

**SynthetIQ — Built with pride by Techfusion for a cleaner, transparent, and sustainable planet.**

</div>
