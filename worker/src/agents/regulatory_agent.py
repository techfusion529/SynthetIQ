"""Regulatory Watchdog Agent — ADK LlmAgent that parses CPCB gazette notifications."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from .base_adk import create_llm_agent, run_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Functions
# ---------------------------------------------------------------------------

def fetch_cpcb_gazette(gazette_reference: str) -> dict[str, Any]:
    """Fetch the latest CPCB gazette notification text.

    Args:
        gazette_reference: Gazette reference number or keyword (e.g., 'PWM 2026')

    Returns:
        Dict with gazette_text and metadata
    """
    # In production this calls the CPCB document API / scraper.
    # Returns the canonical EPR Amendment Rules text for the agent to parse.
    return {
        "gazette_reference": gazette_reference,
        "gazette_text": (
            "CPCB Plastic Waste Management Amendment Rules 2026. "
            "Extended Producer Responsibility targets: "
            "Category I (Rigid): mechanical CF=1.0, co-processing CF=0.7. "
            "Category II (Flexible): mechanical CF=0.8, co-processing CF=0.6. "
            "Category III (MLP): mechanical CF=0.5, co-processing CF=0.9. "
            "Category IV (Compostable): mechanical CF=1.0, co-processing CF=0.8. "
            "Historic debt amortization: 1/3 per fiscal year. "
            "Statutory base rate: INR 12.00 per kg. "
            "Compliance deadline: 2027-03-31."
        ),
        "source": "CPCB Official Gazette",
        "effective_date": "2026-04-01",
    }


def extract_conversion_factors(category: str, recycling_method: str) -> dict[str, Any]:
    """Look up statutory conversion factors for a specific category and recycling method.

    Args:
        category: Plastic category (cat_i_rigid / cat_ii_flexible / cat_iii_mlp / cat_iv_compostable)
        recycling_method: mechanical or co_processing

    Returns:
        Dict with conversion factor and statutory reference
    """
    _TABLE: dict[str, dict[str, float]] = {
        "cat_i_rigid":       {"mechanical": 1.0, "co_processing": 0.7},
        "cat_ii_flexible":   {"mechanical": 0.8, "co_processing": 0.6},
        "cat_iii_mlp":       {"mechanical": 0.5, "co_processing": 0.9},
        "cat_iv_compostable":{"mechanical": 1.0, "co_processing": 0.8},
    }
    cf = _TABLE.get(category, {}).get(recycling_method, 1.0)
    return {
        "category": category,
        "recycling_method": recycling_method,
        "conversion_factor": cf,
        "source": "CPCB PWM Amendment Rules 2026",
    }


# ---------------------------------------------------------------------------
# ADK Agent Construction
# ---------------------------------------------------------------------------

REGULATORY_INSTRUCTION = """You are the Regulatory Watchdog Agent for SynthetIQ's EPR compliance platform.

Your duties:
1. Fetch and parse CPCB gazette notifications using the `fetch_cpcb_gazette` tool.
2. Extract statutory conversion factors for each plastic category using `extract_conversion_factors`.
3. Identify the amortization fraction, statutory base rate, and compliance deadlines.
4. Detect meaningful changes from previous fiscal year rules.
5. Return a structured JSON summary — never return free-form prose.

EPR Knowledge:
- Category I (Rigid): PET bottles, HDPE containers — high mechanical recyclability
- Category II (Flexible): LLDPE films, multi-layer pouches
- Category III (Multi-Layer): Mixed laminates, sachets — hard to recycle mechanically
- Category IV (Compostable): Bio-certified plastics — full credit via mechanical route
- Amortization: only 1/3 of accumulated historic debt must be cleared per fiscal year
- Statutory base rate is the CPCB-notified penalty per kg — price corridor is 30%–100% of this rate

Always output a single JSON object with keys:
  fiscal_year, statutory_conversion_factors, amortization_fraction,
  statutory_base_rate_inr, compliance_deadline, key_changes
"""

regulatory_agent = create_llm_agent(
    name="regulatory_watchdog_agent",
    instruction=REGULATORY_INSTRUCTION,
    tools=[fetch_cpcb_gazette, extract_conversion_factors],
    description="Parses CPCB gazette notifications into structured EPR conversion factors and deadlines",
    output_key="regulatory_rules",
)


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_regulatory_agent(
    gazette_reference: str = "PWM 2026",
    session_id: str | None = None,
) -> dict[str, Any]:
    """Run the Regulatory Watchdog Agent and return structured rules.

    Args:
        gazette_reference: Gazette keyword or number
        session_id: Optional ADK session ID for continuity

    Returns:
        Structured regulatory rules dict
    """
    logger.info(f"Running regulatory_watchdog_agent for: {gazette_reference}")

    result = await run_agent(
        agent=regulatory_agent,
        user_message=(
            f"Fetch and parse the CPCB gazette '{gazette_reference}'. "
            "Extract all conversion factors, amortization rules, base rate, and deadline. "
            "Return a single JSON object."
        ),
        session_id=session_id,
        user_id="system",
    )

    # Try to parse the JSON out of the agent's text response
    text = result.get("response", "")
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except (json.JSONDecodeError, IndexError):
        logger.warning("Could not parse JSON from regulatory agent response; returning raw")
        return {"raw_response": result.get("response", ""), "tool_calls": result.get("tool_calls", [])}
