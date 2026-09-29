"""Unit and integration tests for mock external services."""

from __future__ import annotations

from starlette.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_mocks_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "synthetiq-mocks"}


def test_create_erp_po():
    payload = {
        "company_id": "COMP-IN-001",
        "vendor_id": "RECYC-DELHI-01",
        "total_amount_inr": 200000.0,
        "advance_amount_inr": 160000.0,
        "retention_amount_inr": 40000.0,
    }
    res = client.post("/erp/po", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RELEASED"
    assert data["advance_amount_inr"] == 160000.0
    assert data["retention_amount_inr"] == 40000.0
    po_num = data["po_number"]

    # Retrieve PO
    res_get = client.get(f"/erp/po/{po_num}")
    assert res_get.status_code == 200
    assert res_get.json()["po_number"] == po_num


def test_cpcb_form1_submission():
    payload = {
        "form_id": "FORM1-TEST-001",
        "company_id": "COMP-IN-001",
        "recycler_id": "RECYC-DELHI-01",
        "category": "cat_i_rigid",
        "physical_melt_tons": 50.0,
        "conversion_factor": 1.0,
        "dsc_signature": "DSC_SIG_123456",
    }
    res = client.post("/cpcb/form1/submit", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ACCEPTED"
    assert data["credited_compliance_tons"] == 50.0
    assert data["ack_number"].startswith("ACK-CPCB-2026-")

    # Status check
    res_status = client.get("/cpcb/form1/status/FORM1-TEST-001")
    assert res_status.status_code == 200
    assert res_status.json()["status"] == "ACCEPTED"


def test_dsc_sign_payload():
    payload = {"form_id": "FORM1-TEST-001", "tons": 50.0}
    res = client.post("/dsc/sign", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert data["signature_value"].startswith("DSC_SIG_")
