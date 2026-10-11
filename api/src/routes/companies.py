"""Companies router  -  deprecated. All functionality moved to organizations.py.

This module is kept as an empty stub to avoid import errors while the
frontend migrates from /companies to /organizations endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/companies", tags=["Companies (Deprecated)"])
# All endpoints retired. Use /organizations instead.
