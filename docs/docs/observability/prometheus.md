---
id: prometheus
title: Prometheus Metrics Catalog
sidebar_position: 4
---

# Prometheus Metrics Catalog

All custom metrics are registered in `synthetiq_shared.utils.telemetry`.

| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `synthetiq_workflow_active_total` | Gauge | - | Current active compliance workflows in progress |
| `synthetiq_workflow_executions_total` | Counter | `workflow_name`, `status` | Total number of workflow runs initiated |
| `synthetiq_workflow_duration_seconds` | Histogram | `workflow_name` | Workflow execution time in seconds |
| `synthetiq_scada_torque_nm` | Gauge | `plant_id` | Real-time motor VFD shaft torque in Nm |
| `synthetiq_scada_power_factor` | Gauge | `plant_id` | Extruder motor electrical power factor |
| `synthetiq_scada_energy_expected_kwh` | Gauge | - | Thermodynamic theoretical expected energy |
| `synthetiq_scada_energy_metered_kwh` | Gauge | - | Sub-metered electrical energy (kWh) |
| `synthetiq_scada_verdicts_total` | Counter | `result` | Total SCADA audit verdicts rendered |
| `synthetiq_tonnage_processed_total` | Counter | - | Cumulative physical metric tons verified melted |
| `synthetiq_mcp_pii_redactions_total` | Counter | - | Total PII entities scrubbed by Gemma 2B |
| `synthetiq_mcp_tool_duration_seconds`| Histogram | `tool` | MCP Tool execution duration in seconds |
| `synthetiq_scada_stream_throughput_readings_per_sec` | Gauge | - | SCADA stream generator readings per second |
| `synthetiq_otel_spans_total` | Counter | `service_name` | Total OpenTelemetry spans processed |
| `llm_calls_total` | Counter | `model` | Total LLM calls (Gemini 3.8 Flash, Gemma 2B) |
| `llm_tokens_total` | Counter | `model` | Total tokens consumed by LLMs |
| `llm_cost_usd` | Counter | `model` | Cumulative LLM expenditure in USD |
