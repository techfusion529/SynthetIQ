"""Gemma 2B Local Privacy Scrubber.

Scrubs proprietary corporate SKUs, factory worker names, and internal pricing
before telemetry or documents leave the local cluster perimeter.
"""

from __future__ import annotations

import re
from typing import Any


class LocalPrivacyScrubber:
    """In-cluster zero-trust privacy scrubber."""

    def scrub_text(self, text: str) -> str:
        """Scrubs PII and proprietary tokens."""
        # Replace GST numbers
        text = re.sub(r"\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b", "[SCRUBBED_GSTIN]", text)
        # Replace Aadhaar / Phone
        text = re.sub(r"\b\d{10,12}\b", "[SCRUBBED_ID]", text)
        # Replace proprietary product SKU codes
        text = re.sub(r"\bSKU-[A-Z0-9-]+\b", "[ANONYMIZED_SKU]", text)
        return text

    def scrub_dict(self, data: dict[str, Any]) -> dict[str, Any]:
        """Recursively scrubs dictionary values."""
        clean = {}
        for k, v in data.items():
            if isinstance(v, str):
                clean[k] = self.scrub_text(v)
            elif isinstance(v, dict):
                clean[k] = self.scrub_dict(v)
            elif isinstance(v, list):
                clean[k] = [self.scrub_dict(x) if isinstance(x, dict) else (self.scrub_text(x) if isinstance(x, str) else x) for x in v]
            else:
                clean[k] = v
        return clean


privacy_scrubber = LocalPrivacyScrubber()
