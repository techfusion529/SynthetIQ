"""Run input model for SynthetIQ workflow dispatch."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class RunInput(BaseModel):
    """Input payload for dispatching a MasterEPRComplianceWorkflow run."""

    org_id: str
    run_id: str
    company_id: str = ""
    fiscal_year: str = ""
    category: str = ""
    volume_tons: float = 0.0
    recycler_id: str = ""          # replaces hardcoded RECYC-DELHI-01
    plant_id: str = ""             # replaces hardcoded PLANT-OKHLA-2
    eway_bill_ref: str = ""        # replaces hardcoded EWB-2026-99210
    regulatory_pack_version: str = "default"
    simulate_spoof: bool = False   # kept as explicit input, NOT defaulted in code
    schedule_id: Optional[str] = None
    params: dict = {}
