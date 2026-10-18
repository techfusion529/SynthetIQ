---
id: docker-compose
title: Local Docker Compose Stack
sidebar_position: 2
---

# Local Development Stack

For development and testing, SynthetIQ runs with Docker Compose.

## 1. Full Development Stack

```bash
docker compose up -d
```

Starts the application services:
- API Gateway (`http://localhost:8000`)
- Executive Dashboard (`http://localhost:3000`)
- Temporal Worker (`worker:9090`)
- Documentation Portal (`http://localhost:3002/docs/`)

## 2. Auxiliary Observability & Infrastructure Stack

```bash
docker compose -f deploy/docker-compose.yml up -d
```

Starts:
- OpenTelemetry Collector (`http://localhost:4318`, `localhost:4317`)
- Prometheus (`http://localhost:9090`)
- Grafana (`http://localhost:3001` with dashboards auto-provisioned)
- Temporal Server & UI (`http://localhost:8080`)
- Google Cloud Pub/Sub Emulator (`localhost:8085`)
- Docusaurus Documentation (`http://localhost:3002/docs/`)
