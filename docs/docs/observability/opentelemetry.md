---
id: opentelemetry
title: OpenTelemetry (OTel) Pipeline
sidebar_position: 3
---

# OpenTelemetry (OTel) Pipeline & Pusher

SynthetIQ implements OpenTelemetry for distributed tracing, metrics export, and APM analysis.

## Collector Configuration

The OpenTelemetry Collector is deployed in Kubernetes as `synthetiq-otel-collector` and runs in Docker Compose as `otel-collector`.

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 256
  memory_limiter:
    check_interval: 1s
    limit_percentage: 75
    spike_limit_percentage: 20

exporters:
  prometheus:
    endpoint: 0.0.0.0:8889
    namespace: "synthetiq"
    send_timestamps: true
  debug:
    verbosity: normal
```

---

## Pushing Telemetry with the Verification Script

SynthetIQ includes a CLI tool (`scripts/push_otel_telemetry.py`) to emit full distributed traces and metrics to the OTel collector.

### Usage Examples

```bash
# Push 5 cycles of realistic spans and metrics to deployed cluster:
python scripts/push_otel_telemetry.py --endpoint http://synthetiq.ddns.net:4318 --iterations 5

# Stream continuously every 5 seconds (ideal for live demo):
python scripts/push_otel_telemetry.py --endpoint http://synthetiq.ddns.net:4318 --iterations 0 --interval 5.0

# Push to local Docker Compose stack:
python scripts/push_otel_telemetry.py --endpoint http://localhost:4318 --iterations 3

# Test in console without network:
python scripts/push_otel_telemetry.py --console --iterations 1
```

### Trace Span Hierarchy Emitted

1. `HTTP POST /api/v1/audit/trigger` (Server Span)
   - `Temporal Workflow: MasterEPRComplianceWorkflow` (Internal)
     - `Activity: run_quad_core_audit` (Internal)
       - `JEV Reflex: Thermodynamic Verification` (Internal)
       - `Nimble System 1: Real-Time Fraud Classifier` (Internal)
       - `Gemini 3.8 Flash: EPR Statutory Assessment` (Client)
     - `Activity: generate_cpcb_form1_pdf` (Internal)
