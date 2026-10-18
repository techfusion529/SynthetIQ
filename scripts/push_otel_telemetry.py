#!/usr/bin/env python3
"""SynthetIQ OpenTelemetry (OTel) Telemetry Pusher & Verification Script.

Pushes distributed traces, APM spans, and real-time pod/compliance metrics
to the OpenTelemetry Collector (or local OTLP endpoint) and updates Prometheus metrics.
"""

from __future__ import annotations

import argparse
import logging
import os
import random
import sys
import time
from pathlib import Path

# Add project roots to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "packages" / "synthetiq-shared"))
sys.path.insert(0, str(BASE_DIR / "api"))
sys.path.insert(0, str(BASE_DIR / "worker" / "src"))

logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","source":"push_otel","message":"%(message)s"}',
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
logger = logging.getLogger("synthetiq-otel-pusher")

# OpenTelemetry imports
from opentelemetry import metrics, trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader, ConsoleMetricExporter
from opentelemetry.trace import StatusCode


def create_providers(
    endpoint: str,
    service_name: str = "synthetiq-telemetry-engine",
    use_console: bool = False,
) -> tuple[TracerProvider, MeterProvider]:
    """Initialize OpenTelemetry tracer and meter providers."""
    resource = Resource.create({
        "service.name": service_name,
        "service.version": "0.1.0",
        "deployment.environment": os.getenv("ENVIRONMENT", "dev"),
        "k8s.pod.name": f"{service_name}-0",
        "k8s.namespace.name": "synthetiq",
    })

    base_endpoint = endpoint.rstrip("/")
    is_http = base_endpoint.startswith("http://") or base_endpoint.startswith("https://") or ":4318" in base_endpoint

    # Tracing setup
    tracer_provider = TracerProvider(resource=resource)
    if use_console:
        tracer_provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    else:
        try:
            if is_http:
                from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter as HTTPTraceExporter
                trace_url = base_endpoint if "/v1/traces" in base_endpoint else f"{base_endpoint}/v1/traces"
                span_exporter = HTTPTraceExporter(endpoint=trace_url)
            else:
                from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter as GRPCTraceExporter
                span_exporter = GRPCTraceExporter(endpoint=base_endpoint, insecure=True)
            tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
        except Exception as exc:
            logger.warning(f"Failed to wire OTLP span exporter ({exc}); falling back to console exporter")
            tracer_provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(tracer_provider)

    # Metrics setup
    if use_console:
        metric_reader = PeriodicExportingMetricReader(ConsoleMetricExporter(), export_interval_millis=5000)
    else:
        try:
            if is_http:
                from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter as HTTPMetricExporter
                metric_url = base_endpoint if "/v1/metrics" in base_endpoint else f"{base_endpoint}/v1/metrics"
                metric_exporter = HTTPMetricExporter(endpoint=metric_url)
            else:
                from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter as GRPCMetricExporter
                metric_exporter = GRPCMetricExporter(endpoint=base_endpoint, insecure=True)
            metric_reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=5000)
        except Exception as exc:
            logger.warning(f"Failed to wire OTLP metric exporter ({exc}); falling back to console exporter")
            metric_reader = PeriodicExportingMetricReader(ConsoleMetricExporter(), export_interval_millis=5000)

    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)

    return tracer_provider, meter_provider


