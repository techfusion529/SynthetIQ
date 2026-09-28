from __future__ import annotations

from starlette.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "synthetiq-api"}


def test_readiness_check():
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"


def test_list_companies():
    response = client.get("/api/v1/companies/")
    assert response.status_code == 200
    companies = response.json()
    assert isinstance(companies, list)
    assert len(companies) >= 1
    assert companies[0]["company_id"] == "COMP-IN-001"


def test_get_liability_report():
    response = client.get("/api/v1/liability/report/COMP-IN-001")
    assert response.status_code == 200
    data = response.json()
    assert data["company_id"] == "COMP-IN-001"
    assert data["net_liability_tons"] == 17200.0


def test_list_auctions():
    response = client.get("/api/v1/auctions/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_list_audit_verdicts():
    response = client.get("/api/v1/audit/verdicts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["physical_melt_verified"] is True


def test_approve_settlement_dev_mode():
    response = client.post(
        "/api/v1/settlement/approve",
        json={"audit_id": "AUD-2026-881", "action": "APPROVE"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "approved"
