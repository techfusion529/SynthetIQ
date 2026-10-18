---
id: kubernetes-helm
title: Kubernetes & Helm Deployment
sidebar_position: 1
---

# Kubernetes & Helm Deployment

SynthetIQ is packaged as a Helm 3 chart in [`deploy/helm/synthetiq`](file:///c:/Users/HP/SynthetIQ/deploy/helm/synthetiq) targeting Google Kubernetes Engine (GKE) or any CNCF-compliant Kubernetes cluster.

## Deployment Architecture

All pods and ingress resources run within the designated namespace:
- **Namespace**: `synthetiq`
- **Domain**: `synthetiq.ddns.net` (or custom hostname)
- **Ingress Controller**: `nginx-ingress`

## Deploying / Upgrading the Stack

```bash
# Production deployment with GKE overrides
helm upgrade --install synthetiq deploy/helm/synthetiq/ \
  -n synthetiq --create-namespace \
  -f deploy/helm/synthetiq/values-prod.yaml
```

## Pod Fleet in the `synthetiq` Namespace

| Pod Deployment | Replicas | Role |
| :--- | :--- | :--- |
| `synthetiq-dashboard` | 1 | Executive Next.js 14 Frontend (`/`) |
| `synthetiq-api` | 1 | FastAPI Gateway (`/api`) |
| `synthetiq-worker` | 1 | Temporal Worker with Gemini 3.8 Flash |
| `synthetiq-mcp` | 1 | MCP Tool Execution Gateway |
| `synthetiq-simulator` | 1 | High-Speed SCADA Generator |
| `synthetiq-docs` | 1 | Docusaurus Documentation Portal (`/docs`) |
| `synthetiq-otel-collector` | 1 | OpenTelemetry Collector (`:4317`, `:4318`, `:8889`) |
| `synthetiq-prometheus` | 1 | Prometheus Time-Series Database (`:9090`) |
| `grafana` | 1 | Grafana Visualizations (`/grafana`) |
| `synthetiq-temporal-server` | 1 | Temporal.io Orchestration Engine (`:7233`) |
| `synthetiq-temporal-ui` | 1 | Temporal Web UI (`/temporal`) |
| `synthetiq-postgres` | 1 | Application State & Tenant PostgreSQL |
| `synthetiq-redis` | 1 | Cache & Agent Memory Store |

---

## Verifying Deployment Status

```bash
# Check all running pods in the namespace:
kubectl get pods -n synthetiq -o wide

# Check ingresses:
kubectl get ingress -n synthetiq

# Check Grafana dashboard configmaps:
kubectl get configmaps -n synthetiq | grep grafana
```
