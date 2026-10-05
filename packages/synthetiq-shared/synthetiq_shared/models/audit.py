"""Audit domain models — E-Way bills, SCADA telemetry, thermodynamic signatures, and verdicts."""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..constants import PlasticCategory


class EWayBill(BaseModel):
    """GST E-Way bill verifying physical logistics and transport of plastic waste."""
    eway_bill_number: str
    recycler_id: str
    supplier_gstin: str
    recipient_gstin: str
    origin_address: str
    destination_address: str
    gross_weight_kg: float = Field(..., gt=0)
    tare_weight_kg: float = Field(..., ge=0)
    net_weight_kg: float = Field(..., gt=0)
    vehicle_number: str
    transport_mode: str = Field(default="Road")
    hsn_code: str = Field(default="3915", description="Waste, parings and scrap of plastics")
    verification_status: str = Field(default="verified", description="verified | rejected | pending")
    generated_at: str = ""


class TelemetryReading(BaseModel):
    """High-frequency SCADA/VFD telemetry point from an industrial extruder."""
    reading_id: str
    recycler_id: str
    plant_id: str
    timestamp: str
    vfd_frequency_hz: float = Field(..., description="VFD motor drive frequency (Hz)")
    motor_current_amps: float = Field(..., description="Extruder motor current (A)")
    active_power_kw: float = Field(..., description="Active power consumption (kW)")
    power_factor: float = Field(..., ge=0.0, le=1.0, description="cos(phi) power factor")
    torque_nm: float = Field(..., description="Extruder screw torque (Nm)")
    barrel_zone1_temp_c: float = 0.0
    barrel_zone2_temp_c: float = 0.0
    barrel_zone3_temp_c: float = 0.0
    die_temp_c: float = 0.0
    melt_pressure_bar: float = 0.0
    melt_rate_kg_h: float = 0.0


class ThermodynamicSignature(BaseModel):
    """Evaluated physical melting signature comparing electric load to polymer enthalpy."""
    reading_id: str
    recycler_id: str
    plastic_category: PlasticCategory
    expected_thermal_power_kw: float
    measured_electrical_power_kw: float
    torque_signature: str = Field(..., description="genuine_viscous | resistive_idle | disconnected")
    power_factor_type: str = Field(..., description="inductive_motor | pure_resistive_spoofed")
    is_spoofed: bool = False
    spoof_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    anomaly_reasons: list[str] = Field(default_factory=list)


class AuditVerdict(BaseModel):
    """Quad-Core Fraud Audit final verdict — System 1 + System 2 verification."""
    audit_id: str
    recycler_id: str
    plant_id: str
    plastic_category: PlasticCategory
    reported_volume_tons: float = Field(..., gt=0)
    verified_physical_melt_tons: float = Field(..., ge=0)
    physical_melt_verified: bool = False
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    eway_bill_verified: bool = False
    mass_balance_ratio: float = Field(default=1.0, description="Inbound vs processed waste ratio")
    audit_verdict: str = Field(..., description="APPROVED | REJECTED | ESCALATED_FOR_MANUAL_REVIEW")
    rejection_reasons: list[str] = Field(default_factory=list)
    audit_hash: str = Field(default="", description="Cryptographic hash of the audit trail")
    audited_at: str = ""
