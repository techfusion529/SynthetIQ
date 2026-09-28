"""Enterprise onboarding and ERP profile management routes."""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/companies", tags=["Companies"])

# In-memory store for fast state tracking
_COMPANIES_DB: dict[str, dict[str, Any]] = {
    "COMP-IN-001": {
        "company_id": "COMP-IN-001",
        "name": "Hindustan Consumer Goods Ltd",
        "gstin": "27AAACH1234F1Z5",
        "industry_sector": "FMCG",
        "annual_plastic_footprint_tons": 18500.0,
        "erp_system": "SAP",
        "registered_brands": ["PureClean", "FreshSnack", "EcoBottle"],
    }
}


@router.get("/")
async def list_companies() -> list[dict[str, Any]]:
    """Lists all onboarded enterprise companies."""
    return list(_COMPANIES_DB.values())


@router.get("/{company_id}")
async def get_company(company_id: str) -> dict[str, Any]:
    """Retrieves an onboarded company profile."""
    if company_id not in _COMPANIES_DB:
        raise HTTPException(status_code=404, detail="Company not found")
    return _COMPANIES_DB[company_id]


@router.post("/")
async def onboard_company(payload: dict[str, Any]) -> dict[str, Any]:
    """Onboards a new enterprise into the SynthetIQ platform."""
    company_id = payload.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="company_id is required")
    _COMPANIES_DB[company_id] = payload
    return {"status": "created", "company": payload}
