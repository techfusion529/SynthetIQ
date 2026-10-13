"""MCP GST E-Way bill verification tool  -  UNVERIFIED stub pending live API connection."""

from __future__ import annotations

from typing import Any


class GSTVerificationTool:
    """Stub proxy for GST E-Way bill verification. Returns UNVERIFIED until live API is connected."""

    async def verify_bill(self, eway_bill_number: str) -> dict[str, Any]:
        """Returns UNVERIFIED stub — live GST E-Way Bill API not yet connected."""
        bill_str = str(eway_bill_number).strip().upper()
        return {
            "status": "UNVERIFIED",
            "message": "Live GST E-Way Bill API not connected. Manual verification required.",
            "verified": False,
            "eway_bill_number": bill_str,
        }


gst_tool = GSTVerificationTool()
