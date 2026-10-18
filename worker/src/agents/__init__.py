"""Multi-agent system for SynthetIQ EPR compliance  -  Google ADK based.

Agents are imported lazily to avoid loading google.adk at module init time
(google.adk requires a live runtime environment and service credentials).
Import individual agents directly, e.g.:

    from agents.logistics_agent import run_logistics_agent
"""

from __future__ import annotations

# Lazy __getattr__ so that `from agents.X import Y` still works without
# importing every agent (and their google.adk deps) at package load time.

__all__ = [
    "AUDITOR_INSTRUCTION",
    "BRAND_LIABILITY_INSTRUCTION",
    "ERP_INSTRUCTION",
    "LEGAL_INSTRUCTION",
    "LOGISTICS_INSTRUCTION",
    "REGULATORY_INSTRUCTION",
    "TREASURY_INSTRUCTION",
    "epr_compliance_pipeline",
    "run_brand_liability_agent",
    "run_regulatory_agent",
    "run_treasury_agent",
    "run_recycler_bidder_agent",
    "run_logistics_agent",
    "run_auditor_agent",
    "run_erp_agent",
    "run_legal_agent",
    "run_epr_pipeline",
]

_MODULE_MAP: dict[str, str] = {
    "AUDITOR_INSTRUCTION": "agents.auditor_agent",
    "run_auditor_agent": "agents.auditor_agent",
    "BRAND_LIABILITY_INSTRUCTION": "agents.brand_liability_agent",
    "run_brand_liability_agent": "agents.brand_liability_agent",
    "ERP_INSTRUCTION": "agents.erp_agent",
    "run_erp_agent": "agents.erp_agent",
    "LEGAL_INSTRUCTION": "agents.legal_agent",
    "run_legal_agent": "agents.legal_agent",
    "LOGISTICS_INSTRUCTION": "agents.logistics_agent",
    "run_logistics_agent": "agents.logistics_agent",
    "REGULATORY_INSTRUCTION": "agents.regulatory_agent",
    "run_regulatory_agent": "agents.regulatory_agent",
    "TREASURY_INSTRUCTION": "agents.treasury_agent",
    "run_treasury_agent": "agents.treasury_agent",
    "run_recycler_bidder_agent": "agents.recycler_bidder",
    "epr_compliance_pipeline": "agents.orchestrator",
    "run_epr_pipeline": "agents.orchestrator",
}


def __getattr__(name: str):
    if name in _MODULE_MAP:
        import importlib
        mod = importlib.import_module(_MODULE_MAP[name])
        return getattr(mod, name)
    raise AttributeError(f"module 'agents' has no attribute {name!r}")
