"""Settlement domain models — Escrow POs, Form-1 statutory filings, and DSC signatures."""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..constants import ESCROW_ADVANCE_PCT, ESCROW_RETENTION_PCT, PlasticCategory


class EscrowPurchaseOrder(BaseModel):
    """80/20 split-payment escrow purchase order created in corporate ERP."""
    po_number: str
    company_id: str
    recycler_id: str
    plant_id: str
    category: PlasticCategory
    plastic_tons: float = Field(..., gt=0)
    unit_price_inr: float = Field(..., gt=0)
    total_amount_inr: float = Field(..., gt=0)
    advance_amount_inr: float = Field(..., ge=0, description="80% advance payment released on audit pass")
    retention_amount_inr: float = Field(..., ge=0, description="20% held in escrow until CPCB acceptance")
    audit_id: str
    status: str = Field(
        default="pending_approval",
        description="pending_approval | advance_released | fully_settled | cancelled",
    )
    erp_reference_id: str = ""
    created_at: str = ""

    @classmethod
    def create_split(
        cls,
        po_number: str,
        company_id: str,
        recycler_id: str,
        plant_id: str,
        category: PlasticCategory,
        plastic_tons: float,
        unit_price_inr: float,
        audit_id: str,
        created_at: str = "",
    ) -> EscrowPurchaseOrder:
        total = round(plastic_tons * 1000 * unit_price_inr, 2)
        advance = round(total * ESCROW_ADVANCE_PCT, 2)
        retention = round(total * ESCROW_RETENTION_PCT, 2)
        return cls(
            po_number=po_number,
            company_id=company_id,
            recycler_id=recycler_id,
            plant_id=plant_id,
            category=category,
            plastic_tons=plastic_tons,
            unit_price_inr=unit_price_inr,
            total_amount_inr=total,
            advance_amount_inr=advance,
            retention_amount_inr=retention,
            audit_id=audit_id,
            created_at=created_at,
        )


class Form1(BaseModel):
    """CPCB Form-1 statutory plastic waste fulfillment filing."""
    form_id: str
    company_id: str
    fiscal_year: str
    recycler_id: str
    plant_id: str
    plastic_category: PlasticCategory
    physical_melt_tons: float = Field(..., gt=0)
    conversion_factor_cf: float = Field(..., gt=0)
    net_credit_tons: float = Field(..., gt=0, description="physical_melt_tons × conversion_factor_cf")
    po_number: str
    audit_hash: str
    statutory_declaration: str = Field(
        default="I hereby certify that the plastic credits reported above are backed by physical melting.",
    )
    is_signed: bool = False
    submission_status: str = Field(default="draft", description="draft | signed | submitted | accepted | rejected")


class DigitalSignature(BaseModel):
    """X.509 Digital Signature Certificate (DSC) cryptographic stamp."""
    form_id: str
    signer_dn: str = Field(..., description="Distinguished Name of the authorized signatory")
    dsc_serial_number: str
    algorithm: str = Field(default="SHA256withRSA")
    signature_value_hex: str
    timestamp: str = ""
    valid_until: str = ""


class DispatchResult(BaseModel):
    """Result of dispatching Form-1 to the CPCB national portal."""
    dispatch_id: str
    form_id: str
    portal_ack_number: str = ""
    status: str = Field(default="pending", description="pending | success | failed | retry_scheduled")
    status_code: int = 0
    dispatched_at: str = ""
    error_message: str | None = None
    retry_count: int = 0
