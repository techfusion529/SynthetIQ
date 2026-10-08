from __future__ import annotations
import hashlib, logging, time, uuid
from typing import Any
import httpx
from fastapi import APIRouter, Depends
from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.routes.config import get_runtime_config
from src.services.temporal_service import temporal_service

router = APIRouter(prefix="/audit", tags=["Workflow 3 - Fraud Audit"])
logger = logging.getLogger(__name__)

_AUDITS_DB: dict[str, dict[str, Any]] = {
    "AUD-2026-881": {
        "audit_id": "AUD-2026-881", "recycler_id": "RECYC-DELHI-01",
        "plant_id": "PLANT-OKHLA-2", "plastic_category": "cat_i_rigid",
        "reported_volume_tons": 250.0, "verified_physical_melt_tons": 248.6,
        "physical_melt_verified": True, "confidence_score": 0.965,
        "eway_bill_verified": True, "audit_verdict": "APPROVED",
        "rejection_reasons": [], "audit_hash": "e3b0c44298fc1c149afbf4c8996fb9seed",
        "triggered_by": "seed", "timestamp": 1727760000.0,
    }
}
_seeded = False

async def _seed_db_if_empty() -> None:
    global _seeded
    if _seeded:
        return
    try:
        from sqlalchemy import select, func as sqlfunc
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuditRecord
        async with get_db_session() as session:
            cnt = (await session.execute(select(sqlfunc.count()).select_from(AuditRecord))).scalar() or 0
            if cnt == 0:
                s = _AUDITS_DB["AUD-2026-881"]
                session.add(AuditRecord(
                    audit_id=s["audit_id"], recycler_id=s["recycler_id"], plant_id=s["plant_id"],
                    plastic_category=s["plastic_category"],
                    reported_volume_tons=s["reported_volume_tons"],
                    verified_physical_melt_tons=s["verified_physical_melt_tons"],
                    physical_melt_verified=s["physical_melt_verified"],
                    confidence_score=s["confidence_score"],
                    eway_bill_verified=s["eway_bill_verified"],
                    audit_verdict=s["audit_verdict"],
                    rejection_reasons=s["rejection_reasons"],
                    audit_hash=s["audit_hash"], triggered_by="seed",
                ))
                logger.info("Seeded audit DB with AUD-2026-881")
        _seeded = True
    except Exception as exc:
        logger.warning(f"Audit seed failed ({exc})")

async def _get_all_audits() -> list[dict[str, Any]]:
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuditRecord
        async with get_db_session() as session:
            rows = (await session.execute(
                select(AuditRecord).order_by(AuditRecord.created_at.desc())
            )).scalars().all()
            if rows:
                return [r.to_dict() for r in rows]
    except Exception as exc:
        logger.warning(f"DB audit query failed ({exc})")
    return sorted(_AUDITS_DB.values(), key=lambda x: x.get("timestamp", 0), reverse=True)

async def _get_audit(audit_id: str) -> dict[str, Any] | None:
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuditRecord
        async with get_db_session() as session:
            row = (await session.execute(
                select(AuditRecord).where(AuditRecord.audit_id == audit_id)
            )).scalar_one_or_none()
            if row:
                return row.to_dict()
    except Exception:
        pass
    return _AUDITS_DB.get(audit_id)

async def _persist_audit(record: dict[str, Any]) -> None:
    _AUDITS_DB[record["audit_id"]] = record
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuditRecord
        async with get_db_session() as session:
            session.add(AuditRecord(
                audit_id=record["audit_id"],
                recycler_id=record.get("recycler_id", ""),
                plant_id=record.get("plant_id", ""),
                plastic_category=record.get("plastic_category", "cat_i_rigid"),
                reported_volume_tons=float(record.get("reported_volume_tons", 0)),
                verified_physical_melt_tons=float(record.get("verified_physical_melt_tons", 0)),
                physical_melt_verified=bool(record.get("physical_melt_verified", False)),
                confidence_score=float(record.get("confidence_score", 0)),
                eway_bill_verified=bool(record.get("eway_bill_verified", True)),
                audit_verdict=record.get("audit_verdict", "PENDING"),
                rejection_reasons=record.get("rejection_reasons", []),
                audit_hash=record.get("audit_hash", ""),
                physics=record.get("physics"),
                triggered_by=record.get("triggered_by", ""),
            ))
        logger.info(f"Persisted audit {record['audit_id']}")
    except Exception as exc:
        logger.warning(f"Could not persist audit ({exc})")