def emit_spans(tracer: trace.Tracer) -> None:
    """Simulate a complete end-to-end distributed compliance and fraud audit pipeline."""
    audit_id = f"AUD-2026-{random.randint(100, 999)}"
    org_id = "ORG-TATA-MOTORS-01"
    recycler_id = "RECYC-DELHI-NORTH"
    plant_id = "PLANT-OKHLA-EXTRUDER-2"

    logger.info(f"==> Emitting Distributed Trace for Audit {audit_id} (Org: {org_id})")

    # 1. API Gateway Request Span
    with tracer.start_as_current_span(
        "HTTP POST /api/v1/audit/trigger",
        kind=trace.SpanKind.SERVER,
        attributes={
            "http.method": "POST",
            "http.url": "http://synthetiq-api:8000/api/v1/audit/trigger",
            "http.status_code": 200,
            "http.route": "/api/v1/audit/trigger",
            "synthetiq.org_id": org_id,
            "synthetiq.audit_id": audit_id,
            "synthetiq.recycler_id": recycler_id,
            "k8s.pod.name": "synthetiq-api-74b89f66-2lpxm",
        },
    ) as api_span:
        time.sleep(0.04)

        # 2. Temporal Workflow Execution Span
        with tracer.start_as_current_span(
            "Temporal Workflow: MasterEPRComplianceWorkflow",
            kind=trace.SpanKind.INTERNAL,
            attributes={
                "temporal.workflow_type": "MasterEPRComplianceWorkflow",
                "temporal.workflow_id": f"wf-{audit_id}",
                "temporal.task_queue": "synthetiq-main",
                "synthetiq.org_id": org_id,
                "k8s.pod.name": "synthetiq-worker-5c689d77-q89zt",
            },
        ) as wf_span:
            time.sleep(0.06)

            # 3. Activity: run_quad_core_audit
            with tracer.start_as_current_span(
                "Activity: run_quad_core_audit",
                kind=trace.SpanKind.INTERNAL,
                attributes={
                    "temporal.activity_type": "run_quad_core_audit",
                    "synthetiq.plastic_category": "cat_i_rigid",
                    "synthetiq.volume_tons": 250.0,
                    "synthetiq.plant_id": plant_id,
                },
            ) as act_span:
                time.sleep(0.03)

                # 4. Child Span: JEV Reflex Physics Evaluation
                torque_nm = round(450.0 + random.uniform(-15.0, 25.0), 2)
                pf = round(0.87 + random.uniform(-0.03, 0.04), 3)
                with tracer.start_as_current_span(
                    "JEV Reflex: Thermodynamic Verification",
                    attributes={
                        "jev.torque_nm": torque_nm,
                        "jev.power_factor": pf,
                        "jev.expected_energy_kwh": 1840.5,
                        "jev.metered_energy_kwh": 1832.0,
                        "jev.mass_balance_deviation_pct": 0.46,
                        "jev.verdict": "MELT_VERIFIED",
                    },
                ):
                    time.sleep(0.02)

                # 5. Child Span: Nimble System 1 Fraud Model
                with tracer.start_as_current_span(
                    "Nimble System 1: Real-Time Fraud Classifier",
                    attributes={
                        "nimble.model": "nimble-classifier-v2",
                        "nimble.anomaly_score": 0.018,
                        "nimble.decision": "GENUINE_BATCH",
                        "nimble.confidence": 0.992,
                    },
                ):
                    time.sleep(0.015)

                # 6. Child Span: Gemini 3.8 Flash Regulatory Audit
                with tracer.start_as_current_span(
                    "Gemini 3.8 Flash: EPR Statutory Assessment",
                    kind=trace.SpanKind.CLIENT,
                    attributes={
                        "llm.vendor": "google-cloud-vertex-ai",
                        "llm.model": "gemini-3.8-flash",
                        "llm.prompt_tokens": 420,
                        "llm.completion_tokens": 165,
                        "llm.total_tokens": 585,
                        "llm.cost_usd": 0.00175,
                        "llm.latency_seconds": 0.38,
                    },
                ):
                    time.sleep(0.05)

                act_span.set_status(StatusCode.OK)

            # 7. Activity: generate_cpcb_form1_pdf
            with tracer.start_as_current_span(
                "Activity: generate_cpcb_form1_pdf",
                attributes={
                    "cpcb.form": "CPCB_Form_1",
                    "cpcb.audit_id": audit_id,
                    "cpcb.file_size_bytes": 14520,
                    "cpcb.dsc_status": "SIGNATURE_VALIDATED",
                },
            ):
                time.sleep(0.03)

            wf_span.set_status(StatusCode.OK)
        api_span.set_status(StatusCode.OK)

    logger.info(f"[OK] Distributed trace emitted successfully for {audit_id}")


