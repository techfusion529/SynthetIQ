"""Brand Liability Agent — ADK LlmAgent that calculates EPR obligations from ERP data."""

from __future__ import annotations

import json
import logging
from typing import Any

from .base_adk import create_llm_agent, run_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Functions
# ---------------------------------------------------------------------------

async def _fetch_sales(company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
    from services.data_connector import get_connector_for_org
    connector = await get_connector_for_org(company_id, purpose="erp_sales")
    return await connector.query_sales_data(company_id, fiscal_year)


def query_erp_sales(company_id: str, fiscal_year: str) -> dict[str, Any]:
    """Query ERP sales data for a company and fiscal year via registered DataConnector.

    Args:
        company_id: Company identifier (tenant key)
        fiscal_year: e.g. 'FY2026-27'

    Returns:
        Dict with sales_records list and plastic categories
    """
    try:
        import asyncio
        import concurrent.futures

        # Check if already inside an active event loop
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, _fetch_sales(company_id, fiscal_year))
                records = future.result(timeout=10.0)
        else:
            records = asyncio.run(_fetch_sales(company_id, fiscal_year))

        if records:
            return {
                "company_id": company_id,
                "fiscal_year": fiscal_year,
                "sales_records": records,
                "source": "dynamic_data_connector",
                "currency": "INR",
            }
    except Exception as exc:
        logger.warning(f"Could not load dynamic ERP sales via DataConnector ({exc}); using fallback seed")

    return {
        "company_id": company_id,
        "fiscal_year": fiscal_year,
        "sales_records": [
            {"product_sku": "SKU-BOTTLE-500ML",  "plastic_category": "cat_i_rigid",       "plastic_weight_kg": 0.025, "units_sold": 300_000_000},
            {"product_sku": "SKU-POUCH-1KG",     "plastic_category": "cat_ii_flexible",   "plastic_weight_kg": 0.010, "units_sold": 620_000_000},
            {"product_sku": "SKU-WRAP-MULTI",    "plastic_category": "cat_iii_mlp",       "plastic_weight_kg": 0.005, "units_sold": 500_000_000},
            {"product_sku": "SKU-COMPOST-BAG",   "plastic_category": "cat_iv_compostable","plastic_weight_kg": 0.020, "units_sold":  50_000_000},
        ],
        "source": "fallback_seed",
        "currency": "INR",
    }


def get_historic_debt(company_id: str) -> dict[str, Any]:
    """Retrieve the organization's accumulated historic EPR debt.

    Args:
        company_id: Company identifier

    Returns:
        Dict with historic_debt_tons and last_amortized_year
    """
    # In production: query from PostgreSQL WorkflowRun / compliance ledger
    return {
        "company_id": company_id,
        "historic_debt_tons": 3600.0,
        "already_fulfilled_tons": 2500.0,
        "last_amortized_year": "FY2025-26",
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
  cat_i_rigid        — PET, HDPE rigid containers
  cat_ii_flexible    — LLDPE films, multi-layer pouches
  cat_iii_mlp        — Multi-layer plastics / sachets
  cat_iv_compostable — Certified biodegradable bags

Mandatory JSON output keys:
  company_id, fiscal_year, current_year_liability_tons, historic_debt_tons,
  amortized_debt_tons, already_fulfilled_tons, net_liability_tons,
  breakdown (per category), compliance_status, confidence_score, reasoning
"""

brand_liability_agent = create_llm_agent(
    name="brand_liability_agent",
    instruction=BRAND_LIABILITY_INSTRUCTION,
    tools=[query_erp_sales, get_historic_debt, calculate_amortization],
    description="Calculates EPR plastic-waste liability from ERP sales + 1/3 amortization rule",
    output_key="liability_result",
)


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_brand_liability_agent(
    company_id: str,
    fiscal_year: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Run the Brand Liability Agent and return the liability breakdown.

    Args:
        company_id: Company identifier
        fiscal_year: Target fiscal year
        session_id: Optional ADK session ID

    Returns:
        Liability breakdown dict
    """
    logger.info(f"Running brand_liability_agent for {company_id} / {fiscal_year}")

    result = await run_agent(
        agent=brand_liability_agent,
        user_message=(
            f"Calculate the EPR liability for company '{company_id}' for fiscal year '{fiscal_year}'. "
            "Use all available tools. Return a single JSON object."
        ),
        session_id=session_id,
        user_id=company_id,
    )

    text = result.get("response", "")
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except (json.JSONDecodeError, IndexError):
        logger.warning("Could not parse JSON from brand_liability agent response; returning raw")
        return {"raw_response": result.get("response", ""), "tool_calls": result.get("tool_calls", [])}
