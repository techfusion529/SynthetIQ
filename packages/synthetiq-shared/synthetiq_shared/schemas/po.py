from pydantic import BaseModel
from datetime import date

class PurchaseOrder(BaseModel):
    po_id: str
    org_id: str
    recycler_org_id: str
    volume_tons: float
    unit_price_inr: float
    category: str
    po_date: date
