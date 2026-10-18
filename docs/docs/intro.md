---
id: intro
title: Welcome to SynthetIQ
sidebar_position: 1
---

# SynthetIQ Platform Documentation

**SynthetIQ** is an autonomous, multi-agent Extended Producer Responsibility (EPR) compliance, anti-fraud audit, and Continuous Double Auction (CDA) credit exchange engine designed for Indian regulatory compliance (Central Pollution Control Board - CPCB Form-1).

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
     +-----------------------------+
     |  SynthetIQ Temporal Worker  |
     | - Google ADK / Vertex AI    |
     | - Gemini 3.8 Flash Engine   |
     | - JEV Reflex Physics Engine |
     | - Nimble System 1 Fraud     |
     +-----------------------------+
```

---

## Core Capabilities

1. **Autonomous Multi-Agent Audit**: 8 specialized Google ADK agents running over Temporal.io workflows verifying plastic recycling compliance.
2. **JEV Reflex Physics & SCADA Verification**: Sub-second motor drive analysis verifying extruder VFD torque curves, power factors, and thermodynamic energy balances.
3. **Continuous Double Auction (CDA)**: Real-time dynamic order book with 80/20 escrow retention and automated statutory price corridors (30% to 100%).
4. **CPCB Form-1 Compliance Reporting**: Automated generation of digitally signed statutory inspection dossiers and PDF audit certificates.
5. **Full-Stack Observability**: End-to-end OpenTelemetry (OTel) distributed tracing, Prometheus metrics collection, and customized Grafana dashboards.

---

## Quick Navigation

- **[System Architecture](architecture/overview)**: Microservices topology, data flows, and state management.
- **[Grafana Dashboards](observability/dashboards)**: Guide to Pod health, SCADA telemetry, and workflow monitoring.
- **[OpenTelemetry APM](observability/opentelemetry)**: Distributed tracing pipeline, OTLP collector, and metric pushers.
- **[Kubernetes & Helm](deployment/kubernetes-helm)**: Complete deployment manual for Kubernetes clusters.
- **[API Reference](api-reference/rest-api)**: FastAPI endpoints, authentication, and HITL exception routing.
