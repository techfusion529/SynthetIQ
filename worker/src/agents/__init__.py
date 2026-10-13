"""Multi-agent system for SynthetIQ EPR compliance  -  Google ADK based."""

from __future__ import annotations

from .auditor_agent import AUDITOR_INSTRUCTION, run_auditor_agent
from .brand_liability_agent import BRAND_LIABILITY_INSTRUCTION, run_brand_liability_agent
from .erp_agent import ERP_INSTRUCTION, run_erp_agent
from .legal_agent import LEGAL_INSTRUCTION, run_legal_agent
from .logistics_agent import LOGISTICS_INSTRUCTION, run_logistics_agent
from .orchestrator import epr_compliance_pipeline, run_epr_pipeline
from .regulatory_agent import REGULATORY_INSTRUCTION, run_regulatory_agent
from .treasury_agent import TREASURY_INSTRUCTION, run_treasury_agent

__all__ = [
    # ADK instruction constants (module-level, always available)
    "AUDITOR_INSTRUCTION",
    "BRAND_LIABILITY_INSTRUCTION",
    "ERP_INSTRUCTION",
    "LEGAL_INSTRUCTION",
    "LOGISTICS_INSTRUCTION",
    "REGULATORY_INSTRUCTION",
    "TREASURY_INSTRUCTION",
    # Pipeline
    "epr_compliance_pipeline",
    # Convenience runners
    "run_brand_liability_agent",
    "run_regulatory_agent",
    "run_treasury_agent",
    "run_logistics_agent",
    "run_auditor_agent",
    "run_erp_agent",
    "run_legal_agent",
    "run_epr_pipeline",
]
