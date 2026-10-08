"""Scheduler service shim for the API process.

The SchedulerService lives in worker/src/services/scheduler_service.py.
This shim re-implements the same class so the API can run APScheduler
in-process without importing the Temporal worker package.

In production (Kubernetes) the API and worker run in separate pods,
and scheduled workflow triggers are sent via HTTP POST to the API.
In local development / Docker Compose they share the same process.
"""

from __future__ import annotations

# Re-export everything from the canonical implementation.
# If the worker package is available on the path, use it directly.
# Otherwise fall back to a lightweight re-implementation.
try:
    from services.scheduler_service import (  # type: ignore[import-not-found]
        SchedulerService,
        get_scheduler_service,
    )
except ImportError:
    # Standalone import  -  duplicate the minimal subset needed by the API
    import logging
    import uuid
    from datetime import datetime, timezone
    from typing import Any

    import httpx
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.triggers.interval import IntervalTrigger

    logger = logging.getLogger(__name__)

    class SchedulerService:  # type: ignore[no-redef]
        """Lightweight APScheduler wrapper used by the API process."""

        def __init__(self, api_base_url: str = "http://localhost:8000") -> None:
            self.api_base_url = api_base_url.rstrip("/")
            self._scheduler = AsyncIOScheduler(timezone="UTC")
            self._schedules: dict[str, dict[str, Any]] = {}

        def start(self) -> None:
            if not self._scheduler.running:
                self._scheduler.start()
                logger.info(" -  APScheduler started (API process)")

        def shutdown(self, wait: bool = True) -> None:
            if self._scheduler.running:
                self._scheduler.shutdown(wait=wait)

        @property
        def is_running(self) -> bool:
            return self._scheduler.running

        def add_schedule(
            self,
            org_id: str,
            workflow_type: str,
            cron_expression: str,
            workflow_params: dict[str, Any] | None = None,
            name: str | None = None,
            schedule_id: str | None = None,
        ) -> dict[str, Any]:
            schedule_id = schedule_id or f"SCHED-{uuid.uuid4().hex[:8].upper()}"
            params = workflow_params or {}

            expr = cron_expression.strip().lower()
            if expr == "@daily":
                trigger = CronTrigger(hour=0, minute=0, timezone="UTC")
            elif expr == "@hourly":
                trigger = CronTrigger(minute=0, timezone="UTC")
            elif expr == "@weekly":
                trigger = CronTrigger(day_of_week="mon", hour=0, minute=0, timezone="UTC")
            elif expr.startswith("every_"):
                suffix = expr[len("every_"):]
                if suffix.endswith("m"):
                    trigger = IntervalTrigger(minutes=int(suffix[:-1]))
                elif suffix.endswith("h"):
                    trigger = IntervalTrigger(hours=int(suffix[:-1]))
                else:
                    trigger = CronTrigger.from_crontab(cron_expression, timezone="UTC")
            else:
                trigger = CronTrigger.from_crontab(cron_expression, timezone="UTC")

            async def _fire() -> None:
                await self._fire_workflow(org_id, schedule_id, workflow_type, params)

            self._scheduler.add_job(
                func=_fire,
                trigger=trigger,
                id=schedule_id,
                name=name or f"{org_id}/{workflow_type}",
                replace_existing=True,
                misfire_grace_time=300,
            )

            job = self._scheduler.get_job(schedule_id)
            record: dict[str, Any] = {
                "schedule_id": schedule_id,
                "org_id": org_id,
                "name": name or f"{org_id}/{workflow_type}",
                "workflow_type": workflow_type,
                "cron_expression": cron_expression,
                "workflow_params": params,
                "is_active": True,
                "run_count": 0,
                "last_run_at": None,
                "next_run_at": job.next_run_time.isoformat() if job and job.next_run_time else None,
                "last_status": "PENDING",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._schedules[schedule_id] = record
            logger.info(f"Registered schedule {schedule_id}: {org_id}/{workflow_type}")
            return record

        def remove_schedule(self, schedule_id: str) -> bool:
            if schedule_id not in self._schedules:
                return False
            try:
                self._scheduler.remove_job(schedule_id)
            except Exception:
                pass
            self._schedules.pop(schedule_id, None)
            return True

        def pause_schedule(self, schedule_id: str) -> bool:
            if schedule_id not in self._schedules:
                return False
            self._scheduler.pause_job(schedule_id)
            self._schedules[schedule_id]["is_active"] = False
            return True

        def resume_schedule(self, schedule_id: str) -> bool:
            if schedule_id not in self._schedules:
                return False
            self._scheduler.resume_job(schedule_id)
            self._schedules[schedule_id]["is_active"] = True
            return True

        def get_schedule(self, schedule_id: str) -> dict[str, Any] | None:
            return self._schedules.get(schedule_id)

        def list_schedules(self, org_id: str | None = None) -> list[dict[str, Any]]:
            items = list(self._schedules.values())
            if org_id:
                items = [s for s in items if s["org_id"] == org_id]
            return sorted(items, key=lambda s: s.get("created_at", ""), reverse=True)

        def list_all_jobs(self) -> list[dict[str, Any]]:
            return [
                {
                    "id": j.id,
                    "name": j.name,
                    "next_run_time": j.next_run_time.isoformat() if j.next_run_time else None,
                    "trigger": str(j.trigger),
                }
                for j in self._scheduler.get_jobs()
            ]

        async def _fire_workflow(
            self,
            org_id: str,
            schedule_id: str,
            workflow_type: str,
            params: dict[str, Any],
        ) -> None:
            logger.info(f"[Scheduler] Firing {workflow_type} for org={org_id}")
            record = self._schedules.get(schedule_id, {})
            record["run_count"] = record.get("run_count", 0) + 1
            record["last_run_at"] = datetime.now(timezone.utc).isoformat()
            record["last_status"] = "RUNNING"
            try:
                payload: dict[str, Any] = {
                    "company_id": params.get("company_id", org_id),
                    "fiscal_year": params.get("fiscal_year", "FY2026-27"),
                    "category": params.get("category", "cat_i_rigid"),
                    "volume_tons": float(params.get("volume_tons", 250.0)),
                    "simulate_spoof": bool(params.get("simulate_spoof", False)),
                    "triggered_by_schedule": schedule_id,
                }
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{self.api_base_url}/api/v1/compliance/run-e2e",
                        json=payload,
                        headers={"Authorization": "Bearer scheduler-internal"},
                    )
                    record["last_status"] = resp.json().get("status", "COMPLETED") if resp.status_code == 200 else f"HTTP_{resp.status_code}"
            except Exception as exc:
                record["last_status"] = "ERROR"
                logger.error(f"[Scheduler] {schedule_id} failed: {exc}")
            if schedule_id in self._schedules:
                self._schedules[schedule_id].update(record)

    _singleton: SchedulerService | None = None

    def get_scheduler_service() -> SchedulerService:  # type: ignore[no-redef]
        global _singleton
        if _singleton is None:
            _singleton = SchedulerService()
        return _singleton


__all__ = ["SchedulerService", "get_scheduler_service"]
