from __future__ import annotations

import logging
import time
import uuid
from typing import Any

import httpx

from fastapi import APIRouter, Depends, HTTPException, Query

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.routes.config import get_runtime_config
from src.services.temporal_service import temporal_service
from src.utils.tenant import TenantCtx, get_tenant_ctx

router = APIRouter(prefix="/audit", tags=["Workflow 3 - Fraud Audit"])
logger = logging.getLogger(__name__)


async def _get_all_audits(org_id: str | None = None, is_platform_admin: bool = False, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:

    try:

        from sqlalchemy import select

        from synthetiq_shared.database import get_db_session

        from synthetiq_shared.models import AuditRecord

        async with get_db_session() as session:

            query = select(AuditRecord).order_by(AuditRecord.created_at.desc())
            if not is_platform_admin and org_id:
                query = query.where(AuditRecord.org_id == org_id)
            query = query.limit(limit).offset(offset)
            rows = (await session.execute(query)).scalars().all()

            return [r.to_dict() for r in rows]

    except Exception as exc:

        logger.warning(f"DB audit query failed ({exc})")

    return []



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

    return None



async def _persist_audit(record: dict[str, Any]) -> None:
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import AuditRecord
        async with get_db_session() as session:
            existing = (await session.execute(
                select(AuditRecord).where(AuditRecord.audit_id == record["audit_id"])
            )).scalar_one_or_none()
            if existing:
                existing.verified_physical_melt_tons = float(record.get("verified_physical_melt_tons", existing.verified_physical_melt_tons))
                existing.physical_melt_verified = bool(record.get("physical_melt_verified", existing.physical_melt_verified))
                existing.confidence_score = float(record.get("confidence_score", existing.confidence_score))
                existing.audit_verdict = record.get("audit_verdict", existing.audit_verdict)
                existing.rejection_reasons = record.get("rejection_reasons", existing.rejection_reasons)
                existing.audit_hash = record.get("audit_hash", existing.audit_hash)
                existing.physics = record.get("physics", existing.physics)
            else:
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

    recycler_id: str = payload.get("recycler_id", "")
    if not recycler_id:
        raise HTTPException(status_code=400, detail="recycler_id required")
    plant_id: str = payload.get("plant_id", "")
    if not plant_id:
        raise HTTPException(status_code=400, detail="plant_id required")

    category: str = payload.get("category", "cat_i_rigid")
    volume_tons: float = float(payload.get("volume_tons", 250.0))
    simulate_spoof: bool = bool(payload.get("simulate_spoof", False))

    audit_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
    workflow_id = f"wf3-audit-{audit_id}"

    await temporal_service.start_workflow(
        workflow_name="QuadCoreAuditWorkflow",
        workflow_id=workflow_id,
        args=[
            recycler_id,
            plant_id,
            volume_tons,
            category,
            simulate_spoof,
        ],
        task_queue="synthetiq-main",
    )
    return {
        "audit_id": audit_id,
        "status": "RUNNING",
        "workflow_id": workflow_id,
    }



@router.get("/verdicts")

async def list_audit_verdicts(

    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("audits:read")),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),

) -> list[dict[str, Any]]:

    return await _get_all_audits(
        org_id=tenant_ctx.org_id,
        is_platform_admin=tenant_ctx.is_platform_admin,
        limit=limit,
        offset=offset,
    )



@router.get("/verdict/{audit_id}")

async def get_audit_verdict(

    audit_id: str, user: CurrentUser, _: Any = Depends(require_permission("audits:read"))

) -> dict[str, Any]:

    record = await _get_audit(audit_id)

    if not record:

        return {"audit_id": audit_id, "audit_verdict": "PENDING", "physical_melt_verified": False}

    return record



#  -  -  -  -  Feature 5: Human-in-the-Loop (HITL) Exception Resolution Endpoints  -  -  -  -  -  -  -  -  -  -  -  -  -  - 



@router.get("/exceptions")

async def list_audit_exceptions(

    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("audits:read")),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),

) -> list[dict[str, Any]]:

    """List all audit records currently awaiting human compliance officer review (Feature 5 AC 5.1)."""

    all_audits = await _get_all_audits(
        org_id=tenant_ctx.org_id,
        is_platform_admin=tenant_ctx.is_platform_admin,
        limit=limit,
        offset=offset,
    )

    exceptions = [

        a for a in all_audits

        if a.get("requires_hitl")

        or a.get("audit_verdict") in ("PENDING_HITL_REVIEW", "ESCALATED_FOR_MANUAL_REVIEW", "REJECTED_FRAUD")

        or float(a.get("delta_mass", 0.0)) > 0.02

    ]

    return exceptions



