"""Worker unit and integration tests for AI agent workflows and TypeSafe Jev."""

from __future__ import annotations

import asyncio

from src.activities.agent_activities import (
    AuctionResult,
    audit_scada_telemetry_activity,
    calculate_brand_liability_activity,
    create_escrow_split_po_activity,
    execute_double_auction_activity,
)
from src.flows.workflows import UpstreamLiabilityWorkflow
from src.services.jev_auditor import jev_auditor


def test_jev_genuine_melting_signature():
    """Industrial induction motor under viscous polymer load: PF ~0.85, torque ~45 Nm."""
    result = jev_auditor.evaluate_signature(
        torque_nm=45.0,
        power_factor=0.85,
        active_power_kw=95.0,
        vfd_frequency_hz=50.0,
        melt_rate_kg_h=250.0,
        reported_volume_tons=10.0,
    )
    assert result["physical_melt_verified"] is True
    assert result["verdict"] == "APPROVED"
    assert result["confidence_score"] >= 0.85
    assert result["is_spoofed"] is False


def test_jev_resistive_heater_spoofing_detected():
    """Fraudulent recycler: space heaters drawing power with zero shaft torque: PF ~0.99, torque ~2 Nm."""
    result = jev_auditor.evaluate_signature(
        torque_nm=2.0,
        power_factor=0.99,
        active_power_kw=80.0,
        vfd_frequency_hz=0.0,
        melt_rate_kg_h=0.0,
        reported_volume_tons=10.0,
    )
    assert result["physical_melt_verified"] is False
    assert result["verdict"] == "REJECTED"
    assert result["is_spoofed"] is True
    assert len(result["flags"]) >= 1


def test_brand_liability_one_third_amortization():
    """Verifies statutory 1/3 historic debt carry-forward rule."""
    res = asyncio.run(calculate_brand_liability_activity("COMP-IN-001", "FY2026-27"))
    assert res["historic_debt_tons"] == 3600.0
    assert res["amortized_debt_tons"] == 1200.0  # Exactly 1/3 of 3600
    assert res["net_liability_tons"] == 18500.0 + 1200.0 - 2500.0


def test_continuous_double_auction_corridor():
    """Auction must respect statutory 30% to 100% compensation corridor."""
    base_rate = 10.0
    res = asyncio.run(
        execute_double_auction_activity(
            rfp_id="RFP-001",
            category="cat_i_rigid",
            target_tons=100.0,
            statutory_base_rate=base_rate,
        )
    )
    assert res["statutory_floor"] == 3.0  # 30%
    assert res["statutory_ceiling"] == 10.0  # 100%
    assert res["cleared_tons"] == 100.0
    assert res["status"] == "COMPLETED"
    assert isinstance(res["winner_org_id"], str)
    assert len(res["winner_org_id"]) > 0


def test_auction_result_multi_winner_list_normalization():
    """AuctionResult must normalize list of winner IDs into a single valid string without ValidationError."""
    # List of strings from multi-bidder clearing
    result_with_list = {
        "clearing_price": 6.5,
        "winner_org_id": ["RECYC-SURAT-02", "RECYC-DELHI-01", "RECYC-NOIDA-03"],
        "total_volume_tons": 250.0,
    }
    auction = AuctionResult(**result_with_list)
    assert auction.winner_org_id == "RECYC-SURAT-02"
    assert auction.clearing_price == 6.5

    # List of dicts
    result_with_dict_list = {
        "clearing_price": 7.2,
        "winner_org_id": [{"recycler_id": "RECYC-DELHI-01"}, {"recycler_id": "RECYC-SURAT-02"}],
    }
    auction2 = AuctionResult(**result_with_dict_list)
    assert auction2.winner_org_id == "RECYC-DELHI-01"


def test_escrow_eighty_twenty_split():
    """Tests 80% advance payment and 20% retention split in ERP purchase order."""
    po = asyncio.run(
        create_escrow_split_po_activity(
            company_id="COMP-IN-001",
            recycler_id="RECYC-DELHI-01",
            audit_id="AUD-001",
            plastic_tons=10.0,
            unit_price_inr=8.0,
        )
    )
    assert po["total_amount_inr"] == 80000.0
    assert po["advance_amount_inr"] == 64000.0  # 80%
    assert po["retention_amount_inr"] == 16000.0  # 20%


def test_recycler_bids_simulation():
    """Recycler Bidder agent must generate valid competitive bids within the statutory corridor."""
    from synthetiq_shared.utils.auction_simulator import generate_simulated_bids

    auction_id = "AUC-TEST-SIM-01"
    floor = 3.60
    ceiling = 12.00
    bids = generate_simulated_bids(
        auction_id=auction_id,
        category="cat_i_rigid",
        target_tons=100.0,
        floor_price=floor,
        ceiling_price=ceiling,
    )
    assert len(bids) == 4
    for b in bids:
        assert b["auction_id"] == auction_id
        assert floor <= b["price_per_kg"] <= ceiling
        assert b["volume_tons"] > 0
        assert b["status"] == "BIDDING"
        assert b["recycler_id"].startswith("RECYC-")
