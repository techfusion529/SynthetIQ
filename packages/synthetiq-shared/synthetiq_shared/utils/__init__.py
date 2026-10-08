"""Shared utilities  -  observability, logging, and cryptography."""

from .crypto import compute_audit_hash, sign_form1_sha256
from .telemetry import (
    ACTIVE_AUCTIONS_GAUGE,
    AUDIT_VERDICTS_COUNTER,
    ESCROW_AMOUNT_INR_TOTAL,
    PLASTIC_TONS_VERIFIED,
    WORKFLOW_DURATION_SECONDS,
    WORKFLOW_EXECUTION_COUNTER,
    get_logger,
)

__all__ = [
    "get_logger",
    "compute_audit_hash",
    "sign_form1_sha256",
    "WORKFLOW_EXECUTION_COUNTER",
    "WORKFLOW_DURATION_SECONDS",
    "AUDIT_VERDICTS_COUNTER",
    "ESCROW_AMOUNT_INR_TOTAL",
    "PLASTIC_TONS_VERIFIED",
    "ACTIVE_AUCTIONS_GAUGE",
]
