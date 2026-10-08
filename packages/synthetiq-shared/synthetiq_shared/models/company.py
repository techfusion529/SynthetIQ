"""Company domain models  -  onboarded enterprise profiles and ERP configuration."""

from __future__ import annotations

from pydantic import BaseModel, Field


class OnboardedCompany(BaseModel):
    """An enterprise onboarded into the SynthetIQ platform."""
    company_id: str = Field(..., description="Unique company identifier (e.g., COMP-IN-001)")
    name: str = Field(..., description="Legal entity name")
    gstin: str = Field(..., description="GST Identification Number (15 chars)")
    industry_sector: str = Field(..., description="e.g., FMCG, Pharma, Automotive, Electronics")
    annual_plastic_footprint_tons: float = Field(..., ge=0, description="Total plastic packaging tonnage per FY")
    registered_address: str = ""
    contact_email: str = ""


class CompanyProfile(BaseModel):
    """Extended company profile with ERP and plastic category details."""
    company_id: str
    erp_system: str = Field(default="SAP", description="ERP vendor: SAP or Oracle")
    plastic_categories_used: list[str] = Field(default_factory=list, description="e.g., [cat_i_rigid, cat_ii_flexible]")
    registered_brands: list[str] = Field(default_factory=list)
    fiscal_year_start_month: int = Field(default=4, description="Indian FY starts April")


class CompanyERPConfig(BaseModel):
    """Simulated ERP connection parameters for an onboarded company."""
    company_id: str
    erp_endpoint: str = Field(default="http://mocks:8002/erp", description="Mock ERP API base URL")
    data_refresh_cron: str = Field(default="0 2 * * *", description="Daily 2 AM data sync schedule")
    api_key: str = Field(default="mock-erp-key")
