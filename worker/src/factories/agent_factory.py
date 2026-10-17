"""Per-run agent factory.

Creates fresh LlmAgent instances per (org, run) pair, pulling configuration
from AgentConfiguration rows and validating against an allowlist.
Module-level singletons are intentionally absent — every workflow run gets
its own agent instance to avoid cross-run state contamination.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from temporalio.exceptions import ApplicationError

from utils.metrics import llm_tokens_total

logger = logging.getLogger(__name__)

ALLOWED_MODEL_IDS = frozenset([
    "gemini-3.8-flash",
])
FORBIDDEN_PROMPT_KEYWORDS = frozenset(["verdict=", "always_pass", "skip_gate"])

MAX_LLM_TOKENS = int(os.getenv("MAX_LLM_TOKENS_PER_ORG_PER_MONTH", "1000000"))


async def _check_cost_cap(org_id: str) -> None:
    """Raise ApplicationError if the current-month token sum exceeds MAX_LLM_TOKENS.

    Wraps DB query in try/except so a DB outage does not block agent creation.
    """
    try:
        from datetime import date, timezone
        from sqlalchemy import select, func as sa_func
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import LlmUsageLog

        now = date.today()
        month_start_str = f"{now.year}-{now.month:02d}-01"

        async with get_db_session() as session:
            result = await session.execute(
                select(
                    sa_func.coalesce(
                        sa_func.sum(LlmUsageLog.input_tokens + LlmUsageLog.output_tokens),
                        0,
                    )
                ).where(
                    LlmUsageLog.org_id == org_id,
                    LlmUsageLog.created_at >= month_start_str,
                )
            )
            total_tokens: int = result.scalar_one() or 0

        if total_tokens > MAX_LLM_TOKENS:
            raise ApplicationError(
                f"LLM_COST_CAP_EXCEEDED: org {org_id} has used {total_tokens} tokens "
                f"this month (cap: {MAX_LLM_TOKENS}).",
                non_retryable=True,
            )
    except ApplicationError:
        raise
    except Exception as exc:
        logger.warning(f"[AgentFactory] Cost-cap DB check failed for org={org_id}: {exc}; proceeding.")


async def create_agent(agent_name: str, org_id: str, run_id: str) -> Any:
    """Return a configured ADK LlmAgent for the given (org, agent) pair.

    Falls back to platform defaults if no AgentConfiguration row exists.

    Args:
        agent_name: One of the canonical agent names (e.g. "auditor", "treasury").
        org_id: Tenant organisation ID used to look up the AgentConfiguration row.
        run_id: Workflow run ID (for logging/tracing only).

    Returns:
        A freshly constructed LlmAgent instance.
    """
    # Cost-cap guard: raises ApplicationError(non_retryable=True) if over cap
    await _check_cost_cap(org_id)

    from sqlalchemy import select
    from synthetiq_shared.database import get_db_session
    from synthetiq_shared.models import AgentConfiguration

    model_id = "gemini-3.8-flash"
    temperature = 0.2
    system_prompt: str | None = None

    async with get_db_session() as session:
        res = await session.execute(
            select(AgentConfiguration)
            .where(AgentConfiguration.org_id == org_id)
            .where(AgentConfiguration.agent_name == agent_name)
            .where(AgentConfiguration.is_active.is_(True))
        )
        cfg = res.scalar_one_or_none()

    if cfg:
        # Validate model_id against allowlist
        if cfg.model_name not in ALLOWED_MODEL_IDS:
            logger.warning(
                f"[AgentFactory] model_id {cfg.model_name!r} not in allowlist for "
                f"org={org_id}, agent={agent_name}. Falling back to gemini-3.8-flash."
            )
        else:
            model_id = cfg.model_name
        temperature = cfg.temperature

        # Validate prompt for forbidden keywords
        if cfg.system_prompt:
            forbidden_found = [kw for kw in FORBIDDEN_PROMPT_KEYWORDS if kw in cfg.system_prompt]
            if forbidden_found:
                logger.warning(
                    f"[AgentFactory] Prompt for org={org_id}, agent={agent_name} contains "
                    f"forbidden keywords {forbidden_found}. Ignoring custom prompt."
                )
            else:
                system_prompt = cfg.system_prompt

    logger.debug(
        f"[AgentFactory] Building agent={agent_name!r} model={model_id!r} "
        f"org={org_id!r} run={run_id!r}"
    )
    agent = _build_agent(
        agent_name, model_id=model_id, temperature=temperature, system_prompt=system_prompt
    )

    # Emit Prometheus counter for observability (best-effort)
    try:
        llm_tokens_total.labels(
            org_id=org_id, agent_name=agent_name, model=model_id
        ).inc(0)  # Registers the label-set; actual token counts updated by activities
    except Exception as _prom_exc:
        logger.debug(f"[AgentFactory] Prometheus counter inc skipped: {_prom_exc}")

    return agent


def _build_agent(
    agent_name: str,
    model_id: str,
    temperature: float,
    system_prompt: str | None,
) -> Any:
    """Instantiate the named agent with given model/prompt overrides."""
    _REGISTRY = {
        "auditor":             _build_auditor,
        "brand_liability":     _build_brand_liability,
        "regulatory_watchdog": _build_regulatory,
        "treasury":            _build_treasury,
        "logistics":           _build_logistics,
        "erp":                 _build_erp,
        "legal":               _build_legal,
    }
    builder = _REGISTRY.get(agent_name)
    if builder is None:
        raise ValueError(f"Unknown agent name: {agent_name!r}")
    return builder(model_id=model_id, temperature=temperature, system_prompt=system_prompt)


# ---------------------------------------------------------------------------
# Per-agent builder helpers
# ---------------------------------------------------------------------------

def _build_auditor(model_id: str, temperature: float, system_prompt: str | None) -> Any:
    from agents.auditor_agent import AUDITOR_INSTRUCTION, fetch_scada_telemetry, evaluate_scada_signature
    from agents.base_adk import create_llm_agent
    return create_llm_agent(
        name="auditor_agent",
        instruction=system_prompt if system_prompt else AUDITOR_INSTRUCTION,
        tools=[fetch_scada_telemetry, evaluate_scada_signature],
        description="SCADA telemetry fraud detection via Nimble System 1 / Jev ensemble",
        output_key="audit_result",
        model=model_id,           # AGT-12: forward per-org model
        temperature=temperature,  # AGT-12: forward per-org temperature
    )


def _build_brand_liability(model_id: str, temperature: float, system_prompt: str | None) -> Any:
    from agents.brand_liability_agent import (
        BRAND_LIABILITY_INSTRUCTION, query_erp_sales, get_historic_debt, calculate_amortization,
    )
    from agents.base_adk import create_llm_agent
    return create_llm_agent(
        name="brand_liability_agent",
        instruction=system_prompt if system_prompt else BRAND_LIABILITY_INSTRUCTION,
        tools=[query_erp_sales, get_historic_debt, calculate_amortization],
        description="Calculates EPR plastic-waste liability from ERP sales + 1/3 amortization rule",
        output_key="liability_result",
        model=model_id,           # AGT-12: forward per-org model
        temperature=temperature,  # AGT-12: forward per-org temperature
    )


def _build_regulatory(model_id: str, temperature: float, system_prompt: str | None) -> Any:
    from agents.regulatory_agent import (
        REGULATORY_INSTRUCTION, fetch_cpcb_gazette, extract_conversion_factors,
    )
    from agents.base_adk import create_llm_agent
    return create_llm_agent(
        name="regulatory_watchdog_agent",
        instruction=system_prompt if system_prompt else REGULATORY_INSTRUCTION,
        tools=[fetch_cpcb_gazette, extract_conversion_factors],
        description="Parses CPCB gazette notifications into structured EPR rules",
        output_key="regulatory_rules",
        model=model_id,           # AGT-12: forward per-org model
        temperature=temperature,  # AGT-12: forward per-org temperature
    )


def _build_treasury(model_id: str, temperature: float, system_prompt: str | None) -> Any:
    from agents.treasury_agent import (
        TREASURY_INSTRUCTION, compute_statutory_corridor, fetch_recycler_bids, validate_price_corridor,
    )
    from agents.base_adk import create_llm_agent
    return create_llm_agent(
        name="treasury_agent",
        instruction=system_prompt if system_prompt else TREASURY_INSTRUCTION,
        tools=[compute_statutory_corridor, fetch_recycler_bids, validate_price_corridor],
        description="Runs the continuous double auction within the statutory price corridor",
        output_key="auction_result",
        model=model_id,           # AGT-12: forward per-org model
        temperature=temperature,  # AGT-12: forward per-org temperature
    )


def _build_logistics(model_id: str, temperature: float, system_prompt: str | None) -> Any:
    from agents.logistics_agent import (
        LOGISTICS_INSTRUCTION, verify_eway_bill, scan_qr_packaging_ledger, assess_logistics_risk,
    )
    from agents.base_adk import create_llm_agent
    return create_llm_agent(
        name="logistics_agent",
        instruction=system_prompt if system_prompt else LOGISTICS_INSTRUCTION,
        tools=[verify_eway_bill, scan_qr_packaging_ledger, assess_logistics_risk],
        description="Verifies material origin via E-Way bills and QR packaging ledger",
        output_key="logistics_result",
        model=model_id,           # AGT-12: forward per-org model
        temperature=temperature,  # AGT-12: forward per-org temperature
    )


def _build_erp(model_id: str, temperature: float, system_prompt: str | None) -> Any:
    from agents.erp_agent import (
        ERP_INSTRUCTION, validate_po_conditions, create_purchase_order,
    )
    from agents.base_adk import create_llm_agent
    return create_llm_agent(
        name="erp_agent",
        instruction=system_prompt if system_prompt else ERP_INSTRUCTION,
        tools=[validate_po_conditions, create_purchase_order],
        description="Creates 80/20 split escrow purchase order after validating audit verdicts",
        output_key="po_result",
        model=model_id,           # AGT-12: forward per-org model
        temperature=temperature,  # AGT-12: forward per-org temperature
    )


def _build_legal(model_id: str, temperature: float, system_prompt: str | None) -> Any:
    from agents.legal_agent import (
        LEGAL_INSTRUCTION, apply_conversion_factor, sign_form1_dsc, dispatch_to_cpcb_portal,
    )
    from agents.base_adk import create_llm_agent
    return create_llm_agent(
        name="legal_agent",
        instruction=system_prompt if system_prompt else LEGAL_INSTRUCTION,
        tools=[apply_conversion_factor, sign_form1_dsc, dispatch_to_cpcb_portal],
        description="Generates, DSC-signs, and submits CPCB Form-1 for EPR credit registration",
        output_key="form1_result",
        model=model_id,           # AGT-12: forward per-org model
        temperature=temperature,  # AGT-12: forward per-org temperature
    )
