"""Temporal client integration for native workflow dispatch, execution, and signaling."""

from __future__ import annotations

import os
from typing import Any
from temporalio.client import Client

from src.constants import TEMPORAL_HOST


class TemporalGatewayService:
    """Manages workflow triggering and human-in-the-loop signaling with real Temporal Client."""

    def __init__(self, host: str | None = None) -> None:
        self.host = host or os.getenv("TEMPORAL_HOST", TEMPORAL_HOST)
        self._client: Client | None = None

    async def get_client(self) -> Client:
        """Returns cached or new connection to Temporal Server."""
        if self._client is None:
            self._client = await Client.connect(self.host)
        return self._client

    async def start_workflow(
        self,
        workflow_name: str,
        workflow_id: str,
        args: list[Any],
        task_queue: str = "synthetiq-main",
    ) -> dict[str, Any]:
        """Dispatches an asynchronous workflow execution to Temporal Server."""
        try:
            client = await self.get_client()
            handle = await client.start_workflow(
                workflow_name,
                args=args,
                id=workflow_id,
                task_queue=task_queue,
            )
            return {
                "workflow_id": handle.id,
                "run_id": handle.result_run_id,
                "status": "RUNNING",
                "task_queue": task_queue,
                "temporal_ui_url": f"http://localhost:8080/namespaces/default/workflows/{handle.id}",
            }
        except Exception as e:
            # Fallback if connection fails
            return {
                "workflow_id": workflow_id,
                "status": "DISPATCH_FALLBACK",
                "error": str(e),
                "task_queue": task_queue,
            }

    async def execute_workflow(
        self,
        workflow_name: str,
        workflow_id: str,
        args: list[Any],
        task_queue: str = "synthetiq-main",
    ) -> dict[str, Any]:
        """Executes a workflow synchronously on Temporal cluster and waits for its multi-agent result."""
        client = await self.get_client()
        result = await client.execute_workflow(
            workflow_name,
            args=args,
            id=workflow_id,
            task_queue=task_queue,
        )
        return result

    async def get_workflow_description(self, workflow_id: str) -> dict[str, Any]:
        """Queries Temporal Server for execution history and status."""
        try:
            client = await self.get_client()
            handle = client.get_workflow_handle(workflow_id)
            desc = await handle.describe()
            return {
                "workflow_id": desc.id,
                "run_id": desc.run_id,
                "status": desc.status.name,
                "type": desc.workflow_type,
                "start_time": desc.start_time.isoformat() if desc.start_time else None,
                "close_time": desc.close_time.isoformat() if desc.close_time else None,
            }
        except Exception as e:
            return {"workflow_id": workflow_id, "error": str(e)}

    async def signal_workflow(
        self,
        workflow_id: str,
        signal_name: str,
        signal_args: list[Any],
    ) -> dict[str, Any]:
        """Sends an external signal to a running Temporal workflow."""
        try:
            client = await self.get_client()
            handle = client.get_workflow_handle(workflow_id)
            await handle.signal(signal_name, *signal_args)
            return {
                "workflow_id": workflow_id,
                "signal": signal_name,
                "status": "SIGNALED",
            }
        except Exception as e:
            return {
                "workflow_id": workflow_id,
                "signal": signal_name,
                "status": "SIGNAL_FAILED",
                "error": str(e),
            }


# Singleton service instance
temporal_service = TemporalGatewayService()
