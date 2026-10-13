from pydantic import BaseModel, field_validator
from datetime import date
from typing import Optional

class SalesLine(BaseModel):
    line_id: str
    org_id: str
    sku: str
    category: str
    quantity_units: float
    unit_weight_kg: float
    sale_date: date
    gstin_buyer: Optional[str] = None

    @field_validator("quantity_units", "unit_weight_kg")
    @classmethod
    def must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("must be positive")
        return v
