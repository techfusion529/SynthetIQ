"""Worker constants — task queues, model names, and retry policies."""

from __future__ import annotations

TEMPORAL_TASK_QUEUE: str = "synthetiq-main"
DEFAULT_WORKFLOW_TIMEOUT_SECONDS: int = 3600
DEFAULT_ACTIVITY_TIMEOUT_SECONDS: int = 300

GEMINI_FLASH_MODEL: str = "gemini-3.8-flash"
GEMMA_LOCAL_MODEL: str = "gemma-2b"

# Audit scoring
FRAUD_AUDIT_PASS_THRESHOLD: float = 0.85
ESCROW_SPLIT_ADVANCE_PCT: float = 0.80
ESCROW_SPLIT_RETENTION_PCT: float = 0.20
DEBT_AMORTIZATION_RATIO: float = 1 / 3
