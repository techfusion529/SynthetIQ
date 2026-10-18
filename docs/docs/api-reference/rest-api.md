---
id: rest-api
title: FastAPI Gateway Endpoints
sidebar_position: 1
---

# FastAPI Gateway Endpoints

The API Gateway is reachable at `/api` (or `http://localhost:8000`).

## Key Endpoints

### 1. Health & Readiness
- `GET /health`: Basic liveness check.
- `GET /metrics`: Prometheus metric exposition.

### 2. Audit & Verification
- `POST /api/v1/audit/trigger`: Initiates a fraud & physics evaluation workflow.
  ```json
  {
    "recycler_id": "RECYC-DELHI-01",
    "plant_id": "PLANT-OKHLA-2",
    "category": "cat_i_rigid",
    "volume_tons": 250.0,
    "simulate_spoof": false
  }
  ```
- `GET /api/v1/audit/exceptions`: Returns list of audits requiring Human-in-the-Loop review.
- `POST /api/v1/audit/exceptions/{audit_id}/resolve`: Posts a compliance officer approval or rejection signal.

### 3. Statutory Reporting
- `GET /api/v1/audit/report/{audit_id}/pdf`: Downloads authenticated CPCB Form-1 PDF audit certificate.
- `GET /api/v1/audit/report/{audit_id}/json`: Returns structured CPCB Form-1 JSON dossier.
