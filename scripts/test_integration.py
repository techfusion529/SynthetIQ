import sys
import os

sys.path.insert(0, os.path.abspath('api'))
sys.path.insert(0, os.path.abspath('packages/synthetiq-shared'))
sys.path.insert(0, os.path.abspath('worker/src'))

import asyncio
from httpx import AsyncClient, ASGITransport
from src.main import app


async def test_full_pipeline():
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer dev-synthetiq-admin-token"}

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Healthcheck
        r_health = await client.get("/health")
        print(f"[OK] Health Status: {r_health.status_code}")
        assert r_health.status_code == 200

        # 2. List Audit Exceptions (HITL Console)
        r_exc = await client.get("/api/v1/audit/exceptions", headers=headers)
        print(f"[OK] List HITL Exceptions: {r_exc.status_code}, Found: {len(r_exc.json())}")
        assert r_exc.status_code == 200
        for exc in r_exc.json():
            print(f"   Exception ID: {exc.get('audit_id')}, Verdict: {exc.get('audit_verdict')}, Delta_mass: {exc.get('delta_mass', 0):.2%}")

        # 3. Resolve Exception via HITL Signal
        r_resolve = await client.post(
            "/api/v1/audit/exceptions/wf3-audit-AUD-2026-885/resolve",
            json={
                "approved": True,
                "notes": "Chief compliance officer verified extruder log: motor drive calibration variance accepted within statutory limits.",
                "auditor_id": "chief_auditor@synthetiq.ai",
                "reason_code": "PHYSICAL_CALIBRATION_OVERRIDE",
                "override_tons": 208.5,
            },
            headers=headers,
        )
        print(f"[OK] Resolve Exception: {r_resolve.status_code}, Response: {r_resolve.json().get('status')}")
        assert r_resolve.status_code == 200
        assert r_resolve.json().get("updated_verdict") == "APPROVED_BY_HUMAN_OVERRIDE"

        # 4. Generate & Download CPCB Form-1 PDF Report (Priority 3)
        r_pdf = await client.get("/api/v1/audit/report/AUD-2026-881/pdf", headers=headers)
        print(f"[OK] CPCB Form-1 PDF: {r_pdf.status_code}, Content-Type: {r_pdf.headers.get('content-type')}, Size: {len(r_pdf.content)} bytes")
        assert r_pdf.status_code == 200
        assert r_pdf.content.startswith(b"%PDF-1.4")
        assert b"%%EOF" in r_pdf.content

        # 5. CPCB Form-1 Structured JSON Dossier
        r_json = await client.get("/api/v1/audit/report/AUD-2026-881/json", headers=headers)
        print(f"[OK] CPCB Form-1 JSON: {r_json.status_code}, DSC Status: {r_json.json().get('dsc_status')}")
        assert r_json.status_code == 200

        # 6. Trigger Fraud Audit with real physics evaluation
        r_audit = await client.post(
            "/api/v1/audit/trigger",
            json={
                "recycler_id": "RECYC-DELHI-01",
                "plant_id": "PLANT-OKHLA-2",
                "category": "cat_i_rigid",
                "volume_tons": 250.0,
                "simulate_spoof": False,
            },
            headers=headers,
        )
        print(f"[OK] Trigger Audit: {r_audit.status_code}, Audit ID: {r_audit.json().get('audit_id')}, Verdict: {r_audit.json().get('audit_verdict')}")
        assert r_audit.status_code == 200

        # 7. Trigger Spoofed Audit (Delta_mass and low torque exception)
        r_spoof = await client.post(
            "/api/v1/audit/trigger",
            json={
                "recycler_id": "RECYC-DELHI-01",
                "plant_id": "PLANT-OKHLA-2",
                "category": "cat_i_rigid",
                "volume_tons": 250.0,
                "simulate_spoof": True,
            },
            headers=headers,
        )
        print(f"[OK] Trigger Spoof Audit: {r_spoof.status_code}, Verdict: {r_spoof.json().get('audit_verdict')}, Requires HITL: {r_spoof.json().get('requires_hitl')}")
        assert r_spoof.status_code == 200
        assert r_spoof.json().get("requires_hitl") is True


if __name__ == "__main__":
    asyncio.run(test_full_pipeline())
    print("\n All integration tests passed cleanly!")
