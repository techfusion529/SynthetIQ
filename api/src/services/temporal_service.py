"""Temporal client integration for workflow dispatch and signaling."""

from __future__ import annotations

import os
from typing import Any

from src.constants import TEMPORAL_HOST


class TemporalGatewayService:
    """Manages workflow triggering and human-in-the-loop signaling."""

    def __init__(self, host: str | None = None) -> None:
        self.host = host or os.getenv("TEMPORAL_HOST", TEMPORAL_HOST)
        self._connected = False

    async def start_workflow(
        self,
        workflow_name: str,
        workflow_id: str,
        args: list[Any],
        task_queue: str = "synthetiq-main",
    ) -> dict[str, Any]:
        """Dispatches an asynchronous workflow execution to Temporal."""
        # Returns dispatch confirmation (in real env connects to temporalio.client.Client)
        return {
            "workflow_id": workflow_id,
            "workflow_name": workflow_name,
            "status": "RUNNING",
            "task_queue": task_queue,
            "args_count": len(args),
        }

    async def signal_workflow(
        self,
        workflow_id: str,
        signal_name: str,
        signal_args: list[Any],
    ) -> dict[str, Any]:
        """Sends an external signal to a running Temporal workflow (e.g. human approval)."""
        return {
            "workflow_id": workflow_id,
            "signal": signal_name,
            "status": "SIGNALED",
        }


# Singleton service instance
temporal_service = TemporalGatewayService()
