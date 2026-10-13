from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional

class TelemetryFrame(BaseModel):
    frame_id: str
    org_id: str
    plant_id: str
    timestamp: datetime
    energy_kwh: float          # measured, not derived
    mass_processed_kg: float
    motor_load_pct: Optional[float] = None
    power_factor: Optional[float] = None

    @field_validator("energy_kwh", "mass_processed_kg")
    @classmethod
    def must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("must be positive")
        return v
