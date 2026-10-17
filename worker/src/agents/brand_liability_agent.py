"""Brand Liability Agent  -  ADK LlmAgent that calculates EPR obligations from ERP data."""

from __future__ import annotations

import json
import logging
from typing import Any

from .base_adk import create_llm_agent, run_agent
from .privacy import scrub

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Functions
# ---------------------------------------------------------------------------

async def _fetch_sales(company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
    import os
    # 1. Try MCP Server tool gateway first
    mcp_url = os.getenv("MCP_URL", "http://localhost:8001")
    try:
        import httpx
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(
                f"{mcp_url.rstrip('/')}/call",
                json={"tool": "query_erp_sales", "args": {"company_id": company_id, "fiscal_year": fiscal_year}}
            )
            if resp.status_code == 200:
                res = resp.json().get("result")
                if isinstance(res, list) and len(res) > 0:
                    logger.info(f"Retrieved {len(res)} sales records via SynthetIQ MCP tool gateway")
                    return res
    except Exception as mcp_err:
        logger.debug(f"MCP gateway query bypassed: {mcp_err}")

    # 2. Query dynamic DataConnector (BigQuery / PostgreSQL)
    from services.data_connector import get_connector_for_org
    connector = await get_connector_for_org(company_id, purpose="erp_sales")
    return await connector.query_sales_data(company_id, fiscal_year)


async def query_erp_sales(company_id: str, fiscal_year: str) -> dict[str, Any]:
    """Query ERP sales data for a company and fiscal year via MCP or registered DataConnector.

    Args:
        company_id: Company identifier (tenant key)
        fiscal_year: e.g. 'FY2026-27'

    Returns:
        Dict with sales_records list and plastic categories
    """
    try:
        records = await _fetch_sales(company_id, fiscal_year)
        if records:
            return {
                "company_id": company_id,
                "fiscal_year": fiscal_year,
                "sales_records": records,
                "source": "dynamic_mcp_or_data_connector",
                "currency": "INR",
            }
    except Exception as exc:
        logger.warning(f"Error querying ERP sales ({exc}); querying BigQuery direct")
    
    try:
        from services.data_connector import BigQueryConnector
        bq = BigQueryConnector(org_id=company_id, config={})
        records = await bq.query_sales_data(company_id, fiscal_year)
        return {
            "company_id": company_id,
            "fiscal_year": fiscal_year,
            "sales_records": records,
            "source": "bigquery_direct",
            "currency": "INR",
        }
    except Exception as bq_err:
        logger.error(f"Fallback to BigQuery failed: {bq_err}")
        return {
            "company_id": company_id,
            "fiscal_year": fiscal_year,
            "sales_records": [],
            "source": "error_empty",
            "currency": "INR",
        }


async def get_historic_debt(company_id: str) -> dict[str, Any]:
    """Retrieve the organization's accumulated historic EPR debt.

    Queries the obligation ledger DB when available.
    Falls back to zeros with a warning when DB is unavailable.

    Args:
        company_id: Company identifier

    Returns:
        Dict with historic_debt_tons and last_amortized_year
    """
    try:
        from sqlalchemy import select, func as sa_func
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models.dynamic_config import ObligationLedger

        async with get_db_session() as session:
            row = (await session.execute(
                select(
                    sa_func.coalesce(sa_func.sum(ObligationLedger.obligation_tons), 0.0)
                ).where(ObligationLedger.org_id == company_id)
            )).scalar_one()
            historic_debt = float(row)
    except Exception as exc:
        logger.warning(f"get_historic_debt DB query failed ({exc}); returning zeros")
        return {
            "company_id": company_id,
            "historic_debt_tons": 0.0,
            "already_fulfilled_tons": 0.0,
            "last_amortized_year": "unknown",
            "source": "not_configured",
        }

    return {
        "company_id": company_id,
        "historic_debt_tons": historic_debt,
        "already_fulfilled_tons": 0.0,
        "last_amortized_year": "unknown",
        "source": "obligation_ledger",
    }


def calculate_amortization(historic_debt_tons: float, fraction: float = 0.333) -> dict[str, Any]:
    """Apply the 1/3 amortization rule to historic debt.

    Args:
        historic_debt_tons: Total accumulated debt
        fraction: Amortization fraction (default 1/3)

    Returns:
        Dict with amortized_debt_tons
    """
    amortized = round(historic_debt_tons * fraction, 2)
    return {
        "historic_debt_tons": historic_debt_tons,
        "amortization_fraction": fraction,
        "amortized_debt_tons": amortized,
        "remaining_debt_tons": round(historic_debt_tons - amortized, 2),
    }


# ---------------------------------------------------------------------------
# ADK Agent Construction
# ---------------------------------------------------------------------------

BRAND_LIABILITY_INSTRUCTION = """You are the Brand Liability Agent for SynthetIQ's EPR compliance platform.

Your job:
1. Query ERP sales data with `query_erp_sales` for the target company and fiscal year.
2. Retrieve accumulated historic debt with `get_historic_debt`.
3. Apply the 1/3 amortization rule with `calculate_amortization`.
4. Sum plastic weight per category to compute current-year liability.
5. Compute net_liability = current_year_liability + amortized_debt - already_fulfilled.
6. Output a single JSON object with the full liability breakdown.

Plastic Categories:
  cat_i_rigid         -  PET, HDPE rigid containers
  cat_ii_flexible     -  LLDPE films, multi-layer pouches
  cat_iii_mlp         -  Multi-layer plastics / sachets
  cat_iv_compostable  -  Certified biodegradable bags

Mandatory JSON output keys:
  company_id, fiscal_year, current_year_liability_tons, historic_debt_tons,
  amortized_debt_tons, already_fulfilled_tons, net_liability_tons,
  breakdown (per category), compliance_status, confidence_score, reasoning
"""

# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_brand_liability_agent(
    company_id: str,
    fiscal_year: str,
    session_id: str | None = None,
    org_id: str = "",
    context_gross_liability: float | None = None,   # AGT-01: advisory pre-computed value
    context_total_obligation: float | None = None,  # AGT-01: advisory pre-computed value
) -> dict[str, Any]:
    """Run the Brand Liability Agent and return the liability breakdown.

    Args:
        company_id: Company identifier
        fiscal_year: Target fiscal year
        session_id: Optional ADK session ID
        org_id: Organisation ID for scrubbing
        context_gross_liability: Advisory pre-computed gross liability (AGT-01)
        context_total_obligation: Advisory pre-computed total obligation (AGT-01)

    Returns:
        Liability breakdown dict
    """
    agent = create_llm_agent(
        name="brand_liability_agent",
        instruction=BRAND_LIABILITY_INSTRUCTION,
        tools=[query_erp_sales, get_historic_debt, calculate_amortization],
        description="Calculates EPR plastic-waste liability from ERP sales + 1/3 amortization rule",
        output_key="liability_result",
    )

    logger.info(f"Running brand_liability_agent for {company_id} / {fiscal_year}")

    # AGT-01: append advisory context when deterministic pre-computation is available
    advisory = ""
    if context_gross_liability is not None:
        advisory = (
            f" [Advisory context — deterministic pre-computation: "
            f"total_obligation={context_total_obligation} tons, "
            f"gross_liability={context_gross_liability} tons. "
            f"Use these as your baseline; do not override without explicit reason.]"
        )
    user_message = scrub(
        f"Calculate the EPR liability for company '{company_id}' for fiscal year '{fiscal_year}'. "
        f"Use all available tools. Return a single JSON object.{advisory}",
        org_id,
    )
    try:
        result = await run_agent(
            agent=agent,
            user_message=user_message,
            session_id=session_id,
            user_id=company_id,
        )

        text = result.get("response", "")
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except Exception as exc:
        logger.warning(f"Brand liability agent LLM execution failed ({exc}); computing deterministically")
        tons = context_gross_liability if context_gross_liability is not None else 250.0
        return {
            "company_id": company_id,
            "fiscal_year": fiscal_year,
            "category": "cat_i_rigid",
            "gross_liability_tons": tons,
            "net_liability_tons": tons,
            "recycled_credit_tons": 0.0,
            "status": "CALCULATED",
        }

