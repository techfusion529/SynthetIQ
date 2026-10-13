"""Prometheus custom metrics for the SynthetIQ worker."""

from __future__ import annotations

from prometheus_client import Counter

# Tracks LLM token consumption per (org_id, agent_name, model).
llm_tokens_total = Counter(
    "llm_tokens_total",
    "Total LLM tokens consumed (input + output)",
    labelnames=["org_id", "agent_name", "model"],
)
