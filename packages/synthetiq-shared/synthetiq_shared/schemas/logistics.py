from pydantic import BaseModel, model_validator
from datetime import date
from typing import Optional

class WeighbridgeSlip(BaseModel):
    slip_id: str
    org_id: str
    plant_id: str
    vehicle_id: str
    gross_weight_kg: float
    tare_weight_kg: float
    net_weight_kg: float
    slip_date: date
    eway_bill_ref: Optional[str] = None

    @model_validator(mode="after")
    def net_equals_gross_minus_tare(self) -> "WeighbridgeSlip":
        expected = round(self.gross_weight_kg - self.tare_weight_kg, 3)
        if abs(self.net_weight_kg - expected) > 0.01:
            raise ValueError(f"net_weight_kg {self.net_weight_kg} != gross-tare {expected}")
        return self

class Invoice(BaseModel):
    invoice_id: str
    org_id: str
    seller_gstin: str
    buyer_gstin: str
    line_items: list[dict]
    total_amount: float
    invoice_date: date
