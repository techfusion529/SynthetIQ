# SynthetIQ Setup Guide - Real Multi-Agent AI System

This guide will help you set up SynthetIQ with real AI integrations, not mocks.

## Prerequisites

- Python 3.13+
- Node.js 18+ (for dashboard)
- Docker & Docker Compose
- Google Cloud account (for BigQuery, Pub/Sub)
- Google AI Studio API key (for Gemini)
- Ollama (for local Gemma 2B privacy layer)

---

## Step 1: Environment Configuration

### 1.1 Copy Environment Template

```bash
cp .env.example .env
```

### 1.2 Configure Google Gemini API

1. Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add to `.env`:

```env
GEMINI_API_KEY=AIzaSy...your_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
```

### 1.3 Configure Google Cloud (Optional but Recommended)

For real BigQuery and Pub/Sub integration:

```env
GCP_PROJECT_ID=your-project-id
GCP_REGION=asia-south1
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json
```

Create service account:
```bash
# Create service account
gcloud iam service-accounts create synthetiq-worker \
    --display-name="SynthetIQ Worker Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:synthetiq-worker@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:synthetiq-worker@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/pubsub.subscriber"

# Download key
gcloud iam service-accounts keys create ./credentials/service-account.json \
    --iam-account=synthetiq-worker@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 1.4 Configure Ollama for Privacy Layer

Install Ollama:
```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

Pull Gemma 2B model:
```bash
ollama pull gemma2:2b
```

Update `.env`:
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=gemma2:2b
OLLAMA_ENABLE_PII_SCRUBBING=true
```

---

## Step 2: Install Dependencies

### 2.1 Install Python Dependencies

```bash
# Install uv (fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install all workspace dependencies
uv pip install -e ".[dev]"

# Or manually for each service:
cd worker && uv pip install -e .
cd ../api && uv pip install -e .
cd ../mcp && uv pip install -e .
```

### 2.2 Install Dashboard Dependencies

```bash
cd dashboard
npm install
```

---

## Step 3: Start Infrastructure Services

```bash
# Start Temporal, Redis, Prometheus, Grafana
docker compose -f deploy/docker-compose.yml up -d

# Verify services are running
docker compose ps
```

Expected services:
- `temporal`: Temporal server (port 7233)
- `temporal-ui`: Temporal Web UI (port 8080)
- `redis`: Redis for agent memory (port 6379)
- `prometheus`: Metrics collection (port 9090)
- `grafana`: Dashboards (port 3001)

---

## Step 4: Configure BigQuery (Optional)

If using real BigQuery data:

### 4.1 Create Dataset and Table

```sql
-- Create dataset
CREATE SCHEMA IF NOT EXISTS epr_compliance;

-- Create sales data table
CREATE TABLE epr_compliance.sales_data (
    record_id STRING,
    company_id STRING,
    fiscal_year STRING,
    product_sku STRING,
    plastic_category STRING,
    plastic_weight_kg FLOAT64,
    units_sold INT64,
    state_code STRING,
    invoice_date DATE
);

-- Load sample data
INSERT INTO epr_compliance.sales_data VALUES
    ('REC-001', 'COMP-IN-001', 'FY2026-27', 'SKU-BOTTLE-500ML', 'cat_i_rigid', 0.025, 300000000, 'MH', '2026-01-15'),
    ('REC-002', 'COMP-IN-001', 'FY2026-27', 'SKU-POUCH-1KG', 'cat_ii_flexible', 0.010, 620000000, 'DL', '2026-01-20');
```

Update `.env`:
```env
BIGQUERY_DATASET_ID=epr_compliance
BIGQUERY_SALES_TABLE=sales_data
```

---

## Step 5: Train Fraud Detection Model (Optional)

For ML-based SCADA fraud detection:

```bash
# Create models directory
mkdir -p models

# Train model (you'll need SCADA training data)
python scripts/train_fraud_model.py --output models/scada_fraud_detector_v1.pkl
```

Or use the default built-in model:
```env
JEV_MODE=HYBRID_ENSEMBLE  # Uses built-in Isolation Forest + physics rules
```

---

## Step 6: Start Services

### 6.1 Start Temporal Worker

```bash
cd worker
python -m src.main
```

Expected output:
```
INFO: Initialized GeminiAIService with model=gemini-2.0-flash-exp
INFO: Initialized JevSystem1Auditor in HYBRID_ENSEMBLE mode
INFO: Initialized PrivacyService with Ollama
INFO: Connected to Temporal
============================================================
🚀 SynthetIQ Temporal Worker Started Successfully!
============================================================
```

### 6.2 Start API Gateway

```bash
cd api
uvicorn src.main:app --reload --port 8000
```

### 6.3 Start Dashboard

```bash
cd dashboard
npm run dev
```

Access at: http://localhost:3000

---

## Step 7: Verify Installation

### 7.1 Check Configuration

```bash
curl http://localhost:8000/api/v1/config | jq
```

Should show:
```json
{
  "gemini": {
    "model": "gemini-2.0-flash-exp",
    "is_key_provided": true
  },
  "jev": {
    "mode": "HYBRID_ENSEMBLE",
    "model_loaded": true
  },
  "privacy": {
    "enabled": true,
    "ollama_available": true
  }
}
```

### 7.2 Test End-to-End Workflow

```bash
curl -X POST http://localhost:8000/api/v1/compliance/run-e2e \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "COMP-IN-001",
    "fiscal_year": "FY2026-27",
    "category": "cat_i_rigid",
    "volume_tons": 250.0,
    "simulate_spoof": false
  }'
