"""OpenTelemetry and Prometheus observability utilities for SynthetIQ."""

from __future__ import annotations

import logging
import os
from typing import Any

try:
    from prometheus_client import Counter, Gauge, Histogram
except ImportError:
    # Dummy fallback when prometheus_client is not installed in local environment
    class _DummyMetric:
        def __init__(self, *args: Any, **kwargs: Any) -> None: pass
        def inc(self, *args: Any, **kwargs: Any) -> None: pass
        def set(self, *args: Any, **kwargs: Any) -> None: pass
        def observe(self, *args: Any, **kwargs: Any) -> None: pass
        def labels(self, *args: Any, **kwargs: Any) -> _DummyMetric: return self
    Counter = Gauge = Histogram = _DummyMetric  # type: ignore[misc, assignment]

# Standard Prometheus metrics
WORKFLOW_EXECUTION_COUNTER = Counter(
    "synthetiq_workflow_executions_total",
    "Total number of workflow runs initiated",
    ["workflow_name", "status"],
)

WORKFLOW_ACTIVE_GAUGE = Gauge(
    "synthetiq_workflow_active_total",
    "Current active compliance workflows",
)

WORKFLOW_DURATION_SECONDS = Histogram(
    "synthetiq_workflow_duration_seconds",
    "Workflow execution time in seconds",
    ["workflow_name"],
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
)

AUDIT_VERDICTS_COUNTER = Counter(
    "synthetiq_audit_verdicts_total",
    "Total fraud audit verdicts rendered",
    ["verdict", "plastic_category"],
)

SCADA_VERDICTS_COUNTER = Counter(
    "synthetiq_scada_verdicts_total",
    "Total SCADA audit verdicts rendered",
    ["result"],
)

TONNAGE_PROCESSED_COUNTER = Counter(
    "synthetiq_tonnage_processed_total",
    "Total tonnage processed for EPR credits",
)

COMPANY_COMPLIANCE_GAUGE = Gauge(
    "synthetiq_company_compliance_pct",
    "Compliance percentage by company",
    ["company_id"],
)

AUCTION_PRICE_GAUGE = Gauge(
    "synthetiq_auction_price_per_ton",
    "Current clearing auction price per ton",
)

AUCTION_CORRIDOR_MIN_GAUGE = Gauge(
    "synthetiq_auction_corridor_min",
    "Statutory auction price corridor min (30%)",
)

AUCTION_CORRIDOR_MAX_GAUGE = Gauge(
    "synthetiq_auction_corridor_max",
    "Statutory auction price corridor max (100%)",
)

ESCROW_RELEASED_COUNTER = Counter(
    "synthetiq_escrow_released_total",
    "Total escrow funds released (80%)",
)

ESCROW_HELD_COUNTER = Counter(
    "synthetiq_escrow_held_total",
    "Total escrow funds held in retention (20%)",
)

ESCROW_AMOUNT_INR_TOTAL = Counter(
    "synthetiq_escrow_settled_inr_total",
    "Total amount settled through 80/20 escrow (INR)",
    ["status"],
)

PLASTIC_TONS_VERIFIED = Counter(
    "synthetiq_plastic_tons_verified_total",
    "Total physical metric tons verified melted",
    ["category"],
)

ACTIVE_AUCTIONS_GAUGE = Gauge(
    "synthetiq_active_auctions",
    "Current active continuous double auctions",
)

SCADA_TORQUE_GAUGE = Gauge(
    "synthetiq_scada_torque_nm",
    "Real-time VFD shaft torque in Nm",
    ["plant_id"],
)

SCADA_POWER_FACTOR_GAUGE = Gauge(
    "synthetiq_scada_power_factor",
    "Real-time extruder motor power factor",
    ["plant_id"],
)

SCADA_ENERGY_EXPECTED_GAUGE = Gauge(
    "synthetiq_scada_energy_expected_kwh",
    "Thermodynamic theoretical expected energy (kWh)",
)