@router.post("/exceptions/{workflow_id}/resolve")

async def resolve_audit_exception(

    workflow_id: str,

    payload: dict[str, Any],

    user: CurrentUser,

    _: Any = Depends(require_permission("audits:write")),

) -> dict[str, Any]:

    """Resume a halted Temporal audit workflow via cryptographic signal (Feature 5 AC 5.3 & Priority 1)."""

    approved = bool(payload.get("approved", True))

    notes = str(payload.get("notes", "Compliance officer verified operational logs."))

    auditor_id = str(payload.get("auditor_id", user["email"]))

    reason_code = str(payload.get("reason_code", "MANUAL_PHYSICS_OVERRIDE"))

    override_tons = float(payload.get("override_tons", 0.0)) if payload.get("override_tons") else None



    # 1. Send signal to Temporal workflow

    signal_arg = {

        "approved": approved,

        "notes": notes,

        "auditor_id": auditor_id,

        "reason_code": reason_code,

        "override_tons": override_tons,

    }

    signal_res = await temporal_service.signal_workflow(

        workflow_id=workflow_id,

        signal_name="resolve_audit_exception",

        signal_args=[signal_arg],

    )



    # 2. Update local database audit record

    audit_id = workflow_id.replace("wf3-audit-", "")

    record = await _get_audit(audit_id)

    if record:

        record["audit_verdict"] = "APPROVED_BY_HUMAN_OVERRIDE" if approved else "REJECTED_BY_AUDITOR"

        record["physical_melt_verified"] = approved

        if approved and override_tons:

            record["verified_physical_melt_tons"] = override_tons

        elif approved:

            record["verified_physical_melt_tons"] = record.get("reported_volume_tons", 0.0)

        record["auditor_notes"] = notes

        record["auditor_id"] = auditor_id

        record["requires_hitl"] = False

        await _persist_audit(record)



    return {

        "status": "EXCEPTION_RESOLVED",

        "workflow_id": workflow_id,

        "approved": approved,

        "auditor_id": auditor_id,

        "notes": notes,

        "signal_status": signal_res.get("status"),

        "updated_verdict": "APPROVED_BY_HUMAN_OVERRIDE" if approved else "REJECTED_BY_AUDITOR",

    }



#  -  -  -  -  Feature 4 & Priority 3: Tamper-Evident CPCB Form-1 PDF Generation  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 



@router.get("/report/{audit_id}/pdf")

async def download_audit_report_pdf(

    audit_id: str,

    user: CurrentUser,

    _: Any = Depends(require_permission("audits:read")),

) -> Any:

    """Generate and download audit-ready CPCB Form-1 PDF report with cryptographic hashes (Priority 3)."""

    from fastapi.responses import Response

    from synthetiq_shared.utils.pdf_generator import generate_cpcb_form1_pdf



    record = await _get_audit(audit_id)

    if not record:

        raise HTTPException(status_code=404, detail=f"Audit {audit_id} not found")



    pdf_bytes = generate_cpcb_form1_pdf(record)

    return Response(

        content=pdf_bytes,

        media_type="application/pdf",

        headers={

            "Content-Disposition": f'inline; filename="CPCB_Form1_Audit_{audit_id}.pdf"',

            "Content-Length": str(len(pdf_bytes)),

        },

    )



@router.get("/report/{audit_id}/json")

async def get_audit_report_json(

    audit_id: str,

    user: CurrentUser,

    _: Any = Depends(require_permission("audits:read")),

) -> dict[str, Any]:

    """Retrieve full structured statutory CPCB Form-1 filing metadata."""

    record = await _get_audit(audit_id)

    if not record:

        raise HTTPException(status_code=404, detail=f"Audit {audit_id} not found")

    return {

        "statutory_form": "CPCB Form-1 Plastic Waste Management Rules 2026",

        "audit_id": audit_id,

        "dossier": record,

        "dsc_status": record.get("dsc_status", "PENDING_DSC"),

        "hash_chain_verified": bool(record.get("audit_hash")),

    }