```

Expected response:
```json
{
  "run_id": "RUN-20260929-A1B2C3",
  "status": "SUCCESS_FULLY_COMPLIANT",
  "message": "End-to-End EPR lifecycle executed successfully",
  "steps": [
    {"step": 1, "name": "Upstream Liability Ingestion", "status": "COMPLETED"},
    {"step": 2, "name": "Continuous Double Auction", "status": "COMPLETED"},
    {"step": 3, "name": "Quad-Core Fraud Audit", "status": "COMPLETED"},
    {"step": 4, "name": "80/20 Escrow Gate & SAP PO", "status": "COMPLETED"},
    {"step": 5, "name": "CPCB Form-1 Statutory Vault", "status": "COMPLETED"}
  ]
}
```

### 7.3 View Temporal Workflow

Open Temporal UI: http://localhost:8080

Search for workflow ID from the response.

---

## Step 8: Monitor Costs

### Check Token Usage

```bash
curl http://localhost:8000/api/v1/config/cost-report | jq
```

Response:
```json
{
  "current_month_usage": {
    "total_cost_usd": 1.25,
    "total_tokens": 45230,
    "total_calls": 12
  },
  "budget": {
    "monthly_budget_usd": 500.0,
    "used_percent": 0.25,
    "remaining_usd": 498.75
  }
}
```

### View Grafana Dashboards

1. Open Grafana: http://localhost:3001
2. Default credentials: `admin` / `admin`
3. Navigate to "SynthetIQ Overview" dashboard

Metrics available:
- LLM API calls per minute
- Token consumption rate
- Cost per workflow execution
- Fraud detection accuracy
- Agent execution times

---

## Troubleshooting

### Issue: "GEMINI_API_KEY is required"

**Solution:** Verify API key in `.env`:
```bash
grep GEMINI_API_KEY .env
```

Get a new key from: https://aistudio.google.com/app/apikey

### Issue: "Ollama not available"

**Solution:** Check Ollama is running:
```bash
ollama serve  # Start Ollama server
ollama list   # Verify gemma2:2b is installed
```

### Issue: "BigQuery query failed"

**Solution:** 
1. Verify service account has permissions
2. Check credentials file exists:
```bash
ls -la ./credentials/service-account.json
```
3. Set `ENABLE_MOCK_MODE=true` in `.env` to use fallback data

### Issue: "Temporal connection refused"

**Solution:**
```bash
docker compose -f deploy/docker-compose.yml up -d temporal
docker compose ps temporal
```

### Issue: High LLM costs

**Solution:**
1. Reduce `GEMINI_MAX_TOKENS` in `.env` (default: 8192)
2. Switch to cheaper model:
```env
GEMINI_MODEL=gemini-2.0-flash-exp  # Free during preview
```
3. Enable caching (coming soon)

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Dashboard      │────▶│  FastAPI Gateway │────▶│ Temporal Worker │
│  (Next.js)      │     │  (API Routes)    │     │  (Workflows)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                                           ▼
                        ┌──────────────────────────────────────────┐
                        │         Multi-Agent System               │
                        │  ┌────────────────────────────────────┐  │
                        │  │  Agent Orchestration (LangGraph)   │  │
                        │  └────────────────────────────────────┘  │
                        │                                          │
                        │  ┌──────────┐  ┌──────────┐            │
                        │  │ Gemini   │  │   Jev    │            │
                        │  │  Flash   │  │ Auditor  │            │
                        │  │ (System2)│  │(System1) │            │
                        │  └──────────┘  └──────────┘            │
                        │                                          │
                        │  ┌──────────────────────────────────┐  │
                        │  │ Privacy Layer (Gemma 2B/Ollama)  │  │
                        │  └──────────────────────────────────┘  │
                        └──────────────────────────────────────────┘
                                         │
                                         ▼
                  ┌────────────────────────────────────────┐
                  │      MCP Tools (Zero-Trust Layer)      │
                  │  • BigQuery (ERP Data)                 │
                  │  • Pub/Sub (SCADA Telemetry)           │
                  │  • CPCB API (Government Portal)        │
                  │  • GST API (E-Way Bill)                │
                  └────────────────────────────────────────┘
```

---

## Next Steps

1. **Production Deployment**: See `deploy/helm/synthetiq/` for Kubernetes deployment
2. **Add Real APIs**: Integrate CPCB and GST government APIs
3. **Train Custom Models**: Use real SCADA data to train fraud detection models
4. **Scale Workers**: Deploy multiple Temporal workers for high throughput
5. **Add Monitoring**: Configure Grafana alerts for cost and fraud detection

---

## Support

- GitHub Issues: https://github.com/yourorg/synthetiq/issues
- Documentation: https://docs.synthetiq.ai
- Email: support@synthetiq.ai

---

## License

MIT License - See LICENSE file for details
