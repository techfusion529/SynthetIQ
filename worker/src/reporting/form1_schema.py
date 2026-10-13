"""Form-1 Pydantic schema for CPCB statutory submission PDF generation."""

from __future__ import annotations

from pydantic import BaseModel


class Form1Data(BaseModel):
    """Validated payload required to render a CPCB Form-1 PDF."""

    org_name: str
    fiscal_year: str
    category: str
    volume_tons: float
    compliance_pct: float
    audit_id: str
    po_reference: str
    chain_head: str
    generated_date: str
    is_signed: bool = False