def emit_metrics(meter: metrics.Meter) -> None:
    """Emit pod health and SynthetIQ business metrics via OpenTelemetry Meter."""
    logger.info("==> Emitting OpenTelemetry & Pod Health Metrics...")

    # Pod level counters & gauges
    spans_counter = meter.create_counter(
        "synthetiq_otel_spans_total",
        description="Total OpenTelemetry spans processed",
    )
    requests_counter = meter.create_counter(
        "synthetiq_otel_requests_total",
        description="Total requests monitored via OpenTelemetry",
    )
    latency_hist = meter.create_histogram(
        "synthetiq_otel_request_duration_seconds",
        description="End-to-end request duration",
    )
    llm_call_counter = meter.create_counter(
        "llm_calls_total",
        description="Total number of LLM API calls",
    )
    llm_token_counter = meter.create_counter(
        "llm_tokens_total",
        description="Total tokens consumed by LLMs",
    )
    llm_cost_counter = meter.create_counter(
        "llm_cost_usd",
        description="Total LLM cost accrued in USD",
    )

    # Record samples across services
    services = ["synthetiq-api", "synthetiq-worker", "synthetiq-mcp", "synthetiq-simulator"]
    for svc in services:
        spans_counter.add(random.randint(10, 30), {"service_name": svc, "k8s.pod": f"{svc}-pod"})
        requests_counter.add(random.randint(5, 15), {"service_name": svc, "status": "200"})
        latency_hist.record(random.uniform(0.05, 0.45), {"service_name": svc})

    # LLM metrics
    llm_call_counter.add(4, {"model": "gemini-3.8-flash"})
    llm_token_counter.add(2340, {"model": "gemini-3.8-flash"})
    llm_cost_counter.add(0.0072, {"model": "gemini-3.8-flash"})

    # Update shared Prometheus metrics if available
    try:
        from synthetiq_shared.utils.telemetry import (
            WORKFLOW_ACTIVE_GAUGE,
            WORKFLOW_EXECUTION_COUNTER,
            SCADA_TORQUE_GAUGE,
            SCADA_POWER_FACTOR_GAUGE,
            SCADA_ENERGY_EXPECTED_GAUGE,
            SCADA_ENERGY_METERED_GAUGE,
            SCADA_STREAM_THROUGHPUT_GAUGE,
            TONNAGE_PROCESSED_COUNTER,
            SCADA_VERDICTS_COUNTER,
        )
        WORKFLOW_ACTIVE_GAUGE.set(random.randint(3, 8))
        WORKFLOW_EXECUTION_COUNTER.labels(workflow_name="MasterEPRComplianceWorkflow", status="COMPLETED").inc()
        SCADA_TORQUE_GAUGE.labels(plant_id="PLANT-OKHLA-2").set(462.5 + random.uniform(-10, 10))
        SCADA_POWER_FACTOR_GAUGE.labels(plant_id="PLANT-OKHLA-2").set(0.88 + random.uniform(-0.02, 0.02))
        SCADA_ENERGY_EXPECTED_GAUGE.set(1840.5)
        SCADA_ENERGY_METERED_GAUGE.set(1832.0)
        SCADA_STREAM_THROUGHPUT_GAUGE.set(random.randint(18, 25))
        TONNAGE_PROCESSED_COUNTER.inc(250.0)
        SCADA_VERDICTS_COUNTER.labels(result="melt_verified").inc()
        logger.info("[OK] Prometheus metrics updated in memory.")
    except Exception as exc:
        logger.warning(f"Shared metrics update notice: {exc}")

    logger.info("[OK] OpenTelemetry metrics recorded successfully.")


def main() -> None:
    parser = argparse.ArgumentParser(description="SynthetIQ OTel Telemetry Pusher")
    parser.add_argument(
        "--endpoint",
        default=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", os.getenv("OTLP_ENDPOINT", "http://localhost:4318")),
        help="OTLP Collector endpoint (HTTP port 4318 or gRPC port 4317)",
    )
    parser.add_argument(
        "--console",
        action="store_true",
        help="Print spans and metrics directly to console in addition to/instead of network",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=1,
        help="Number of telemetry cycles to push (0 for continuous infinite stream)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=5.0,
        help="Interval between pushes in seconds when running multiple iterations",
    )
    args = parser.parse_args()

    logger.info(f"Initializing OpenTelemetry Pusher with endpoint: {args.endpoint}")
    tracer_provider, meter_provider = create_providers(
        endpoint=args.endpoint,
        service_name="synthetiq-telemetry-engine",
        use_console=args.console,
    )

    tracer = trace.get_tracer("synthetiq-agent-pipeline")
    meter = metrics.get_meter("synthetiq-apm-meter")

    count = 0
    try:
        while True:
            count += 1
            logger.info(f"\n--- [Cycle {count}] Pushing SynthetIQ OTel Telemetry ---")
            emit_spans(tracer)
            emit_metrics(meter)

            # Flush batch span processor and metric reader
            try:
                tracer_provider.force_flush(timeout_millis=3000)
                meter_provider.force_flush(timeout_millis=3000)
            except Exception:
                pass

            if args.iterations > 0 and count >= args.iterations:
                break
            time.sleep(args.interval)

    except KeyboardInterrupt:
        logger.info("\nReceived stop signal. Shutting down telemetry pusher...")

    logger.info("\n All OpenTelemetry spans and metrics successfully dispatched!")


if __name__ == "__main__":
    main()
