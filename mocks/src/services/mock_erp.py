"""Mock SAP / Oracle Enterprise ERP system."""

from __future__ import annotations

import time
import uuid
from typing import Any


class MockERPService:
    """Simulates SAP S/4HANA BAPI for Purchase Order and Escrow creation."""

    def __init__(self) -> None:
        self.purchase_orders: dict[str, dict[str, Any]] = {}

    def create_purchase_order(
        self,
        company_id: str,
        vendor_id: str,
        total_amount: float,
        advance_amount: float,
        retention_amount: float,
        line_items: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        po_number = f"SAP-PO-{uuid.uuid4().hex[:8].upper()}"
        po_data = {
            "po_number": po_number,
            "company_id": company_id,
            "vendor_id": vendor_id,
            "total_amount_inr": total_amount,
            "advance_amount_inr": advance_amount,
            "retention_amount_inr": retention_amount,
            "line_items": line_items or [],
            "status": "RELEASED",
            "escrow_account": f"ESCROW-HDFC-{uuid.uuid4().hex[:6].upper()}",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self.purchase_orders[po_number] = po_data
        return po_data

    def get_purchase_order(self, po_number: str) -> dict[str, Any] | None:
        return self.purchase_orders.get(po_number)


mock_erp = MockERPService()
