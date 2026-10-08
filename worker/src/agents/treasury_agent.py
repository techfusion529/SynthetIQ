"""Treasury Agent  -  ADK LlmAgent that runs the continuous double auction."""

from __future__ import annotations

import json
import logging
from typing import Any

from .base_adk import create_llm_agent, run_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Functions
# ---------------------------------------------------------------------------

def fetch_recycler_bids(
    rfp_id: str,
    category: str,
    target_tons: float,
    floor_price_inr: float,
    ceiling_price_inr: float,
) -> dict[str, Any]:
    """Fetch available recycler bids for an RFP within the statutory price corridor.

    Args:
        rfp_id: Request-for-proposal identifier
        category: Plastic category
        target_tons: Required recycling volume
        floor_price_inr: Statutory floor (30% of base rate)
        ceiling_price_inr: Statutory ceiling (100% of base rate)

    Returns:
        Dict with bids list
    """
    # In production: query the marketplace / registered recycler DB
    return {
        "rfp_id": rfp_id,
        "category": category,
        "bids": [
            {
                "bid_id": "BID-01", "recycler_id": "RECYC-DELHI-01",
                "offered_tons": round(target_tons * 0.60, 2),
                "unit_price_inr": round(floor_price_inr * 1.50, 2),
                "reputation_score": 0.92, "cto_verified": True,
            },
            {
                "bid_id": "BID-02", "recycler_id": "RECYC-GUJ-04",
                "offered_tons": round(target_tons * 0.50, 2),
                "unit_price_inr": round(floor_price_inr * 1.80, 2),
                "reputation_score": 0.88, "cto_verified": True,
            },
            {
                "bid_id": "BID-03", "recycler_id": "RECYC-MAH-09",
                "offered_tons": round(target_tons * 0.40, 2),
                "unit_price_inr": round(ceiling_price_inr * 0.90, 2),
                "reputation_score": 0.95, "cto_verified": True,
            },
        ],
    }


def validate_price_corridor(
    price_inr: float,
    floor_inr: float,
    ceiling_inr: float,
) -> dict[str, Any]:
    """Check whether a price falls within the statutory 30% - 100% corridor.

    Args:
        price_inr: Price to validate
        floor_inr: Statutory floor (30%)
        ceiling_inr: Statutory ceiling (100%)

    Returns:
        Dict with is_valid flag and reason
    """
    is_valid = floor_inr <= price_inr <= ceiling_inr
    return {
        "price_inr": price_inr,
        "floor_inr": floor_inr,
        "ceiling_inr": ceiling_inr,
        "is_valid": is_valid,
        "reason": "Within corridor" if is_valid else f"Price {price_inr} outside [{floor_inr}, {ceiling_inr}]",
    }


def compute_statutory_corridor(statutory_base_rate_inr: float) -> dict[str, Any]:
    """Compute the statutory price corridor from the base rate.

    Args:
        statutory_base_rate_inr: CPCB-notified penalty rate per kg

    Returns:
        Dict with floor and ceiling prices
    """
    return {
        "statutory_base_rate_inr": statutory_base_rate_inr,
        "floor_price_inr": round(statutory_base_rate_inr * 0.30, 2),
        "ceiling_price_inr": round(statutory_base_rate_inr * 1.00, 2),
        "corridor_description": "30%  -  100% of CPCB statutory rate",
    }


# ---------------------------------------------------------------------------
# ADK Agent Construction
# ---------------------------------------------------------------------------

TREASURY_INSTRUCTION = """You are the Treasury Agent for SynthetIQ's continuous double auction system.

Your job:
1. Compute the statutory price corridor using `compute_statutory_corridor`.
2. Fetch recycler bids with `fetch_recycler_bids`.
3. Validate each bid's price with `validate_price_corridor`  -  reject out-of-corridor bids.
4. Allocate bids to meet the target volume, minimising total cost.
   - Prefer lower-price, higher-reputation recyclers first.
   - Split across multiple recyclers to reduce concentration risk.
5. Output a single JSON object summarising the auction result.

Auction Rules:
  - Price corridor: 30%  -  100% of the statutory base rate
  - Target: clear the exact requested volume (partial fill is acceptable if no more bids exist)
  - Mandatory JSON output keys:
      rfp_id, category, statutory_floor_inr, statutory_ceiling_inr,
      allocated_bids, cleared_tons, total_cost_inr, clearing_price_inr,
      status (COMPLETED / PARTIAL), optimization_notes
"""

treasury_agent = create_llm_agent(
    name="treasury_agent",
    instruction=TREASURY_INSTRUCTION,
    tools=[compute_statutory_corridor, fetch_recycler_bids, validate_price_corridor],
    description="Runs the continuous double auction within the statutory price corridor",
    output_key="auction_result",
)


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_treasury_agent(
    rfp_id: str,
    category: str,
    target_tons: float,
    statutory_base_rate: float = 12.0,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Run the Treasury Agent and return the auction result.

    Args:
        rfp_id: RFP identifier
        category: Plastic category
        target_tons: Required volume
        statutory_base_rate: CPCB penalty rate per kg
        session_id: Optional ADK session ID

    Returns:
        Auction allocation dict
    """
    logger.info(f"Running treasury_agent for {rfp_id}  -  {target_tons}t {category}")

    result = await run_agent(
        agent=treasury_agent,
        user_message=(
            f"Run the auction for RFP '{rfp_id}': category={category}, "
            f"target={target_tons} tons, statutory_base_rate=INR {statutory_base_rate}/kg. "
            "Use all tools. Return a single JSON object."
        ),
        session_id=session_id,
        user_id="system",
    )

    text = result.get("response", "")
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except (json.JSONDecodeError, IndexError):
        logger.warning("Could not parse JSON from treasury agent; returning raw")
        return {"raw_response": result.get("response", ""), "tool_calls": result.get("tool_calls", [])}
