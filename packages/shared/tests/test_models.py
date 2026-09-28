from __future__ import annotations
from src.constants import (
    COMPENSATION_CORRIDOR_MAX_PCT,
    COMPENSATION_CORRIDOR_MIN_PCT,
    ESCROW_ADVANCE_PCT,
    ESCROW_RETENTION_PCT,
    PlasticCategory,
)
from src.models import (
    AuditVerdict,
    CompensationCorridor,
    EscrowPurchaseOrder,
    Form1,
    LiabilityReport,
    OnboardedCompany,
)
from src.utils.crypto import compute_audit_hash, sign_form1_sha256


def test_onboarded_company_creation():
    company = OnboardedCompany(
        company_id="COMP-001",
        name="Acme Consumer Goods",
        gstin="27AAPCA1234A1Z5",
        industry_sector="FMCG",
        annual_plastic_footprint_tons=12500.0,
    )
    assert company.company_id == "COMP-001"
    assert company.annual_plastic_footprint_tons == 12500.0


def test_liability_net_calculation():
    current_year = 1000.0
    historic_debt = 300.0
    amortized = historic_debt * (1 / 3)  # 100.0
    fulfilled = 200.0
    net = current_year + amortized - fulfilled  # 900.0

    report = LiabilityReport(
        company_id="COMP-001",
        fiscal_year="FY2026-27",
        current_year_liability_tons=current_year,
        historic_debt_tons=historic_debt,
        amortized_debt_tons=amortized,
        already_fulfilled_tons=fulfilled,
        net_liability_tons=net,
        breakdown_by_category={"cat_i_rigid": 500.0, "cat_ii_flexible": 400.0},
    )
    assert report.net_liability_tons == 900.0
    assert report.amortized_debt_tons == 100.0


def test_compensation_corridor_calculation():
    base_rate = 10.0  # INR per kg
    corridor = CompensationCorridor.calculate(PlasticCategory.CAT_I, base_rate)
    assert corridor.floor_price_inr_per_kg == 3.0  # 30%
    assert corridor.ceiling_price_inr_per_kg == 10.0  # 100%


def test_escrow_split_po_creation():
    po = EscrowPurchaseOrder.create_split(
        po_number="PO-2026-001",
        company_id="COMP-001",
        recycler_id="RECYC-42",
        plant_id="PLANT-01",
        category=PlasticCategory.CAT_I,
        plastic_tons=10.0,
        unit_price_inr=5.0,  # 5 INR/kg
        audit_id="AUD-999",
    )
    # 10 tons = 10,000 kg * 5 = 50,000 INR
    assert po.total_amount_inr == 50000.0
    assert po.advance_amount_inr == 40000.0  # 80%
    assert po.retention_amount_inr == 10000.0  # 20%
    assert po.advance_amount_inr + po.retention_amount_inr == po.total_amount_inr


def test_audit_hash_and_digital_signature():
    payload = {"audit_id": "AUD-001", "verdict": "APPROVED", "tons": 25.0}
    hash_val = compute_audit_hash(payload)
    assert isinstance(hash_val, str)
    assert len(hash_val) == 64  # SHA-256 hex length

    sig = sign_form1_sha256(payload)
    assert sig.startswith("DSC_SIG_")
