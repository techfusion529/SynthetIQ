---
id: overview
title: Observability Architecture
sidebar_position: 1
---

# Observability Architecture

SynthetIQ features a unified telemetry stack combining **OpenTelemetry (OTel)**, **Prometheus**, and **Grafana** to monitor every pod, microservice, agent activity, and hardware sensor.

```
+-----------------------------------------------------------------------------------------+
|                                    SynthetIQ Pods                                       |
|  [synthetiq-api]       [synthetiq-worker]       [synthetiq-mcp]      [synthetiq-simulator]  |
+-----------------------------------------------------------------------------------------+
        |  (OTel Traces & Spans via HTTP/gRPC :4318 / :4317)
        |  (Prometheus Metrics via /metrics :8000, :9090, :8001, :9091)
        v
+-------------------------------+             +----------------------------------+
|   OpenTelemetry Collector     |             |      Prometheus Server           |
|   (synthetiq-otel-collector)  |             |      (synthetiq-prometheus)      |
|   - OTLP gRPC (:4317)         |             |      - Scrapes App Pods (:metrics|
|   - OTLP HTTP (:4318)         |             |      - Scrapes OTel Col (:8889)  |
|   - Prometheus Exporter(:8889)+------------>|      - Retention: 7 days         |
+-------------------------------+             +-----------------+----------------+
                                                                |
                                                                v
                                              +----------------------------------+
                                              |       Grafana Dashboards         |
                                              |       (synthetiq-grafana)        |
                                              |  1. Pods & Services Health       |
                                              |  2. OpenTelemetry APM & Traces   |
                                              |  3. EPR Compliance Overview      |
                                              |  4. SCADA Audit Telemetry        |
                                              |  5. Temporal Workflow Sagas      |
                                              +----------------------------------+
```

## Key Components

1. **In-Pod OpenTelemetry SDK**: Instrumenting FastAPI, Temporal worker activities, and LLM calls.
2. **OpenTelemetry Collector (`otel-collector`)**: Central pipeline aggregator that batches spans and exports metric points to Prometheus on port `8889`.
3. **Prometheus TSDB**: Scrapes both direct pod `/metrics` endpoints and aggregated collector telemetry.
4. **Grafana Auto-Provisioning**: Mounts dashboards directly from Kubernetes ConfigMaps in the `synthetiq` namespace.
