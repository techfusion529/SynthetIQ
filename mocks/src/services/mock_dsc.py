"""Mock Digital Signature Certificate (DSC) signer."""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from typing import Any


class MockDSCService:
    """Simulates hardware cryptographic token (USB token / CCA eSign)."""

    def sign_document(self, payload: dict[str, Any], signer_dn: str = "CN=Authorized Signatory, O=SynthetIQ PIBO") -> dict[str, Any]:
        serialized = json.dumps(payload, sort_keys=True)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        sig_hex = f"DSC_SIG_{digest[:32].upper()}"

        return {
            "signature_value": sig_hex,
            "signer_dn": signer_dn,
            "certificate_serial": f"CERT-{uuid.uuid4().hex[:12].upper()}",
            "algorithm": "SHA256withRSA",
            "signed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "valid": True,
        }


mock_dsc = MockDSCService()
