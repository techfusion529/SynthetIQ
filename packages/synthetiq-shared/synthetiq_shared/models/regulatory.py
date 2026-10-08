"""Regulatory domain models  -  CPCB mandates, conversion factors, and CTO."""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..constants import PlasticCategory, RecyclingChemistry


class ConversionFactor(BaseModel):
    """C_f conversion factor mapping category + chemistry to EPR credit multiplier."""
    category: PlasticCategory
    chemistry: RecyclingChemistry
    factor: float = Field(..., gt=0, le=2.0, description="Conversion factor C_f")
    source_regulation: str = Field(default="CPCB EPR Guidelines 2026")


class ConsentToOperate(BaseModel):
    """Recycler's Consent to Operate (CTO) issued by SPCB."""
    recycler_id: str
    plant_id: str
    plant_name: str
    state: str
    annual_capacity_tons: float = Field(..., gt=0)
    categories_approved: list[PlasticCategory] = Field(default_factory=list)
    chemistry: RecyclingChemistry = RecyclingChemistry.MECHANICAL
    status: str = Field(default="Active", description="Active | Expired | Suspended")
    valid_until: str = Field(default="2027-03-31")
    latitude: float = 0.0
    longitude: float = 0.0


class GovernmentMandate(BaseModel):
    """Parsed CPCB mandate rules for a fiscal year."""
    fiscal_year: str = Field(..., description="e.g., FY2026-27")
    category_targets: dict[str, float] = Field(
        default_factory=dict,
        description="Target tonnage by category for the year",
    )
    amortization_rule: str = Field(
        default="one_third",
        description="Historic debt carry-forward rule",
    )
    amortization_fraction: float = Field(default=1 / 3)
    conversion_factors: list[ConversionFactor] = Field(default_factory=list)
    effective_date: str = ""
    source_document: str = Field(default="CPCB Gazette Notification")
