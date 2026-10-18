---
id: dashboards
title: Grafana Pod Dashboards
sidebar_position: 2
---

# Grafana Dashboards Guide

SynthetIQ provides five production-grade dashboards auto-provisioned in folder **SynthetIQ**.

## 1. SynthetIQ — Pods & Services Infrastructure Health (`synthetiq-pod-health`)

Provides operational visibility into all Kubernetes pods running in the namespace.

- **Variables**:
  - `Namespace`: `synthetiq` or `default`
  - `Pod`: Multi-select dropdown filtering `synthetiq-api`, `synthetiq-worker`, `synthetiq-mcp`, `synthetiq-simulator`, `synthetiq-dashboard`, `postgres`, `redis`, `temporal`, `ollama`.
- **Panels**:
  - **Running Pods Count**: Real-time phase monitoring.
  - **Pod Restarts**: CrashLoopBackOff detection within the last 1 hour.
  - **Cluster Pod CPU Usage (cores)**: CPU consumption vs requests & limits.
  - **Pod Memory Working Set (RSS / Bytes)**: Working set memory vs OOM limits.
  - **CPU CFS Throttling Rate (%)**: Percentage of time intervals throttled by Kubernetes CPU limits.
  - **Network RX/TX Bandwidth**: Per-pod network receive and transmit rates.
  - **Microservices Health**:
    - API Pod HTTP Request Throughput & p95 Latency.
    - Worker Pod active workflows & JEV reflex physics evaluation latency.
    - MCP Pod tool execution duration & Gemma 2B PII redactions.
    - Simulator Pod SCADA telemetry streaming throughput (readings/sec).
  - **Infrastructure Pods**: PostgreSQL active backends & Redis connected clients.

---

## 2. SynthetIQ — OpenTelemetry (OTel) Distributed Traces & APM (`synthetiq-otel-apm`)

Tracks the OpenTelemetry ingestion pipeline and LLM performance:
- **Spans Ingested / sec**: Throughput across all services.
- **Trace Error Rate (%)**: Percentage of spans marked with `StatusCode.ERROR`.
- **End-to-End Latency Percentiles**: p50, p90, p95, and p99 trace duration.
- **LLM Token Consumption**: Prompt and completion token generation rates.
- **LLM Latency by Model**: Compares Gemini 3.8 Flash, Ollama Gemma 2B, and Nimble System 1.
- **Cumulative LLM Cost ($ USD)**: Tracks expenditures in real-time.
- **OTel Collector Pipeline**: Sent vs dropped metric points and batch processor queue sizes.

---

## 3. SynthetIQ — EPR Compliance Overview (`synthetiq-overview`)

Executive view of compliance targets:
- Active compliance workflows & total tonnage verified.
- Fraud detection rate (%) across recycler submissions.
- Auction clearing price vs statutory corridor (30% to 100%).
- Escrow settlement status (80% released vs 20% retention held).

---

## 4. SynthetIQ — SCADA Audit Telemetry (`synthetiq-scada-audit`)

- Real-time VFD shaft torque curves (Nm).
- Inductive vs resistive power factor signatures.
- Expected thermodynamic energy vs metered electrical energy balance.
- JEV reflex evaluation latency distribution.

---

## 5. SynthetIQ — Temporal Workflows (`synthetiq-temporal`)

- End-to-end workflow execution latency percentiles.
- Activity task retries and failure rates.
- Saga compensation transactions and rollbacks.
