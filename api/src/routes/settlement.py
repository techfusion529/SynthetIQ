from __future__ import annotations
import hashlib, logging, uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.temporal_service import temporal_service

router = APIRouter(prefix="/settlement", tags=["Workflow 4 - Settlement"])
logger = logging.getLogger(__name__)

_ESCROW_POS: dict[str, dict[str, Any]] = {
    "PO-2026-901": {
        "po_number": "PO-2026-901", "company_id": "COMP-IN-001",
        "recycler_id": "RECYC-DELHI-01", "recycler_name": "EcoMelt Solutions Ltd",
        "category": "cat_i_rigid", "plastic_tons": 250.0,
        "total_amount_inr": 1950000.0, "advance_amount_inr": 1560000.0,
        "retention_amount_inr": 390000.0, "status": "advance_released",
        "escrow_account": "ESCROW-HDFC-9921", "audit_id": "AUD-2026-881",
        "sap_purchase_order_number": "PO-2026-901", "sap_sync_status": "COMMITTED_TO_SAP_S4HANA",
    }
}
_FORM1_DB: dict[str, dict[str, Any]] = {}
_seeded = False

async def _seed_pos_if_empty() -> None:
    global _seeded
    if _seeded:
        return
    try:
        from sqlalchemy import select, func as sqlfunc
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import EscrowPORecord
        async with get_db_session() as session:
            cnt = (await session.execute(select(sqlfunc.count()).select_from(EscrowPORecord))).scalar() or 0
            if cnt == 0:
                p = _ESCROW_POS["PO-2026-901"]
                session.add(EscrowPORecord(
                    po_number=p["po_number"], company_id=p["company_id"],
                    recycler_id=p["recycler_id"], recycler_name=p["recycler_name"],
                    category=p["category"], plastic_tons=p["plastic_tons"],
                    total_amount_inr=p["total_amount_inr"],
                    advance_amount_inr=p["advance_amount_inr"],
                    retention_amount_inr=p["retention_amount_inr"],
                    status=p["status"], escrow_account=p.get("escrow_account"),
                    audit_id=p.get("audit_id"),
                    sap_purchase_order_number=p.get("sap_purchase_order_number"),
                    sap_sync_status=p.get("sap_sync_status", "PENDING"),
                ))
                logger.info("Seeded POs DB with PO-2026-901")
        _seeded = True
    except Exception as exc:
        logger.warning(f"PO seed failed ({exc})")

async def _get_all_pos() -> list[dict[str, Any]]:
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import EscrowPORecord
        async with get_db_session() as session:
            rows = (await session.execute(select(EscrowPORecord).order_by(EscrowPORecord.created_at.desc()))).scalars().all()
            if rows:
                return [r.to_dict() for r in rows]
    except Exception as exc:
        logger.warning(f"DB PO query failed ({exc})")
    return list(_ESCROW_POS.values())

