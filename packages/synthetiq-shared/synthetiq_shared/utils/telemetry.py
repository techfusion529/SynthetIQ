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


def get_logger(name: str) -> logging.Logger:
    """Configures structured logger with consistent format."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        fmt = logging.Formatter(
            fmt='{"time":"%(asctime)s","level":"%(levelname)s","service":"%(name)s","message":"%(message)s"}',
            datefmt="%Y-%m-%dT%H:%M:%SZ",
        )
        handler.setFormatter(fmt)
        logger.addHandler(handler)
        log_level = os.getenv("LOG_LEVEL", "INFO").upper()
        logger.setLevel(getattr(logging, log_level, logging.INFO))
    return logger