SCADA_ENERGY_METERED_GAUGE = Gauge(
    "synthetiq_scada_energy_metered_kwh",
    "Metered electrical energy (kWh)",
)

JEV_LATENCY_HISTOGRAM = Histogram(
    "synthetiq_jev_evaluation_duration_seconds",
    "Jev reflex physics evaluation latency in seconds",
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
)

MCP_PII_REDACTIONS_COUNTER = Counter(
    "synthetiq_mcp_pii_redactions_total",
    "Total PII entities scrubbed by Gemma 2B",
)

MCP_TOOL_DURATION_HISTOGRAM = Histogram(
    "synthetiq_mcp_tool_duration_seconds",
    "MCP Tool execution duration in seconds",
    ["tool"],
)

SCADA_STREAM_THROUGHPUT_GAUGE = Gauge(
    "synthetiq_scada_stream_throughput_readings_per_sec",
    "SCADA simulator telemetry streaming throughput",
)

SAGA_COMPENSATION_COUNTER = Counter(
    "synthetiq_saga_compensation_total",
    "Total saga compensation events executed",
)

SAGA_COMPENSATION_FAILED_COUNTER = Counter(
    "synthetiq_saga_compensation_failed_total",
    "Total saga compensation events that failed",
)


    return logger


# ---------------------------------------------------------------------------
# OpenTelemetry Provider Setup & APM Integration
# ---------------------------------------------------------------------------

_otel_tracer_provider: Any = None
_otel_meter_provider: Any = None


def setup_opentelemetry(
    service_name: str,
    endpoint: str | None = None,
    enable_tracing: bool = True,
    enable_metrics: bool = True,
) -> tuple[Any, Any]:
    """Setup OpenTelemetry TracerProvider and MeterProvider with OTLP export.

    Supports both HTTP (port 4318) and gRPC (port 4317) OTLP collectors.
    """
    global _otel_tracer_provider, _otel_meter_provider
    target_endpoint = endpoint or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT") or os.getenv("OTLP_ENDPOINT", "http://localhost:4318")

    try:
        from opentelemetry import metrics as otel_metrics, trace as otel_trace
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader

        resource = Resource.create({
            "service.name": service_name,
            "service.version": "0.1.0",
            "deployment.environment": os.getenv("ENVIRONMENT", "dev"),
            "k8s.pod.name": os.getenv("HOSTNAME", f"{service_name}-pod"),
        })

        base_endpoint = target_endpoint.rstrip("/")
        if base_endpoint.startswith("http://") or base_endpoint.startswith("https://") or ":4318" in base_endpoint:
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter as HTTPTraceExporter
            from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter as HTTPMetricExporter
            trace_url = base_endpoint if "/v1/traces" in base_endpoint else f"{base_endpoint}/v1/traces"
            metric_url = base_endpoint if "/v1/metrics" in base_endpoint else f"{base_endpoint}/v1/metrics"
            span_exp = HTTPTraceExporter(endpoint=trace_url)
            metric_exp = HTTPMetricExporter(endpoint=metric_url)
        else:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter as GRPCTraceExporter
            from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter as GRPCMetricExporter
            span_exp = GRPCTraceExporter(endpoint=base_endpoint, insecure=True)
            metric_exp = GRPCMetricExporter(endpoint=base_endpoint, insecure=True)

        if enable_tracing:
            _otel_tracer_provider = TracerProvider(resource=resource)
            _otel_tracer_provider.add_span_processor(BatchSpanProcessor(span_exp))
            otel_trace.set_tracer_provider(_otel_tracer_provider)

        if enable_metrics:
            reader = PeriodicExportingMetricReader(metric_exp, export_interval_millis=15000)
            _otel_meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
            otel_metrics.set_meter_provider(_otel_meter_provider)

        logger = get_logger(service_name)
        logger.info(f"OpenTelemetry configured successfully: {target_endpoint}")
    except Exception as e:
        logger = get_logger(service_name)
        logger.warning(f"OpenTelemetry setup skipped or failed: {e}")

    return _otel_tracer_provider, _otel_meter_provider
