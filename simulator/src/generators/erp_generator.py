"""Enterprise ERP sales records generator."""

from __future__ import annotations

import random
from typing import Any


class ERPSalesGenerator:
    """Generates synthetic sales invoices with plastic packaging SKU metadata."""

    def generate_sales_batch(
        self,
        company_id: str = "COMP-IN-001",
        fiscal_year: str = "FY2026-27",
        count: int = 5,
    ) -> list[dict[str, Any]]:
        categories = ["cat_i_rigid", "cat_ii_flexible", "cat_iii_mlp", "cat_iv_compostable"]
        records = []
        for i in range(count):
            cat = random.choice(categories)
            units = random.randint(10000, 500000)
            weight = round(random.uniform(0.01, 0.05), 3)
            records.append({
                "record_id": f"ERP-{company_id}-{i+1}",
                "company_id": company_id,
                "fiscal_year": fiscal_year,
                "product_sku": f"SKU-{cat.upper()[:5]}-{random.randint(100, 999)}",
                "plastic_category": cat,
                "plastic_weight_kg": weight,
                "units_sold": units,
                "total_plastic_tons": round((units * weight) / 1000.0, 2),
            })
        return records


erp_generator = ERPSalesGenerator()
