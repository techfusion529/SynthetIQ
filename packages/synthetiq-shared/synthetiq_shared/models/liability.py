"""Liability domain models  -  ERP sales data, liability reports, and sourcing plans."""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..constants import PlasticCategory


class ERPSalesRecord(BaseModel):
    """A single sales record pulled from the company's ERP system."""
    record_id: str
    company_id: str
    fiscal_year: str
    product_sku: str
    product_name: str
    plastic_category: PlasticCategory
    plastic_weight_kg: float = Field(..., gt=0)
    units_sold: int = Field(..., ge=0)
    sale_date: str = ""
    state_code: str = Field(default="", description="Indian state code for regional tracking")


class LiabilityReport(BaseModel):
    """Aggregated plastic liability for a company in a fiscal year.

    Net Liability = Current Year + (Historic Debt  -  -  1/3)  - ' Already Fulfilled
    """
    company_id: str
    fiscal_year: str
    current_year_liability_tons: float = Field(..., ge=0)
    historic_debt_tons: float = Field(default=0.0, ge=0)
    amortized_debt_tons: float = Field(default=0.0, ge=0, description="historic_debt  -  -  1/3")
    already_fulfilled_tons: float = Field(default=0.0, ge=0)
    net_liability_tons: float = Field(
        ..., ge=0,
        description="current_year + amortized_debt  - ' already_fulfilled",
    )
    breakdown_by_category: dict[str, float] = Field(
        default_factory=dict,
        description="Tonnage breakdown by PlasticCategory",
    )
    confidence_score: float = Field(default=1.0, ge=0, le=1.0)


class SourcingAllocation(BaseModel):
    """A single recycler allocation within a sourcing plan."""
    recycler_id: str
    plant_id: str
    category: PlasticCategory
    allocated_tons: float = Field(..., gt=0)
    unit_price_inr: float = Field(default=0.0, ge=0)
    expected_delivery_date: str = ""


class SourcingPlan(BaseModel):
    """Optimized sourcing plan matching liability to recycler capacity."""
    company_id: str
    fiscal_year: str
    total_tons_to_source: float = Field(..., ge=0)
    allocations: list[SourcingAllocation] = Field(default_factory=list)
    estimated_cost_inr: float = Field(default=0.0, ge=0)
    status: str = Field(default="draft", description="draft | approved | executing | completed")
