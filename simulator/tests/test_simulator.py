"""Unit tests for simulator generators."""

from __future__ import annotations

from src.generators import erp_generator, eway_generator, scada_generator


def test_scada_genuine_generation():
    reading = scada_generator.generate_reading(mode="GENUINE")
    assert reading["simulation_mode"] == "GENUINE"
    assert 0.78 <= reading["power_factor"] <= 0.92
    assert reading["torque_nm"] > 15.0
    assert reading["melt_rate_kg_h"] > 100.0


def test_scada_spoofed_generation():
    reading = scada_generator.generate_reading(mode="RESISTIVE_SPOOF")
    assert reading["simulation_mode"] == "RESISTIVE_SPOOF"
    assert reading["power_factor"] > 0.97  # Pure resistive unity PF
    assert reading["torque_nm"] < 5.0  # Zero shaft torque
    assert reading["melt_rate_kg_h"] == 0.0


def test_erp_sales_generation():
    records = erp_generator.generate_sales_batch(count=3)
    assert len(records) == 3
    for r in records:
        assert r["units_sold"] > 0
        assert r["plastic_weight_kg"] > 0
        assert r["total_plastic_tons"] > 0


def test_eway_bill_generation():
    bill = eway_generator.generate_bill()
    assert bill["hsn_code"] == "3915"
    assert bill["gross_weight_kg"] > bill["tare_weight_kg"]
    assert bill["net_plastic_weight_kg"] > 0
