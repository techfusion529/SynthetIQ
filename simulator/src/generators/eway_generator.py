"""GST E-Way bill logistics generator."""

from __future__ import annotations

import random
import time
from typing import Any


class EWayBillGenerator:
    """Generates logistics movement documents with gross and tare weighbridge records."""

    def generate_bill(
        self,
        recycler_id: str = "RECYC-DELHI-01",
        waste_category: str = "cat_i_rigid",
    ) -> dict[str, Any]:
        tare = round(random.uniform(12000.0, 14000.0), 1)
        net_waste = round(random.uniform(14000.0, 18000.0), 1)
        gross = round(tare + net_waste, 1)

        return {
            "eway_bill_number": f"EWB-2026-{random.randint(10000000, 99999999)}",
            "recycler_id": recycler_id,
            "waste_category": waste_category,
            "hsn_code": "3915",
            "vehicle_number": f"DL-01-AB-{random.randint(1000, 9999)}",
            "gross_weight_kg": gross,
            "tare_weight_kg": tare,
            "net_plastic_weight_kg": net_waste,
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "status": "ACTIVE_TRANSIT",
        }


eway_generator = EWayBillGenerator()
