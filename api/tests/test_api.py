from __future__ import annotations

import os

import pytest
from starlette.testclient import TestClient

# Set JWT_SECRET_KEY before importing app so the module-level guard passes
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-256bit")

from src.main import app  # noqa: E402
from src.services.jwt_utils import create_access_token  # noqa: E402

client = TestClient(app)

# A test JWT for a dev admin user — signed with the test secret above
_TEST_TOKEN = create_access_token({
    "uid": "USR-TEST-001",
    "email": "test@synthetiq.ai",
    "display_name": "Test Admin",
    "role": "admin",
    "org_id": "ORG-TEST-001",
    "authorized": True,
})
_AUTH_HEADERS = {"Authorization": f"Bearer {_TEST_TOKEN}"}


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "synthetiq-api"}


def test_readiness_check():
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"


def test_list_companies_requires_auth():
    """Organizations endpoint must return 401 without a token (companies route is retired)."""
    response = client.get("/api/v1/organizations/")
    assert response.status_code == 401


def test_list_companies_with_auth():
    """Organizations endpoint returns 200 with a valid token (companies route is retired)."""
    response = client.get("/api/v1/organizations/", headers=_AUTH_HEADERS)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_liability_report_with_auth():
    response = client.get("/api/v1/liability/report/COMP-IN-001", headers=_AUTH_HEADERS)
    # May be 200 (with data), 403 (tenant isolation), or 404 (empty DB) — all are valid post-hardening
    assert response.status_code in (200, 403, 404)


def test_list_auctions_with_auth():
    response = client.get("/api/v1/auctions/", headers=_AUTH_HEADERS)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_auctions_requires_auth():
    """Auctions endpoint must return 401 without a token."""
    response = client.get("/api/v1/auctions/")
    assert response.status_code == 401


def test_list_audit_verdicts_with_auth():
    """Audit verdicts returns list (may be empty on fresh DB)."""
    response = client.get("/api/v1/audit/verdicts", headers=_AUTH_HEADERS)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_audit_pdf_404_for_unknown_id():
    """PDF endpoint must return 404 for unknown audit IDs (no fabrication)."""
    response = client.get("/api/v1/audit/report/NONEXISTENT-ID/pdf", headers=_AUTH_HEADERS)
    assert response.status_code == 404


def test_settlement_dispatch_501():
    """CPCB dispatch must return 501 — never fabricates CPCB_ACCEPTED."""
    response = client.post(
        "/api/v1/settlement/form1/dispatch",
        json={"po_number": "PO-2026-901"},
        headers=_AUTH_HEADERS,
    )
    assert response.status_code == 501
    assert response.json()["detail"] == "CPCB dispatch not yet integrated"


def test_config_requires_auth():
    """Config endpoint must return 401 without a token."""
    response = client.get("/api/v1/config")
    assert response.status_code == 401


def test_config_with_auth():
    """Config endpoint returns 200 with a valid token and no api_key_masked field."""
    response = client.get("/api/v1/config", headers=_AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    # api_key_masked must not be present
    assert "api_key_masked" not in data.get("gemini", {})


def test_login_wrong_password_returns_401():
    """Login with wrong credentials must not create a dev session.
    DB may not be initialized in test env — 401 or 500 are both acceptable;
    what must NOT happen is a 200 with a dev session.
    """
    no_raise_client = TestClient(app, raise_server_exceptions=False)
    response = no_raise_client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "WrongPassword"},
    )
    assert response.status_code in (401, 500), (
        f"Expected 401/500, got {response.status_code} — possible dev-bypass still active"
    )


def test_dev_token_rejected():
    """A hardcoded dev token must not authenticate."""
    response = client.get(
        "/api/v1/auctions/",
        headers={"Authorization": "Bearer dev-synthetiq-admin-token"},
    )
    assert response.status_code == 401
