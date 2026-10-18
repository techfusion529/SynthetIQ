"""Recycler Bidder Simulation service — generates competitive accredited bids within statutory price corridor."""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from synthetiq_shared.database import get_db_session
from synthetiq_shared.models import BidRecord

logger = logging.getLogger(__name__)

ACCREDITED_RECYCLERS = [
    {
        "id": "RECYC-DELHI-01",
        "name": "Delhi Clean Plastics Ltd",
        "plant_id": "PLANT-OKHLA-2",
        "plant_name": "Okhla Industrial Extrusion Unit 2",
        "capacity_tons": 500.0,
        "base_spread": 0.60,
        "allocation_share": 0.45,
    },
    {
        "id": "RECYC-SURAT-02",
        "name": "Surat EcoPolymer Ltd",
        "plant_id": "PLANT-GIDC-3",
        "plant_name": "Surat High-Capacity Pelletizer",
        "capacity_tons": 350.0,
        "base_spread": 0.52,
        "allocation_share": 0.35,
    },
    {
        "id": "RECYC-NOIDA-03",
        "name": "Noida Green Polymers Ltd",
        "plant_id": "PLANT-SEC62-1",
        "plant_name": "Noida Sector 62 Reprocessing Unit",
        "capacity_tons": 400.0,
        "base_spread": 0.68,
        "allocation_share": 0.30,
    },
    {
        "id": "RECYC-MUMBAI-04",
        "name": "Maharashtra Circular Resins Corp",
        "plant_id": "PLANT-TALOJA-3",
        "plant_name": "Taloja Mechanical Recycling Plant",
        "capacity_tons": 300.0,
        "base_spread": 0.78,
        "allocation_share": 0.25,
    },
]


def generate_simulated_bids(
    auction_id: str,
    category: str,
    target_tons: float,
    floor_price: float,
    ceiling_price: float,
    org_id: str | None = None,
) -> list[dict[str, Any]]:
    """Generate realistic bid dicts for accredited recyclers within statutory corridor."""
    corridor_spread = max(0.1, ceiling_price - floor_price)
    bids: list[dict[str, Any]] = []

    for r in ACCREDITED_RECYCLERS:
        # Calculate price per kg within corridor [floor_price, ceiling_price]
        price = round(floor_price + (r["base_spread"] * corridor_spread), 2)
        price = max(floor_price, min(ceiling_price, price))

        # Offered volume: minimum 25 tons, up to capacity and target share
        vol = round(max(25.0, min(r["capacity_tons"], target_tons * r["allocation_share"])), 1)

        bids.append({
            "bid_id": f"BID-{uuid4().hex[:8].upper()}",
            "auction_id": auction_id,
            "recycler_id": r["id"],
            "recycler_name": r["name"],
            "plant_id": r["plant_id"],
            "plant_name": r["plant_name"],
            "category": category,
            "volume_tons": vol,
            "price_per_kg": price,
            "status": "BIDDING",
            "org_id": org_id or r["id"],
        })

    return bids


async def simulate_and_persist_bids(
    auction_id: str,
    category: str,
    target_tons: float,
    floor_price: float,
    ceiling_price: float,
    org_id: str | None = None,
) -> list[BidRecord]:
    """Generate and persist simulated bids to the BidRecord table if none already exist."""
    async with get_db_session() as session:
        # Check if bids already exist
        existing = (
            await session.execute(
                select(BidRecord).where(BidRecord.auction_id == auction_id)
            )
        ).scalars().all()

        if existing:
            return list(existing)

        bid_dicts = generate_simulated_bids(
            auction_id=auction_id,
            category=category,
            target_tons=target_tons,
            floor_price=floor_price,
            ceiling_price=ceiling_price,
            org_id=org_id,
        )

        persisted: list[BidRecord] = []
        for b in bid_dicts:
            rec = BidRecord(
                bid_id=b["bid_id"],
                auction_id=b["auction_id"],
                recycler_id=b["recycler_id"],
                recycler_name=b["recycler_name"],
                plant_id=b["plant_id"],
                plant_name=b["plant_name"],
                category=b["category"],
                volume_tons=b["volume_tons"],
                price_per_kg=b["price_per_kg"],
                status=b["status"],
                org_id=b["org_id"],
            )
            session.add(rec)
            persisted.append(rec)

        await session.commit()
        for r in persisted:
            await session.refresh(r)

        logger.info(f"Simulated and persisted {len(persisted)} bids for auction {auction_id}")
        return persisted
