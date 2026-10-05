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
