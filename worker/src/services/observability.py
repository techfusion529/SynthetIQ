"""Observability service with OpenTelemetry, cost tracking, and monitoring."""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

logger = logging.getLogger(__name__)


class ObservabilityService:
    """Central observability and cost tracking service."""

    def __init__(
        self,
        service_name: str = "synthetiq-worker",
        otlp_endpoint: str = "http://localhost:4318",
        enable_telemetry: bool = True,
    ) -> None:
        """Initialize observability service.

        Args:
            service_name: Service identifier
            otlp_endpoint: OpenTelemetry collector endpoint
            enable_telemetry: Whether to enable telemetry export
        """
        self.service_name = service_name
        self.enable_telemetry = enable_telemetry

        if enable_telemetry:
            self._setup_tracing(otlp_endpoint)
            self._setup_metrics(otlp_endpoint)

        # Get tracer and meter
        self.tracer = trace.get_tracer(__name__)
        self.meter = metrics.get_meter(__name__)

        # Create meters for different metrics
        self.llm_call_counter = self.meter.create_counter(
            "llm_calls_total",
            description="Total number of LLM API calls",
        )

        self.llm_token_counter = self.meter.create_counter(
            "llm_tokens_total",
            description="Total tokens consumed",
        )

        self.llm_cost_counter = self.meter.create_counter(
            "llm_cost_usd",
            description="Total LLM cost in USD",
        )

        self.llm_latency_histogram = self.meter.create_histogram(
            "llm_latency_seconds",
            description="LLM call latency",
        )

        self.agent_execution_counter = self.meter.create_counter(
            "agent_executions_total",
            description="Total agent executions",
        )

        self.fraud_detection_counter = self.meter.create_counter(
            "fraud_detections_total",
            description="Total fraud detections",
        )

        logger.info(f"Initialized ObservabilityService (telemetry={'on' if enable_telemetry else 'off'})")

    def _setup_tracing(self, otlp_endpoint: str) -> None:
        """Setup OpenTelemetry tracing."""
        resource = Resource.create({"service.name": self.service_name})

        tracer_provider = TracerProvider(resource=resource)
        span_exporter = OTLPSpanExporter(endpoint=f"{otlp_endpoint}/v1/traces")
        span_processor = BatchSpanProcessor(span_exporter)
        tracer_provider.add_span_processor(span_processor)

        trace.set_tracer_provider(tracer_provider)
        logger.info(f"OpenTelemetry tracing configured: {otlp_endpoint}")

    def _setup_metrics(self, otlp_endpoint: str) -> None:
        """Setup OpenTelemetry metrics."""
        resource = Resource.create({"service.name": self.service_name})

        metric_exporter = OTLPMetricExporter(endpoint=f"{otlp_endpoint}/v1/metrics")
        metric_reader = PeriodicExportingMetricReader(
            metric_exporter,
            export_interval_millis=60000,  # Export every 60 seconds
        )

        meter_provider = MeterProvider(
            resource=resource,
            metric_readers=[metric_reader],
        )

        metrics.set_meter_provider(meter_provider)
        logger.info(f"OpenTelemetry metrics configured: {otlp_endpoint}")

    @asynccontextmanager
    async def trace_llm_call(
        self,
        model: str,
        operation: str,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Trace LLM API call with timing and cost tracking.

        Usage:
            async with obs.trace_llm_call("gemini-2.0-flash", "analyze_regulatory"):
                result = await gemini.analyze_rules(text)

        Args:
            model: Model identifier
            operation: Operation name

        Yields:
            Context dict with metrics
        """
        start_time = time.time()
        context = {"input_tokens": 0, "output_tokens": 0, "cost": 0.0}

        with self.tracer.start_as_current_span(f"llm_{operation}") as span:
            span.set_attribute("llm.model", model)
            span.set_attribute("llm.operation", operation)

            try:
                yield context

                # Record metrics
                latency = time.time() - start_time

                self.llm_call_counter.add(
                    1,
                    {"model": model, "operation": operation, "status": "success"},
                )

                self.llm_latency_histogram.record(
                    latency,
                    {"model": model, "operation": operation},
                )

                if context["input_tokens"] > 0 or context["output_tokens"] > 0:
                    total_tokens = context["input_tokens"] + context["output_tokens"]
                    self.llm_token_counter.add(
                        total_tokens,
                        {"model": model, "token_type": "total"},
                    )

                if context["cost"] > 0:
                    self.llm_cost_counter.add(
                        context["cost"],
                        {"model": model},
                    )

                span.set_attribute("llm.input_tokens", context["input_tokens"])
                span.set_attribute("llm.output_tokens", context["output_tokens"])
                span.set_attribute("llm.cost_usd", context["cost"])
                span.set_attribute("llm.latency_seconds", latency)

            except Exception as e:
                self.llm_call_counter.add(
                    1,
                    {"model": model, "operation": operation, "status": "error"},
                )
                span.set_attribute("error", True)
                span.set_attribute("error.message", str(e))
                raise

    def track_agent_execution(
        self,
        agent_id: str,
        status: str,
        confidence: float = 0.0,
    ) -> None:
        """Track agent execution metrics.

        Args:
            agent_id: Agent identifier
            status: Execution status (success/failure)
            confidence: Confidence score
        """
        self.agent_execution_counter.add(
            1,
            {"agent_id": agent_id, "status": status},
        )

        with self.tracer.start_as_current_span("agent_execution") as span:
            span.set_attribute("agent.id", agent_id)
            span.set_attribute("agent.status", status)
            span.set_attribute("agent.confidence", confidence)

    def track_fraud_detection(
        self,
        verdict: str,
        confidence: float,
        is_spoofed: bool,
    ) -> None:
        """Track fraud detection metrics.

        Args:
            verdict: Detection verdict
            confidence: Confidence score
            is_spoofed: Whether fraud was detected
        """
        self.fraud_detection_counter.add(
            1,
            {
                "verdict": verdict,
                "is_spoofed": str(is_spoofed).lower(),
            },
        )

        with self.tracer.start_as_current_span("fraud_detection") as span:
            span.set_attribute("fraud.verdict", verdict)
            span.set_attribute("fraud.confidence", confidence)
            span.set_attribute("fraud.is_spoofed", is_spoofed)


class CostTracker:
    """Track and manage LLM API costs."""

    # Pricing per 1M tokens (as of 2024)
    PRICING = {
        "gemini-2.0-flash-exp": {
            "input": 0.0,  # Free tier during preview
            "output": 0.0,
        },
        "gemini-2.0-flash": {
            "input": 0.075,
            "output": 0.30,
        },
        "gemini-1.5-flash": {
            "input": 0.075,
            "output": 0.30,
        },
        "gemini-1.5-pro": {
            "input": 1.25,
            "output": 5.00,
        },
    }

    def __init__(self, monthly_budget_usd: float = 500.0) -> None:
        """Initialize cost tracker.

        Args:
            monthly_budget_usd: Monthly budget limit in USD
        """
        self.monthly_budget_usd = monthly_budget_usd
        self.current_month_cost = 0.0
        logger.info(f"Initialized CostTracker with monthly budget: ${monthly_budget_usd}")

    def calculate_cost(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> float:
        """Calculate cost for token usage.

        Args:
            model: Model identifier
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Cost in USD
        """
        pricing = self.PRICING.get(model, {"input": 0.075, "output": 0.30})

        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]

        return input_cost + output_cost

    def add_usage(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> dict[str, Any]:
        """Add token usage and calculate cost.

        Args:
            model: Model identifier
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Usage summary with cost and budget info
        """
        cost = self.calculate_cost(model, input_tokens, output_tokens)
        self.current_month_cost += cost

        budget_used_percent = (self.current_month_cost / self.monthly_budget_usd) * 100

        if budget_used_percent >= 80:
            logger.warning(
                f"⚠️ Budget alert: {budget_used_percent:.1f}% of monthly budget used "
                f"(${self.current_month_cost:.2f} / ${self.monthly_budget_usd:.2f})"
            )

        return {
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost,
            "total_month_cost_usd": self.current_month_cost,
            "monthly_budget_usd": self.monthly_budget_usd,
            "budget_used_percent": budget_used_percent,
        }


# Global instances
_observability_service: ObservabilityService | None = None
_cost_tracker: CostTracker | None = None


def initialize_observability(
    service_name: str = "synthetiq-worker",
    otlp_endpoint: str = "http://localhost:4318",
    enable_telemetry: bool = True,
    monthly_budget_usd: float = 500.0,
) -> tuple[ObservabilityService, CostTracker]:
    """Initialize global observability and cost tracking.

    Args:
        service_name: Service identifier
        otlp_endpoint: OTLP collector endpoint
        enable_telemetry: Whether to enable telemetry
        monthly_budget_usd: Monthly LLM budget

    Returns:
        Tuple of (ObservabilityService, CostTracker)
    """
    global _observability_service, _cost_tracker

    _observability_service = ObservabilityService(
        service_name=service_name,
        otlp_endpoint=otlp_endpoint,
        enable_telemetry=enable_telemetry,
    )

    _cost_tracker = CostTracker(monthly_budget_usd=monthly_budget_usd)

    return _observability_service, _cost_tracker


def get_observability() -> ObservabilityService:
    """Get global observability service."""
    if _observability_service is None:
        raise RuntimeError("ObservabilityService not initialized")
    return _observability_service


def get_cost_tracker() -> CostTracker:
    """Get global cost tracker."""
    if _cost_tracker is None:
        raise RuntimeError("CostTracker not initialized")
    return _cost_tracker
