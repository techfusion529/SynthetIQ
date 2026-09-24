"""SynthetIQ test configuration and shared fixtures."""

import pytest


@pytest.fixture
def sample_company_id() -> str:
    """Default test company ID."""
    return "COMP-IN-001"


@pytest.fixture
def sample_fiscal_year() -> int:
    """Default test fiscal year."""
    return 2026
