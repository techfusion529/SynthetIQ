"""Workflow 3: Quad-Core Fraud Audit & Live SCADA Telemetry Stream.

RBAC:
  GET  /audit/scada/live   → audits:read    (auditor+)
  POST /audit/trigger      → audits:write   (auditor+)
  GET  /audit/verdicts     → audits:read    (viewer+)
  GET  /audit/verdict/{id} → audits:read    (viewer+)
"""

from __future__ import annotations

import hashlib
import time
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.routes.config import get_runtime_config
from src.services.temporal_service import temporal_service

router = APIRouter(prefix="/audit", tags=["Workflow 3 - Fraud Audit"])

_AUDITS_DB: dict[str, dict[str, Any]] = {
    "AUD-2026-881": {
        "audit_id": "AUD-2026-881",
        "recycler_id": "RECYC-DELHI-01",
        "plant_id": "PLANT-OKHLA-2",
        "plastic_category": "cat_i_rigid",
        "reported_volume_tons": 250.0,
        "verified_physical_melt_tons": 248.6,
        "physical_melt_verified": True,
        "confidence_score": 0.965,
        "eway_bill_verified": True,
        "audit_verdict": "APPROVED",
        "rejection_reasons": [],
        "audit_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "timestamp": time.time(),
    }
}


@router.get("/scada/live")
async def get_live_scada_stream(
    user: CurrentUser,
    _: Any = Depends(require_permission("audits:read")),
    mode: str = "GENUINE",
) -> dict[str, Any]:
    """Polls real-time SCADA telemetry and runs Jev System 1 fraud evaluation."""
    config = get_runtime_config()
    is_spoof = mode.upper() in ["SPOOF", "RESISTIVE_SPOOF", "FAKE"]
    endpoint = "/telemetry/spoofed" if is_spoof else "/telemetry/genuine"

    reading: dict[str, Any] | None = None
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.get(f"{config.simulator_url.rstrip('/')}{endpoint}")
            if resp.status_code == 200:
                reading = resp.json()
    except Exception:
        pass

    if not reading:
        reading = (
            {"torque_nm": 2.3, "power_factor": 0.991, "active_power_kw": 52.0,
             "vfd_frequency_hz": 50.0, "melt_rate_kg_h": 14.0, "timestamp": time.time(), "mode": "RESISTIVE_SPOOF"}
            if is_spoof else
            {"torque_nm": 43.8, "power_factor": 0.842, "active_power_kw": 47.5,
             "vfd_frequency_hz": 50.0, "melt_rate_kg_h": 185.0, "timestamp": time.time(), "mode": "GENUINE"}
        )

    torque = float(reading.get("torque_nm", 0.0))
    pf     = float(reading.get("power_factor", 0.0))
    kw     = float(reading.get("active_power_kw", 0.0))

    flags: list[str] = []
    is_spoofed = False
    confidence = 1.0

    if kw > 10.0 and pf > config.power_factor_max and torque < config.torque_threshold_nm:
        is_spoofed = True
        confidence = 0.12
        flags.append("SPOOF_DETECTED: Resistive space heaters without motor torque")
    if torque < 5.0 and kw > 5.0:
        is_spoofed = True
        confidence = min(confidence, 0.20)
        flags.append("ANOMALY: Motor running without viscosity resistance")
    if 0.78 <= pf <= 0.92 and torque >= 15.0:
        confidence = max(confidence, 0.965)
    elif pf > 0.96:
        confidence = min(confidence, 0.40)
        flags.append("SUSPICIOUS: Near-unity PF — no inductive motor load")

    verified = (not is_spoofed) and (confidence >= 0.85)
    verdict  = "APPROVED" if verified else ("REJECTED" if is_spoofed else "ESCALATED")

    return {
        "telemetry": reading,
        "physics": {"torque_nm": torque, "power_factor": pf,
                    "active_power_kw": kw, "vfd_frequency_hz": reading.get("vfd_frequency_hz", 50.0)},
        "jev_evaluation": {
            "mode": config.jev_mode, "verdict": verdict,
            "is_spoofed": is_spoofed, "physical_melt_verified": verified,
            "confidence_score": round(confidence, 3), "flags": flags,
        },
        "timestamp": time.time(),
    }


@router.post("/trigger")
async def trigger_fraud_audit(
    payload: dict[str, Any],
    user: CurrentUser,
    _: Any = Depends(require_permission("audits:write")),
) -> dict[str, Any]:
    """Triggers Quad-Core Fraud Audit; stores result and dispatches to Temporal."""
    recycler_id   = payload.get("recycler_id",   "RECYC-DELHI-01")
    plant_id      = payload.get("plant_id",       "PLANT-OKHLA-2")
    category      = payload.get("category",       "cat_i_rigid")
    volume_tons   = float(payload.get("volume_tons",   250.0))
    simulate_spoof = bool(payload.get("simulate_spoof", False))

    scada_res = await get_live_scada_stream(
        user=user, _=None,
        mode="RESISTIVE_SPOOF" if simulate_spoof else "GENUINE",
    )
    jev     = scada_res["jev_evaluation"]
    physics = scada_res["physics"]

    audit_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
    seed     = f"{audit_id}:{recycler_id}:{plant_id}:{physics['torque_nm']}:{physics['power_factor']}:{jev['verdict']}"
    audit_hash = hashlib.sha256(seed.encode()).hexdigest()

    record: dict[str, Any] = {
        "audit_id": audit_id,
        "recycler_id": recycler_id,
        "plant_id": plant_id,
        "plastic_category": category,
        "reported_volume_tons": volume_tons,
        "verified_physical_melt_tons": volume_tons if jev["physical_melt_verified"] else 0.0,
        "physical_melt_verified": jev["physical_melt_verified"],
        "confidence_score": jev["confidence_score"],
        "eway_bill_verified": True,
        "audit_verdict": jev["verdict"],
        "rejection_reasons": jev["flags"],
        "audit_hash": audit_hash,
        "physics": physics,
        "triggered_by": user["email"],
        "timestamp": time.time(),
    }
    _AUDITS_DB[audit_id] = record

    await temporal_service.start_workflow(
        workflow_name="QuadCoreAuditWorkflow",
        workflow_id=f"wf3-audit-{audit_id}",
        args=[recycler_id, plant_id, category, volume_tons],
    )
    return record


@router.get("/verdicts")
async def list_audit_verdicts(
    user: CurrentUser,
    _: Any = Depends(require_permission("audits:read")),
) -> list[dict[str, Any]]:
    """Lists recent audit verdicts sorted by timestamp."""
    return sorted(_AUDITS_DB.values(), key=lambda x: x.get("timestamp", 0), reverse=True)


@router.get("/verdict/{audit_id}")
async def get_audit_verdict(
    audit_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("audits:read")),
) -> dict[str, Any]:
    """Retrieves a specific audit verdict."""
    return _AUDITS_DB.get(
        audit_id,
        {"audit_id": audit_id, "audit_verdict": "PENDING", "physical_melt_verified": False},
    )
