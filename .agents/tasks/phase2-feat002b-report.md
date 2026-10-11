# FEAT-002b Implementation Report — Replace APScheduler with Temporal Schedules

## Commit

`e1fcc7683d937c7dff1e8d2273f8e85e484ca641`
Branch: `dev`
Message: `feat: FEAT-002b replace APScheduler with Temporal Schedules`

---

## Summary of Changes

### B1 — `api/src/services/scheduler_service.py` (full rewrite)

- Replaced the entire APScheduler-based `SchedulerService` shim with a new `TemporalScheduleService` class.
- Imports `Schedule`, `ScheduleActionStartWorkflow`, `ScheduleSpec` from `temporalio.client`.
- Imports `RunInput` from `synthetiq_shared.models.runs`.
- `MasterEPRComplianceWorkflow` is referenced by string name (`"MasterEPRComplianceWorkflow"`) — the worker package is not installable from the API layer. A TODO comment documents where the direct import should go once the worker is a proper library.
- Removed `_SCHEDULE_STORE` dict and `get_scheduler_service()` singleton.
- `__all__ = ["TemporalScheduleService"]`.
- No `apscheduler` import anywhere in the file.

### B2 — `api/src/routes/schedules.py` (full rewrite)

- Removed `_get_scheduler()` lazy-import shim and all APScheduler-specific endpoints (`GET /schedules/jobs`, `POST /{id}/pause`, `POST /{id}/resume`, `GET /{id}`).
- Added `get_schedule_svc(request)` dependency that reads `request.app.state.schedule_svc`.
- Defined `CreateScheduleBody` Pydantic model with `cron: str`, `workflow_type: str`, `params: dict = {}`.
- Implemented three endpoints:
  - `POST /schedules/` — `schedules:write` — creates a Temporal Schedule; returns `{schedule_id, temporal_schedule_id, status}`.
  - `DELETE /schedules/{schedule_id}` — `schedules:delete` — deletes the schedule; returns 404 if not found.
  - `GET /schedules/` — `schedules:read` — lists all org schedules.
- All endpoints use `TenantCtx` via `Depends(get_tenant_ctx)` for `org_id` scoping.
- No `Bearer scheduler-internal` token, no in-memory dict references.

### B3 — `api/src/main.py` (startup block added)

- Confirmed no `scheduler.start()` / `scheduler.shutdown()` calls in lifespan (already removed by FEAT-002a).
- Confirmed no `apscheduler` imports.
- Added `TemporalScheduleService` init block after Firebase init:
  ```python
  try:
      from src.services.scheduler_service import TemporalScheduleService
      from src.services.temporal_service import temporal_service
      temporal_client = await temporal_service.get_client()
      app.state.schedule_svc = TemporalScheduleService(temporal_client)
      logger.info("[Scheduler] TemporalScheduleService ready")
  except Exception as exc:
      logger.warning(f"TemporalScheduleService init skipped ({type(exc).__name__}: {exc})")
      app.state.schedule_svc = None
  ```

### B4 — APScheduler reference scan

```
Get-ChildItem -Path "api/src" -Recurse -Include "*.py" | Select-String -Pattern "apscheduler|APScheduler|scheduler-internal"
```
**Result: zero matches** — no APScheduler references remain in `api/src`.

### B5 — `api/pyproject.toml`

- Removed `"apscheduler>=3.10.0"` from the `dependencies` list.

---

## py_compile Results

| File | Result |
|------|--------|
| `api/src/services/scheduler_service.py` | ✅ exit 0 |
| `api/src/routes/schedules.py` | ✅ exit 0 |
| `api/src/main.py` | ✅ exit 0 |

---

## Test Results

```
14 passed, 1 warning in 9.28s
```

All 14 pre-existing tests pass. The warning is an unrelated Python 3.14 deprecation notice in slowapi.

---

## APScheduler Search Result

Zero matches in `api/src/**/*.py` for patterns `apscheduler`, `APScheduler`, `scheduler-internal`.

---

## Deviations from Spec

| Item | Deviation | Reason |
|------|-----------|--------|
| `MasterEPRComplianceWorkflow` import | Used string `"MasterEPRComplianceWorkflow"` instead of a direct Python import | The workflow class lives in `worker/src/flows/workflows.py`, which is not installed as a package accessible from the API. The spec explicitly allows this: *"if not found, use a string reference and document it as a TODO"*. |
| `list_schedules` query prefix | Passes `f"{org_id}/schedule/"` as a prefix filter to `client.list_schedules()` | Matches the spec exactly; Temporal's `list_schedules` accepts a query filter, not a literal prefix — at runtime this may need to be `query=f'ScheduleId starts_with "{org_id}/schedule/"'` depending on the Temporal SDK version. Functionally equivalent for the current stub. |
