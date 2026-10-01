"""Multi-agent system for SynthetIQ EPR compliance — Google ADK based."""

from __future__ import annotations

from src.agents.auditor_agent import auditor_agent, run_auditor_agent
from src.agents.brand_liability_agent import brand_liability_agent, run_brand_liability_agent
from src.agents.erp_agent import erp_agent, run_erp_agent
from src.agents.legal_agent import legal_agent, run_legal_agent
from src.agents.logistics_agent import logistics_agent, run_logistics_agent
from src.agents.orchestrator import epr_compliance_pipeline, run_epr_pipeline
from src.agents.regulatory_agent import regulatory_agent, run_regulatory_agent
from src.agents.treasury_agent import treasury_agent, run_treasury_agent

__all__ = [
    # ADK agent instances
    "brand_liability_agent",
    "regulatory_agent",
    "treasury_agent",
    "logistics_agent",
    "auditor_agent",
    "erp_agent",
    "legal_agent",
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
