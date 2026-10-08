"""Server-Sent Events stream for real-time agent execution monitoring.

GET /compliance/runs/{run_id}/stream  — SSE stream of workflow activity events
GET /compliance/stream/live           — SSE stream of all running workflows
"""
from __future__ import annotations
import asyncio
import json
import logging
import time
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission

router = APIRouter(prefix="/stream", tags=["Real-Time Agent Stream"])
logger = logging.getLogger(__name__)

# In-process event bus: run_id -> list of queued events
# Workers (orchestrator route) push events here; SSE clients drain them
_EVENT_QUEUES: dict[str, asyncio.Queue] = {}
# Latest snapshot per run for new subscribers
_RUN_SNAPSHOTS: dict[str, dict[str, Any]] = {}


def get_or_create_queue(run_id: str) -> asyncio.Queue:
    if run_id not in _EVENT_QUEUES:
        _EVENT_QUEUES[run_id] = asyncio.Queue(maxsize=200)
    return _EVENT_QUEUES[run_id]


def push_event(run_id: str, event: dict[str, Any]) -> None:
    """Push an event into the run queue (non-blocking; drops if full)."""
    q = get_or_create_queue(run_id)
    event.setdefault("timestamp", time.time())
    _RUN_SNAPSHOTS[run_id] = event
    try:
        q.put_nowait(event)
    except asyncio.QueueFull:
        pass  # drop oldest conceptually — client will resync


async def _event_generator(run_id: str, timeout: float = 300.0) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted events for a run until COMPLETED/FAILED or timeout."""
    q = get_or_create_queue(run_id)
    deadline = time.time() + timeout
    # Send snapshot if available
    snap = _RUN_SNAPSHOTS.get(run_id)
    if snap:
        yield f"data: {json.dumps(snap)}\n\n"
    while time.time() < deadline:
        try:
            event = await asyncio.wait_for(q.get(), timeout=2.0)
            yield f"data: {json.dumps(event)}\n\n"
            status = event.get("status", "")
            if status in ("SUCCESS_FULLY_COMPLIANT", "HALTED_DUE_TO_FRAUD", "FAILED", "COMPLETED"):
                break
        except asyncio.TimeoutError:
            # Heartbeat
            yield f"data: {json.dumps({'type': 'heartbeat', 'run_id': run_id, 'ts': time.time()})}\n\n"
    yield f"data: {json.dumps({'type': 'stream_end', 'run_id': run_id})}\n\n"


async def _live_generator(timeout: float = 600.0) -> AsyncGenerator[str, None]:
    """Yield SSE events aggregated across all active runs."""
    deadline = time.time() + timeout
    seen: dict[str, float] = {}
    while time.time() < deadline:
        any_event = False
        for run_id, q in list(_EVENT_QUEUES.items()):
            if not q.empty():
                try:
                    event = q.get_nowait()
                    event["run_id"] = run_id
                    yield f"data: {json.dumps(event)}\n\n"
                    any_event = True
                except Exception:
                    pass
        if not any_event:
            yield f"data: {json.dumps({'type': 'heartbeat', 'active_runs': len(_EVENT_QUEUES), 'ts': time.time()})}\n\n"
            await asyncio.sleep(1.5)


@router.get("/runs/{run_id}")
async def stream_run_events(
    run_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:read")),
) -> StreamingResponse:
    """SSE stream of real-time agent execution events for a specific run."""
    return StreamingResponse(
        _event_generator(run_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/live")
async def stream_all_runs(
    user: CurrentUser,
    _: Any = Depends(require_permission("workflows:read")),
) -> StreamingResponse:
    """SSE stream aggregating events from all active compliance runs."""
    return StreamingResponse(
        _live_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
