"""Mock CPCB (Central Pollution Control Board) EPR compliance portal."""

from __future__ import annotations

import time
import uuid
from typing import Any


class MockCPCBPortalService:
    """Simulates CPCB national online EPR portal submission endpoints."""

    def __init__(self) -> None:
        self.submissions: dict[str, dict[str, Any]] = {}

    def submit_form1(
        self,
        form_id: str,
        company_id: str,
        recycler_id: str,
        category: str,
        physical_melt_tons: float,
        conversion_factor: float,
        dsc_signature: str,
    ) -> dict[str, Any]:
        ack_number = f"ACK-CPCB-2026-{uuid.uuid4().hex[:8].upper()}"
        credit_tons = round(physical_melt_tons * conversion_factor, 2)
        record = {
            "ack_number": ack_number,
            "form_id": form_id,
            "company_id": company_id,
            "recycler_id": recycler_id,
            "category": category,
            "physical_melt_tons": physical_melt_tons,
            "conversion_factor": conversion_factor,
            "credited_compliance_tons": credit_tons,
            "dsc_signature": dsc_signature,
            "status": "ACCEPTED",
            "submitted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self.submissions[form_id] = record
        return record

    def get_submission_status(self, form_id: str) -> dict[str, Any] | None:
        return self.submissions.get(form_id)


mock_cpcb = MockCPCBPortalService()
