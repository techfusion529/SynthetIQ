"""Recycler Bidder Agent  -  Agent 4 in the 8-agent architecture.

Simulates autonomous competitive market participants (accredited recyclers)
bidding on open RFPs within the CPCB statutory price corridor.
"""

from __future__ import annotations

import logging
from typing import Any

from synthetiq_shared.utils.auction_simulator import (
    ACCREDITED_RECYCLERS,
    generate_simulated_bids,
    simulate_and_persist_bids,
)

logger = logging.getLogger(__name__)


async def run_recycler_bidder_agent(
    auction_id: str,
    category: str,
    target_tons: float,
    floor_price_inr: float,
    ceiling_price_inr: float,
    org_id: str = "",
) -> list[dict[str, Any]]:
    """Simulate bids from accredited recyclers and persist them to the database.

    Args:
        auction_id: The auction/RFP identifier
        category: Plastic category (cat_i_rigid, cat_ii_flexible, etc.)
        target_tons: Desired procurement volume in metric tons
        floor_price_inr: Statutory floor price (30% of base rate)
        ceiling_price_inr: Statutory ceiling price (100% of base rate)
        org_id: Organization ID of the requesting brand or caller

    Returns:
        List of bid dicts submitted to the auction order book
    """
    logger.info(
        f"[RecyclerBidderAgent] Simulating bids for auction {auction_id}: "
        f"{target_tons}t {category} in corridor [{floor_price_inr}, {ceiling_price_inr}]"
    )

    records = await simulate_and_persist_bids(
        auction_id=auction_id,
        category=category,
        target_tons=target_tons,
        floor_price=floor_price_inr,
        ceiling_price=ceiling_price_inr,
        org_id=org_id,
    )

    return [r.to_dict() for r in records]
