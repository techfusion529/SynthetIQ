# SynthetIQ

**Autonomous Extended Producer Responsibility (EPR) Compliance & Anti-Fraud Engine**

A zero-trust, multi-agent platform that automates liability calculation, market procurement, fraud auditing via SCADA telemetry, and statutory dispatch for India's plastic waste EPR regime.

## Architecture

SynthetIQ is composed of 4 durable Temporal workflows orchestrating 8 specialized AI agents:

| Workflow | Purpose | Agents |
|:---|:---|:---|
| **W1: Liability & Sourcing** | Calculates EPR digital deficit from ERP sales data | Brand Liability (Gemini), Regulatory Watchdog (Gemini) |
| **W2: Liquidity & Auction** | Runs continuous double auction within statutory corridor | Treasury (Gemini), Recycler Bidders (Heuristic) |
| **W3: Quad-Core Fraud Audit** | Proves thermodynamic melting via SCADA/VFD analysis | Logistics (Gemini), Auditor (TypeSafe Jev) |
| **W4: Settlement & Dispatch** | 80/20 escrow PO + Form-1 CPCB submission | ERP Agent, Legal Agent (Pydantic + DSC) |

## Quick Start (Local Development)

```bash
# 1. Start infrastructure (Temporal, Grafana, Prometheus, Ollama)
docker compose -f deploy/docker-compose.yml up -d

# 2. Install Python dependencies
pip install -e ".[dev]"

# 3. Start the Temporal worker
python -m synthetiq.worker

# 4. Start the API gateway
uvicorn api.main:app --reload --port 8000

# 5. Start the Next.js dashboard
cd dashboard && npm install && npm run dev

# 6. Access services:
#    Dashboard:    http://localhost:3000
#    API Docs:     http://localhost:8000/docs
#    Grafana:      http://localhost:3001
#    Temporal UI:  http://localhost:8080
```

## Deployment (Kubernetes + Helm)

```bash
# Full cluster deployment
helm upgrade --install synthetiq deploy/helm/synthetiq/ -f deploy/helm/synthetiq/values-prod.yaml

# Deploy a single pod (e.g., just the dashboard)
helm upgrade --install synthetiq deploy/helm/synthetiq/ --set dashboard.enabled=true --set api.enabled=false ...
```

## Tech Stack

- **Orchestration**: Temporal (Python SDK)
- **System 2 AI**: Gemini 3.8 Flash
- **System 1 AI**: TypeSafe Jev (Noul/Score primitives)
- **Privacy**: Gemma 2B via local Ollama
- **Zero-Trust**: Model Context Protocol (MCP)
- **Data**: BigQuery + Pub/Sub
- **Frontend**: Next.js 14 App Router
- **Observability**: Prometheus + Grafana + OpenTelemetry
- **CI/CD**: GitHub Actions + Helm 3