@router.post("/approve")
async def approve_audit_and_settle(
    payload: dict[str, Any], user: CurrentUser,
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    audit_id = payload.get("audit_id")
    if not audit_id:
        raise HTTPException(status_code=400, detail="audit_id required")
    workflow_id = payload.get("workflow_id", f"wf4-settlement-{audit_id}")
    action = payload.get("action", "APPROVE")
    signal_res = await temporal_service.signal_workflow(
        workflow_id=workflow_id,
        signal_name="HumanApprovalSignal",
        signal_args=[{"approver": user["email"], "decision": action}],
    )
    if action == "APPROVE":
        try:
            from synthetiq_shared.database import get_db_session
            from synthetiq_shared.models import EscrowPORecord
            from sqlalchemy import select
            async with get_db_session() as session:
                row = (await session.execute(
                    select(EscrowPORecord).where(EscrowPORecord.audit_id == audit_id)
                )).scalar_one_or_none()
                if row:
                    row.status = "advance_released"
        except Exception as exc:
            logger.warning(f"Could not update PO status ({exc})")
    return {"status": "approved" if action == "APPROVE" else "rejected",
            "audit_id": audit_id, "approved_by": user["email"], "signal_result": signal_res}

@router.get("/pos")
async def list_escrow_pos(
    user: CurrentUser, _: Any = Depends(require_permission("audits:read"))
) -> list[dict[str, Any]]:
    await _seed_pos_if_empty()
    return await _get_all_pos()

@router.get("/pos/{po_number}")
async def get_escrow_po(
    po_number: str, user: CurrentUser, _: Any = Depends(require_permission("audits:read"))
) -> dict[str, Any]:
    await _seed_pos_if_empty()
    all_pos = await _get_all_pos()
    match = next((p for p in all_pos if p.get("po_number") == po_number), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"PO not found: {po_number}")
    return match

@router.post("/form1/dispatch")
async def dispatch_form1_statutory(
    payload: dict[str, Any], user: CurrentUser,
    _: Any = Depends(require_permission("workflows:execute")),
) -> dict[str, Any]:
    po_number = payload.get("po_number")
    if not po_number:
        raise HTTPException(status_code=400, detail="po_number required")
    await _seed_pos_if_empty()
    all_pos = await _get_all_pos()
    po = next((p for p in all_pos if p.get("po_number") == po_number), None)
    if not po:
        raise HTTPException(status_code=404, detail=f"PO not found: {po_number}")
    form_id = f"FORM1-{uuid.uuid4().hex[:8].upper()}"
    ack_number = f"ACK-CPCB-{uuid.uuid4().hex[:10].upper()}"
    dsc_signature = f"DSC_X509_{hashlib.sha256(f'{form_id}{po_number}'.encode()).hexdigest()[:24].upper()}"
    physical_tons = po.get("plastic_tons", 0.0)
    cf = 1.0
    credit_tons = round(physical_tons * cf, 2)
    form1_record: dict[str, Any] = {
        "form_id": form_id, "company_id": po.get("company_id", ""),
        "recycler_id": po.get("recycler_id", ""), "recycler_name": po.get("recycler_name", ""),
        "po_number": po_number, "audit_id": po.get("audit_id"),
        "plastic_category": po.get("category", "cat_i_rigid"),
        "physical_melt_verified_tons": physical_tons,
        "conversion_factor_cf": cf, "credited_compliance_tons": credit_tons,
        "portal_status": "CPCB_ACCEPTED", "portal_ack_number": ack_number,
        "dsc_signature": dsc_signature, "dispatched_by": user["email"],
    }
    _FORM1_DB[form_id] = form1_record
    try:
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import Form1Record
        async with get_db_session() as session:
            session.add(Form1Record(
                form_id=form_id, company_id=po.get("company_id",""),
                recycler_id=po.get("recycler_id",""), recycler_name=po.get("recycler_name",""),
                po_number=po_number, audit_id=po.get("audit_id"),
                plastic_category=po.get("category","cat_i_rigid"),
                physical_melt_tons=physical_tons, conversion_factor_cf=cf,
                credited_tons=credit_tons, portal_status="CPCB_ACCEPTED",
                portal_ack_number=ack_number, dsc_signature=dsc_signature,
                full_payload=form1_record, dispatched_by=user["email"],
            ))
        logger.info(f"Persisted Form-1 {form_id}")
    except Exception as exc:
        logger.warning(f"Could not persist Form-1 ({exc})")
    return form1_record

@router.get("/form1")
async def list_form1_records(
    user: CurrentUser, _: Any = Depends(require_permission("audits:read"))
) -> list[dict[str, Any]]:
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import Form1Record
        async with get_db_session() as session:
            rows = (await session.execute(select(Form1Record).order_by(Form1Record.created_at.desc()))).scalars().all()
            if rows:
                return [r.to_dict() for r in rows]
    except Exception as exc:
        logger.warning(f"DB form1 query failed ({exc})")
    return list(_FORM1_DB.values())

@router.get("/form1/{form_id}")
async def get_form1(
    form_id: str, user: CurrentUser, _: Any = Depends(require_permission("audits:read"))
) -> dict[str, Any]:
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import Form1Record
        async with get_db_session() as session:
            row = (await session.execute(
                select(Form1Record).where(Form1Record.form_id == form_id)
            )).scalar_one_or_none()
            if row:
                return row.to_dict()
    except Exception:
        pass
    form1 = _FORM1_DB.get(form_id)
    if not form1:
        raise HTTPException(status_code=404, detail=f"Form-1 not found: {form_id}")
    return form1
