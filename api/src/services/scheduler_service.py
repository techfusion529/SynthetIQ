"""Temporal-backed schedule service for the SynthetIQ API.

Wraps temporalio.client to create, delete, and list Temporal Schedules
that fire MasterEPRComplianceWorkflow on a cron.
"""

from __future__ import annotations

from typing import Any

from temporalio.client import (
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleSpec,
)

from synthetiq_shared.models.runs import RunInput

# TODO: import MasterEPRComplianceWorkflow from the worker package once the
# worker is installable as a library.  Until then we reference it by name.
# from flows.workflows import MasterEPRComplianceWorkflow
_MASTER_WORKFLOW_TYPE = "MasterEPRComplianceWorkflow"

__all__ = ["TemporalScheduleService"]


class TemporalScheduleService:
    """Creates, deletes, and lists Temporal Schedules on behalf of the API."""

    def __init__(self, temporal_client: Any) -> None:
        self.client = temporal_client

    async def create_schedule(
        self,
        org_id: str,
        schedule_id: str,
        cron: str,
        workflow_type: str,
        params: dict[str, Any],
    ) -> str:
        """Register a new Temporal Schedule and return its Temporal schedule ID.

        The workflow that fires is always MasterEPRComplianceWorkflow;
        *workflow_type* is stored in the RunInput params for routing / labelling.
        """
        temporal_schedule_id = f"{org_id}/schedule/{schedule_id}"

        run_input = RunInput(
            org_id=org_id,
            run_id=schedule_id,
            params={**params, "workflow_type": workflow_type},
        )

        await self.client.create_schedule(
            temporal_schedule_id,
            Schedule(
                action=ScheduleActionStartWorkflow(
                    _MASTER_WORKFLOW_TYPE,
                    run_input,
                    id=f"{org_id}/scheduled/{schedule_id}/{{schedule_action_id}}",
                    task_queue="epr-task-queue",
                ),
                spec=ScheduleSpec(cron_expressions=[cron]),
            ),
        )
        return temporal_schedule_id

    async def delete_schedule(self, org_id: str, schedule_id: str) -> None:
        """Delete an existing Temporal Schedule."""
        temporal_schedule_id = f"{org_id}/schedule/{schedule_id}"
        handle = self.client.get_schedule_handle(temporal_schedule_id)
        await handle.delete()

    async def list_schedules(self, org_id: str) -> list[dict[str, Any]]:
        """Return all schedules whose ID starts with the org prefix."""
        results: list[dict[str, Any]] = []
        async for s in await self.client.list_schedules(f"{org_id}/schedule/"):
            results.append({"schedule_id": s.id, "info": s.info})
        return results
