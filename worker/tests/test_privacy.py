"""Unit tests for agents.privacy scrub utilities."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

# Ensure worker/src is on the path when tests run directly via pytest.
# We insert src/agents directly so the import of 'privacy' bypasses the
# agents/__init__.py which has heavy ADK dependencies unavailable in CI.
_agents_dir = str(Path(__file__).parent.parent / "src" / "agents")
if _agents_dir not in sys.path:
    sys.path.insert(0, _agents_dir)

privacy = importlib.import_module("privacy")
scrub = privacy.scrub


def test_scrub_removes_gstin() -> None:
    """A valid GSTIN in the input must be replaced with [GSTIN-REDACTED]."""
    result = scrub("27AAACH1234F1Z5", "")
    assert "[GSTIN-REDACTED]" in result


def test_scrub_passthrough() -> None:
    """Plain text without a GSTIN must pass through unchanged."""
    assert scrub("hello world", "") == "hello world"
