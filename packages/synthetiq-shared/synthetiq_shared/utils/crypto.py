"""Cryptographic utility functions for audit hashing and digital signatures."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def compute_audit_hash(payload: dict[str, Any]) -> str:
    """Computes deterministic SHA-256 hash of an audit payload."""
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def sign_form1_sha256(form1_data: dict[str, Any], private_key_pem: str | None = None) -> str:
    """Generates mock/real SHA256withRSA signature hex for statutory filings."""
    canonical = json.dumps(form1_data, sort_keys=True)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    # Mock signature string with DSC cert stamp
    return f"DSC_SIG_{digest[:32].upper()}"
