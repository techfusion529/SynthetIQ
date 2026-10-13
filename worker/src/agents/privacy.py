"""Privacy agent utilities  -  lightweight GSTIN scrubbing.

Provides fast regex-based redaction of GSTIN numbers from free-text and
dictionary payloads before they are forwarded to external LLMs or logged.
"""

from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

# GSTIN format: 2-digit state code + 5-letter PAN body + 4 digits + check chars
_GSTIN_RE = re.compile(
    r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}"
)


def scrub(text: str, org_id: str = "") -> str:
    """Replace all GSTIN occurrences in *text* with ``[GSTIN-REDACTED]``.

    Args:
        text:   Input string potentially containing one or more GSTINs.
        org_id: Caller's organisation identifier (reserved for future
                per-tenant policy; currently unused).

    Returns:
        Scrubbed string with every GSTIN replaced by ``[GSTIN-REDACTED]``.
    """
    return _GSTIN_RE.sub("[GSTIN-REDACTED]", text)


def scrub_dict(data: dict, org_id: str = "") -> dict:
    """Scrub all GSTIN values from a JSON-serialisable *data* dictionary.

    Serialises *data* to JSON, runs :func:`scrub`, then deserialises back.

    Args:
        data:   Arbitrary JSON-serialisable dictionary.
        org_id: Passed through to :func:`scrub`.

    Returns:
        New dictionary with GSTINs redacted from every string value.
    """
    return json.loads(scrub(json.dumps(data), org_id))
