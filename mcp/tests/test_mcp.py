"""Unit tests for MCP Zero-Trust tools."""

from __future__ import annotations

import asyncio

from src.middleware import rate_limiter, zero_trust_auth
from src.tools import bigquery_erp_tool, cpcb_tool, gst_tool, pubsub_scada_tool


def test_bigquery_erp_tool():
    rows = asyncio.run(
        bigquery_erp_tool.execute_sales_query(
            company_id="COMP-IN-001",
            fiscal_year="FY2026-27",
        )
    )
    assert isinstance(rows, list)
    assert len(rows) == 4
    categories = [r["plastic_category"] for r in rows]
    assert "cat_i_rigid" in categories
    assert "cat_ii_flexible" in categories


def test_pubsub_scada_tool():
    telemetry = asyncio.run(
        pubsub_scada_tool.fetch_telemetry_batch(
            recycler_id="RECYC-DELHI-01",
            plant_id="PLANT-OKHLA-2",
            limit=5,
        )
    )
    assert len(telemetry) == 5
    first = telemetry[0]
    assert first["power_factor"] == 0.85
    assert first["torque_nm"] > 0


def test_gst_tool_verification():
    res = asyncio.run(gst_tool.verify_bill("EWB-2026-112233"))
    assert res["status"] == "VALID"
    assert res["is_valid"] is True
    assert res["hsn_code"] == "3915"


def test_cpcb_cto_tool():
    res = asyncio.run(cpcb_tool.verify_cto("RECYC-DELHI-01", "PLANT-01"))
    assert res["status"] == "ACTIVE"
    assert res["annual_capacity_tons"] == 12000.0


def test_zero_trust_middleware():
    assert zero_trust_auth.validate_request(None) is True
    assert rate_limiter.check_rate_limit() is True
