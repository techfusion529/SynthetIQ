"""Dynamic Configuration ORM and Pydantic models for Phase 3.

Tables: regulatory_packs, org_policies, plant_calibrations, obligation_ledger
Pydantic schemas: RegulatoryPackPayload, OrgPolicySnapshot, PlantCalibrationSnapshot,
                  ObligationLedgerEntry, RunConfig
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel
from sqlalchemy import (
    JSON,
    DateTime,
    Date,
    Float,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from synthetiq_shared.database import Base


# ---------------------------------------------------------------------------
# ORM Models
# ---------------------------------------------------------------------------

class RegulatoryPack(Base):
    """Regulatory pack: versioned set of CPCB/statutory compliance parameters.

    No RLS — platform-wide configuration visible to all authenticated users.
    """
    __tablename__ = "regulatory_packs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex)
    version: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(8), default="IN")
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    created_by: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.user_id"), nullable=True
    )
    approved_by: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.user_id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class OrgPolicy(Base):
    """Per-organisation policy configuration (one row per org)."""
    __tablename__ = "org_policies"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex)
    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), unique=True, nullable=False
    )
    approval_threshold_tons: Mapped[float] = mapped_column(Float, default=0.0)
    categories_in_scope: Mapped[list[str]] = mapped_column(JSON, default=list, server_default="[]")
    signatory_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    signatory_designation: Mapped[str | None] = mapped_column(String(128), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PlantCalibration(Base):
    """Per-plant, per-material SEC baseline calibration rows."""
    __tablename__ = "plant_calibrations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex)
    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), index=True, nullable=False
    )
    plant_id: Mapped[str] = mapped_column(String(64), nullable=False)
    material_grade: Mapped[str] = mapped_column(String(64), nullable=False)
    sec_baseline_kwh_per_ton: Mapped[float] = mapped_column(Float, nullable=False)
    sec_variance: Mapped[float] = mapped_column(Float, nullable=False)
    motor_efficiency: Mapped[float] = mapped_column(Float, default=0.92)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("org_id", "plant_id", "material_grade", "valid_from", name="uq_plant_cal"),
    )


class ObligationLedger(Base):
    """Per-org, per-fiscal-year obligation tracking ledger."""
    __tablename__ = "obligation_ledger"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex)
    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), index=True, nullable=False
    )
    fiscal_year: Mapped[str] = mapped_column(String(16), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    obligation_tons: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)  # onboarding, erp_connector, manual
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("org_id", "fiscal_year", "category", name="uq_obligation"),
    )


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class RegulatoryPackPayload(BaseModel):
    """Validated contents of a regulatory pack JSON payload."""
    category_targets: dict[str, float]
    conversion_factors: dict[str, float]
    base_rate_inr_per_kg: float
    price_corridor_min: float
    price_corridor_max: float
    escrow_split_primary: float
    escrow_split_holdback: float
    delta_threshold_default: float
    fiscal_year_start_month: int
    amortisation_months: int


class OrgPolicySnapshot(BaseModel):
    """Read-only snapshot of an org's policy for use inside a workflow run."""
    approval_threshold_tons: float
    categories_in_scope: list[str]
    signatory_name: str | None
    signatory_designation: str | None
    timezone: str


class PlantCalibrationSnapshot(BaseModel):
    """Read-only snapshot of a single plant calibration row."""
    plant_id: str
    material_grade: str
    sec_baseline_kwh_per_ton: float
    sec_variance: float
    motor_efficiency: float
    valid_from: date
    valid_to: date | None


class ObligationLedgerEntry(BaseModel):
    """A single obligation ledger row used in run configuration."""
    org_id: str
    fiscal_year: str
    category: str
    obligation_tons: float
    source: str


class FacilitySnapshot(BaseModel):
    """Read-only snapshot of an org facility/plant."""
    facility_id: str
    org_id: str
    name: str
    facility_type: str = "recycler_pwp"
    state_code: str = "DL"
    pincode: str | None = None
    cpcb_pwp_reg_no: str | None = None
    cto_number: str | None = None
    licensed_capacity_tons_year: float = 5000.0
    is_active: bool = True


class RunConfig(BaseModel):
    """Complete run-time configuration bundle fetched at workflow Stage 0."""
    pack: RegulatoryPackPayload
    policy: OrgPolicySnapshot
    calibrations: list[PlantCalibrationSnapshot]
    obligations: list[ObligationLedgerEntry]
    facilities: list[FacilitySnapshot] = []