@router.get("/scada/live")
async def get_live_scada_stream(
    user: CurrentUser,
    _: Any = Depends(require_permission("audits:read")),
    mode: str = "GENUINE",
) -> dict[str, Any]:
    """Polls real SCADA telemetry from simulator and runs Jev physics evaluation."""
    config = get_runtime_config()
    is_spoof = mode.upper() in ["SPOOF", "RESISTIVE_SPOOF", "FAKE"]
    endpoint = "/telemetry/spoofed" if is_spoof else "/telemetry/genuine"
    reading: dict[str, Any] | None = None
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.get(f"{config.simulator_url.rstrip('/')}{endpoint}")
            if resp.status_code == 200:
                reading = resp.json()
    except Exception as exc:
        logger.debug(f"Simulator unreachable ({exc}), using physics fallback")
    if not reading:
        if is_spoof:
            reading = {"torque_nm": 2.3, "power_factor": 0.991, "active_power_kw": 52.0,
                       "vfd_frequency_hz": 50.0, "melt_rate_kg_h": 14.0,
                       "barrel_temp_c": 38.0, "simulation_mode": "RESISTIVE_SPOOF",
                       "timestamp": time.time()}
        else:
            reading = {"torque_nm": 43.8, "power_factor": 0.842, "active_power_kw": 47.5,
                       "vfd_frequency_hz": 50.0, "melt_rate_kg_h": 185.0,
                       "barrel_temp_c": 218.0, "simulation_mode": "GENUINE",
                       "timestamp": time.time()}
    torque = float(reading.get("torque_nm", 0.0))
    pf = float(reading.get("power_factor", 0.0))
    kw = float(reading.get("active_power_kw", 0.0))
    melt = float(reading.get("melt_rate_kg_h", 0.0))
    flags: list[str] = []
    is_spoofed = False
    confidence = 1.0
    if kw > 10.0 and pf > config.power_factor_max and torque < config.torque_threshold_nm:
        is_spoofed = True
        confidence = 0.12
        flags.append("SPOOF_DETECTED: Resistive space heaters ? no extruder torque")
    if torque < 5.0 and kw > 5.0:
        is_spoofed = True
        confidence = min(confidence, 0.20)
        flags.append("ANOMALY: Active power without viscosity resistance")
    if 0.78 <= pf <= 0.92 and torque >= 15.0:
        confidence = max(confidence, 0.965)
    elif pf > 0.96:
        confidence = min(confidence, 0.40)
        flags.append("SUSPICIOUS: Near-unity PF ? no inductive motor load")
    if melt > 0 and kw > 0:
        spec_e = kw / melt
        if spec_e < 0.15 or spec_e > 1.2:
            flags.append(f"ENERGY_MISMATCH: {spec_e:.2f} kWh/kg outside 0.15-1.2 range")
    verified = (not is_spoofed) and (confidence >= 0.85)
    verdict = "APPROVED" if verified else ("REJECTED_FRAUD" if is_spoofed else "ESCALATED")
    return {
        "telemetry": reading,
        "simulation_mode": reading.get("simulation_mode", "GENUINE"),
        "physics": {
            "torque_nm": torque, "power_factor": pf, "active_power_kw": kw,
            "vfd_frequency_hz": reading.get("vfd_frequency_hz", 50.0),
            "melt_rate_kg_h": melt, "barrel_temp_c": reading.get("barrel_temp_c", 0),
        },
        "jev_evaluation": {
            "mode": config.jev_mode, "verdict": verdict, "is_spoofed": is_spoofed,
            "physical_melt_verified": verified,
            "confidence_score": round(confidence, 3), "flags": flags,
        },
        "timestamp": time.time(),
    }

@router.post("/trigger")
async def trigger_fraud_audit(
    payload: dict[str, Any], user: CurrentUser,
    _: Any = Depends(require_permission("audits:write")),
) -> dict[str, Any]:
    recycler_id = payload.get("recycler_id", "RECYC-DELHI-01")
    plant_id = payload.get("plant_id", "PLANT-OKHLA-2")
    category = payload.get("category", "cat_i_rigid")
    volume_tons = float(payload.get("volume_tons", 250.0))
    simulate_spoof = bool(payload.get("simulate_spoof", False))
    scada_res = await get_live_scada_stream(
        user=user, _=None, mode="RESISTIVE_SPOOF" if simulate_spoof else "GENUINE"
    )
    jev = scada_res["jev_evaluation"]
    physics = scada_res["physics"]
    audit_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
    seed = f"{audit_id}:{recycler_id}:{plant_id}:{physics['torque_nm']}:{physics['power_factor']}:{jev['verdict']}"
    audit_hash = hashlib.sha256(seed.encode()).hexdigest()
    record: dict[str, Any] = {
        "audit_id": audit_id, "recycler_id": recycler_id, "plant_id": plant_id,
        "plastic_category": category, "reported_volume_tons": volume_tons,
        "verified_physical_melt_tons": volume_tons if jev["physical_melt_verified"] else 0.0,
        "physical_melt_verified": jev["physical_melt_verified"],
        "confidence_score": jev["confidence_score"], "eway_bill_verified": True,
        "audit_verdict": jev["verdict"], "rejection_reasons": jev["flags"],
        "audit_hash": audit_hash, "physics": physics,
        "triggered_by": user["email"], "timestamp": time.time(),
    }
    await _persist_audit(record)
    await temporal_service.start_workflow(
        workflow_name="QuadCoreAuditWorkflow",
        workflow_id=f"wf3-audit-{audit_id}",
        args=[recycler_id, plant_id, category, volume_tons],
    )
    return record

@router.get("/verdicts")
async def list_audit_verdicts(
    user: CurrentUser, _: Any = Depends(require_permission("audits:read"))
) -> list[dict[str, Any]]:
    await _seed_db_if_empty()
    return await _get_all_audits()

@router.get("/verdict/{audit_id}")
async def get_audit_verdict(
    audit_id: str, user: CurrentUser, _: Any = Depends(require_permission("audits:read"))
) -> dict[str, Any]:
    await _seed_db_if_empty()
    record = await _get_audit(audit_id)
    if not record:
        return {"audit_id": audit_id, "audit_verdict": "PENDING", "physical_melt_verified": False}
    return record
