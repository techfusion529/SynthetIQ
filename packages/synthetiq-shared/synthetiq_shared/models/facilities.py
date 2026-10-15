"""Operational data models: Facilities, Plastic Categories, E-Way Bills, and Telemetry Batches."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from synthetiq_shared.database import Base


class PlasticCategory(Base):
    """CPCB statutory plastic packaging categories (Schedule II)."""

    __tablename__ = "plastic_categories"

    category_code: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    statutory_schedule: Mapped[str] = mapped_column(String(128), default="Schedule II")
    cpcb_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_penalty_rate_inr_kg: Mapped[float] = mapped_column(Float, default=12.0)
    default_target_percentage: Mapped[float] = mapped_column(Float, default=0.80)
    requires_extrusive_verification: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def to_dict(self) -> dict:
        return {
            "category_code": self.category_code,
            "name": self.name,
            "statutory_schedule": self.statutory_schedule,
            "cpcb_description": self.cpcb_description,
            "default_penalty_rate_inr_kg": self.default_penalty_rate_inr_kg,
            "default_target_percentage": self.default_target_percentage,
            "requires_extrusive_verification": self.requires_extrusive_verification,
        }


class Facility(Base):
    """A physical recycling plant, manufacturing unit, or collection hub owned by an org."""

    __tablename__ = "facilities"

    facility_id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"FAC-{uuid.uuid4().hex[:8].upper()}"
    )
    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    facility_type: Mapped[str] = mapped_column(String(64), default="recycler_pwp")
    state_code: Mapped[str] = mapped_column(String(8), default="DL")
    pincode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    cpcb_pwp_reg_no: Mapped[str | None] = mapped_column(String(128), nullable=True)
    cto_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    cto_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    licensed_capacity_tons_year: Mapped[float] = mapped_column(Float, default=5000.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def to_dict(self) -> dict:
        return {
            "facility_id": self.facility_id,
            "org_id": self.org_id,
            "name": self.name,
            "facility_type": self.facility_type,
            "state_code": self.state_code,
            "pincode": self.pincode,
            "cpcb_pwp_reg_no": self.cpcb_pwp_reg_no,
            "cto_number": self.cto_number,
            "cto_valid_until": self.cto_valid_until.isoformat() if self.cto_valid_until else None,
            "licensed_capacity_tons_year": self.licensed_capacity_tons_year,
            "is_active": self.is_active,
        }


class EWayBillRecord(Base):
    """Logistics consignment transit record for E-Way Bill provenance."""

    __tablename__ = "eway_bills"

    eway_bill_no: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), index=True, nullable=False
    )
    facility_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    transporter_gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    vehicle_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_pincode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    destination_pincode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    category_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    consignment_weight_tons: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(32), default="VERIFIED")
    verification_source: Mapped[str] = mapped_column(String(64), default="NIC_PORTAL")
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def to_dict(self) -> dict:
        return {
            "eway_bill_no": self.eway_bill_no,
            "org_id": self.org_id,
            "facility_id": self.facility_id,
            "transporter_gstin": self.transporter_gstin,
            "vehicle_number": self.vehicle_number,
            "source_pincode": self.source_pincode,
            "destination_pincode": self.destination_pincode,
            "category_code": self.category_code,
            "consignment_weight_tons": self.consignment_weight_tons,
            "status": self.status,
            "verification_source": self.verification_source,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
        }


class TelemetryBatch(Base):
    """An extruder SCADA telemetry batch recording electrical and thermodynamic readings."""

    __tablename__ = "telemetry_batches"

    batch_id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"BATCH-{uuid.uuid4().hex[:8].upper()}"
    )
    facility_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), index=True, nullable=False
    )
    category_code: Mapped[str] = mapped_column(String(64), nullable=False)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    total_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    actual_melt_kg: Mapped[float] = mapped_column(Float, nullable=False)
    avg_torque_nm: Mapped[float] = mapped_column(Float, nullable=False)
    avg_power_factor: Mapped[float] = mapped_column(Float, nullable=False)
    avg_power_kw: Mapped[float] = mapped_column(Float, nullable=False)
    measured_sec_kwh_per_ton: Mapped[float] = mapped_column(Float, nullable=False)
    is_tampered: Mapped[bool] = mapped_column(Boolean, default=False)
    audit_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def to_dict(self) -> dict:
        return {
            "batch_id": self.batch_id,
            "facility_id": self.facility_id,
            "org_id": self.org_id,
            "category_code": self.category_code,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "total_kwh": self.total_kwh,
            "actual_melt_kg": self.actual_melt_kg,
            "avg_torque_nm": self.avg_torque_nm,
            "avg_power_factor": self.avg_power_factor,
            "avg_power_kw": self.avg_power_kw,
            "measured_sec_kwh_per_ton": self.measured_sec_kwh_per_ton,
            "is_tampered": self.is_tampered,
            "audit_id": self.audit_id,
        }
