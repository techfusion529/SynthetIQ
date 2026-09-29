"""SynthetIQ External Mock Services — ERP, CPCB Portal, and DSC signer."""

from __future__ import annotations

from typing import Any
from fastapi import FastAPI, HTTPException

from src.services import mock_cpcb, mock_dsc, mock_erp

app = FastAPI(
    title="SynthetIQ Mocks",
    description="Mock SAP ERP, CPCB National Portal, and DSC Certificate services",
    version="0.1.0",
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "synthetiq-mocks"}


# --- Mock SAP / Oracle ERP Endpoints ---
@app.post("/erp/po")
async def create_erp_purchase_order(payload: dict[str, Any]) -> dict[str, Any]:
    company_id = payload.get("company_id", "COMP-IN-001")
    vendor_id = payload.get("vendor_id", "VENDOR-01")
    total = float(payload.get("total_amount_inr", 100000.0))
    advance = float(payload.get("advance_amount_inr", total * 0.8))
    retention = float(payload.get("retention_amount_inr", total * 0.2))

    return mock_erp.create_purchase_order(
        company_id=company_id,
        vendor_id=vendor_id,
        total_amount=total,
        advance_amount=advance,
        retention_amount=retention,
        line_items=payload.get("line_items", []),
    )


@app.get("/erp/po/{po_number}")
async def get_erp_purchase_order(po_number: str) -> dict[str, Any]:
    po = mock_erp.get_purchase_order(po_number)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


# --- Mock CPCB Portal Endpoints ---
@app.post("/cpcb/form1/submit")
async def submit_cpcb_form1(payload: dict[str, Any]) -> dict[str, Any]:
    return mock_cpcb.submit_form1(
        form_id=payload.get("form_id", "FORM1-DEFAULT"),
        company_id=payload.get("company_id", "COMP-IN-001"),
        recycler_id=payload.get("recycler_id", "RECYC-01"),
        category=payload.get("category", "cat_i_rigid"),
        physical_melt_tons=float(payload.get("physical_melt_tons", 100.0)),
        conversion_factor=float(payload.get("conversion_factor", 1.0)),
        dsc_signature=payload.get("dsc_signature", "DSC_SIG_MOCK"),
    )


@app.get("/cpcb/form1/status/{form_id}")
async def get_cpcb_status(form_id: str) -> dict[str, Any]:
    status = mock_cpcb.get_submission_status(form_id)
    if not status:
        return {"form_id": form_id, "status": "NOT_FOUND"}
    return status


# --- Mock DSC Signer Endpoints ---
@app.post("/dsc/sign")
async def sign_payload_dsc(payload: dict[str, Any]) -> dict[str, Any]:
    return mock_dsc.sign_document(payload)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8002, reload=True)
