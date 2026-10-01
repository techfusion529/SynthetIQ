"""APScheduler-based per-organisation workflow scheduler.

Loads Schedule records from PostgreSQL (or in-memory dev store) and registers
a cron/interval job for each active schedule.  On trigger, it fires the
corresponding Temporal workflow via the TemporalGateway.

Design:
  - Uses AsyncIOScheduler so it runs inside the same asyncio event loop as
    the Temporal worker.
  - Schedule CRUD is persisted in the `schedules` PostgreSQL table
    (Organization ORM model — Phase 1).
  - Supports: one_time, daily, weekly, interval, and raw cron expressions.
  - Workflow types mirror the four Temporal workflows:
      upstream_liability  → UpstreamLiabilityWorkflow
      auction_liquidity   → AuctionLiquidityWorkflow
      quad_core_audit     → QuadCoreAuditWorkflow
      settlement_dispatch → SettlementDispatchWorkflow
      master_e2e          → MasterEPRComplianceWorkflow
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# ── Workflow type → Temporal workflow name mapping ────────────────────────────
WORKFLOW_TYPE_MAP: dict[str, str] = {
    "upstream_liability":  "UpstreamLiabilityWorkflow",
    "auction_liquidity":   "AuctionLiquidityWorkflow",
    "quad_core_audit":     "QuadCoreAuditWorkflow",
    "settlement_dispatch": "SettlementDispatchWorkflow",
    "master_e2e":          "MasterEPRComplianceWorkflow",
    "master_e2e_compliance": "MasterEPRComplianceWorkflow",
}


class SchedulerService:
    """Per-organisation APScheduler that drives periodic Temporal workflow execution."""

    def __init__(self, api_base_url: str = "http://localhost:8000") -> None:
        """Initialise the scheduler service.

        Args:
            api_base_url: Base URL of the SynthetIQ API gateway.
                          Used to POST /api/v1/compliance/run-e2e on schedule.
        """
        self.api_base_url = api_base_url.rstrip("/")
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        # In-memory schedule store for dev (replaced by DB in production)
        self._schedules: dict[str, dict[str, Any]] = {}
        logger.info(f"SchedulerService created (api_base={self.api_base_url})")

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the APScheduler event loop."""
        if not self._scheduler.running:
            self._scheduler.start()
            logger.info("✓ APScheduler started")

    def shutdown(self, wait: bool = True) -> None:
        """Gracefully stop the scheduler."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=wait)
            logger.info("APScheduler stopped")

    @property
    def is_running(self) -> bool:
        return self._scheduler.running

    # ── Schedule management ───────────────────────────────────────────────────

    def add_schedule(
        self,
        org_id: str,
        workflow_type: str,
        cron_expression: str,
        workflow_params: dict[str, Any] | None = None,
        name: str | None = None,
        schedule_id: str | None = None,
    ) -> dict[str, Any]:
        """Register a new per-org cron schedule and add it to APScheduler.

        Args:
            org_id: Organisation identifier (tenant key)
            workflow_type: One of the WORKFLOW_TYPE_MAP keys
            cron_expression: Standard 5-field cron string  e.g. "0 2 * * *"
                             OR shorthand: "@daily", "@hourly", "@weekly"
                             OR interval: "every_30m", "every_1h", "every_6h"
            workflow_params: Extra parameters forwarded to the Temporal workflow
            name: Human-readable schedule name
            schedule_id: Optional explicit ID (auto-generated if omitted)

        Returns:
            Created schedule record dict
        """
        schedule_id = schedule_id or f"SCHED-{uuid.uuid4().hex[:8].upper()}"
        params = workflow_params or {}

        # Resolve trigger
        trigger = self._resolve_trigger(cron_expression)

        # Build job function (closure captures schedule metadata)
        async def _fire() -> None:
            await self._fire_workflow(
                org_id=org_id,
                schedule_id=schedule_id,
                workflow_type=workflow_type,
                params=params,
            )

        self._scheduler.add_job(
            func=_fire,
            trigger=trigger,
            id=schedule_id,
            name=name or f"{org_id}/{workflow_type}",
            replace_existing=True,
            misfire_grace_time=300,   # 5-minute grace window
        )

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
            "next_run_at": self._next_run_time(schedule_id),
            "last_status": "PENDING",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._schedules[schedule_id] = record

        logger.info(
            f"Registered schedule {schedule_id}: {org_id}/{workflow_type} "
            f"cron={cron_expression!r}"
        )
        return record

    def remove_schedule(self, schedule_id: str) -> bool:
        """Remove a schedule from APScheduler and the in-memory store.

        Args:
            schedule_id: Schedule identifier to remove

        Returns:
            True if removed, False if not found
        """
        if schedule_id not in self._schedules:
            return False
        try:
            self._scheduler.remove_job(schedule_id)
        except Exception:
            pass  # Job may have already been removed
        self._schedules.pop(schedule_id, None)
        logger.info(f"Removed schedule {schedule_id}")
        return True

    def pause_schedule(self, schedule_id: str) -> bool:
        """Pause a schedule without removing it."""
        if schedule_id not in self._schedules:
            return False
        self._scheduler.pause_job(schedule_id)
        self._schedules[schedule_id]["is_active"] = False
        logger.info(f"Paused schedule {schedule_id}")
        return True

    def resume_schedule(self, schedule_id: str) -> bool:
        """Resume a paused schedule."""
        if schedule_id not in self._schedules:
            return False
        self._scheduler.resume_job(schedule_id)
        self._schedules[schedule_id]["is_active"] = True
        self._schedules[schedule_id]["next_run_at"] = self._next_run_time(schedule_id)
        logger.info(f"Resumed schedule {schedule_id}")
        return True

    def get_schedule(self, schedule_id: str) -> dict[str, Any] | None:
        """Retrieve a single schedule record."""
        return self._schedules.get(schedule_id)

    def list_schedules(self, org_id: str | None = None) -> list[dict[str, Any]]:
        """List all schedules, optionally filtered by org_id.

        Args:
            org_id: Filter by organisation (None = return all)

        Returns:
            List of schedule dicts sorted by created_at desc
        """
        schedules = list(self._schedules.values())
        if org_id:
            schedules = [s for s in schedules if s["org_id"] == org_id]
        return sorted(schedules, key=lambda s: s.get("created_at", ""), reverse=True)

    def list_all_jobs(self) -> list[dict[str, Any]]:
        """Return APScheduler job metadata for all registered jobs."""
        jobs = []
        for job in self._scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            })
        return jobs

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _resolve_trigger(self, expression: str) -> CronTrigger | IntervalTrigger:
        """Convert a cron string or shorthand into an APScheduler trigger.

        Supported shorthands:
          @daily     → CronTrigger(hour=0, minute=0)
          @hourly    → CronTrigger(minute=0)
          @weekly    → CronTrigger(day_of_week='mon', hour=0, minute=0)
          every_30m  → IntervalTrigger(minutes=30)
          every_1h   → IntervalTrigger(hours=1)
          every_Xh   → IntervalTrigger(hours=X)
          5-field cron (e.g. "0 2 * * *") → CronTrigger via from_crontab
        """
        expr = expression.strip().lower()

        if expr == "@daily":
            return CronTrigger(hour=0, minute=0, timezone="UTC")
        if expr == "@hourly":
            return CronTrigger(minute=0, timezone="UTC")
        if expr == "@weekly":
            return CronTrigger(day_of_week="mon", hour=0, minute=0, timezone="UTC")
        if expr.startswith("every_"):
            # every_30m, every_1h, every_6h …
            suffix = expr[len("every_"):]
            if suffix.endswith("m"):
                return IntervalTrigger(minutes=int(suffix[:-1]))
            if suffix.endswith("h"):
                return IntervalTrigger(hours=int(suffix[:-1]))

        # 5-field standard cron
        return CronTrigger.from_crontab(expression, timezone="UTC")

    def _next_run_time(self, schedule_id: str) -> str | None:
        """Return the next scheduled run time as ISO-8601 string."""
        job = self._scheduler.get_job(schedule_id)
        if job and job.next_run_time:
            return job.next_run_time.isoformat()
        return None

    async def _fire_workflow(
        self,
        org_id: str,
        schedule_id: str,
        workflow_type: str,
        params: dict[str, Any],
    ) -> None:
        """Execute when a scheduled trigger fires.

        POSTs to the API gateway which dispatches the Temporal workflow.
        Updates run metadata in the in-memory store.

        Args:
            org_id: Organisation identifier
            schedule_id: Schedule that fired
            workflow_type: Workflow type key
            params: Workflow parameters
        """
        logger.info(
            f"[Scheduler] Firing {workflow_type} for org={org_id} "
            f"(schedule={schedule_id})"
        )

        # Update run metadata
        record = self._schedules.get(schedule_id, {})
        record["run_count"] = record.get("run_count", 0) + 1
        record["last_run_at"] = datetime.now(timezone.utc).isoformat()
        record["next_run_at"] = self._next_run_time(schedule_id)
        record["last_status"] = "RUNNING"

        try:
            # Build payload for the API compliance endpoint
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
                    # Pass internal service token so RBAC allows execution
                    headers={
                        "Authorization": "Bearer scheduler-internal",
                        "X-Schedule-ID": schedule_id,
                        "X-Org-ID": org_id,
                    },
                )
                if resp.status_code == 200:
                    result = resp.json()
                    record["last_status"] = result.get("status", "COMPLETED")
                    logger.info(
                        f"[Scheduler] {schedule_id} → {record['last_status']} "
                        f"(run #{record['run_count']})"
                    )
                else:
                    record["last_status"] = f"HTTP_ERROR_{resp.status_code}"
                    logger.error(
                        f"[Scheduler] {schedule_id} HTTP {resp.status_code}: "
                        f"{resp.text[:120]}"
                    )

        except Exception as exc:
            record["last_status"] = "ERROR"
            logger.error(f"[Scheduler] {schedule_id} failed: {exc}")

        if schedule_id in self._schedules:
            self._schedules[schedule_id].update(record)


# ── Global singleton ──────────────────────────────────────────────────────────

_scheduler_service: SchedulerService | None = None


def get_scheduler_service() -> SchedulerService:
    """Return the global SchedulerService, creating it on first call."""
    global _scheduler_service
    if _scheduler_service is None:
        _scheduler_service = SchedulerService()
        logger.info("SchedulerService singleton created")
    return _scheduler_service
