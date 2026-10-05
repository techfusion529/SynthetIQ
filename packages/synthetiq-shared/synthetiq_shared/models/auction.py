"""Auction domain models — RFPs, Bids, Compensation Corridors, and Auction Results."""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..constants import (
    COMPENSATION_CORRIDOR_MAX_PCT,
    COMPENSATION_CORRIDOR_MIN_PCT,
    PlasticCategory,
)


class CompensationCorridor(BaseModel):
    """Statutory price corridor locked between 30% and 100% compensation rate."""
    category: PlasticCategory
    statutory_compensation_rate_per_kg: float = Field(..., gt=0)
    floor_price_inr_per_kg: float = Field(
        ..., ge=0,
        description="30% of statutory compensation rate",
    )
    ceiling_price_inr_per_kg: float = Field(
        ..., gt=0,
        description="100% of statutory compensation rate",
    )

    @classmethod
    def calculate(cls, category: PlasticCategory, base_statutory_rate: float) -> CompensationCorridor:
        return cls(
            category=category,
            statutory_compensation_rate_per_kg=base_statutory_rate,
            floor_price_inr_per_kg=round(base_statutory_rate * COMPENSATION_CORRIDOR_MIN_PCT, 2),
            ceiling_price_inr_per_kg=round(base_statutory_rate * COMPENSATION_CORRIDOR_MAX_PCT, 2),
        )


class RFP(BaseModel):
    """Request for Proposal issued by Treasury Agent for EPR procurement."""
    rfp_id: str
    company_id: str
    fiscal_year: str
    category: PlasticCategory
    target_tons: float = Field(..., gt=0)
    max_ceiling_price_inr_per_kg: float = Field(..., gt=0)
    floor_price_inr_per_kg: float = Field(..., ge=0)
    status: str = Field(default="open", description="open | closed | cancelled")
    created_at: str = ""
    closing_at: str = ""


class Bid(BaseModel):
    """A recycler's bid in the continuous double auction."""
    bid_id: str
    rfp_id: str
    recycler_id: str
    plant_id: str
    category: PlasticCategory
    offered_tons: float = Field(..., gt=0)
    unit_price_inr_per_kg: float = Field(..., gt=0)
    timestamp: str = ""
    status: str = Field(default="submitted", description="submitted | matched | rejected | expired")


class AuctionResult(BaseModel):
    """Result of continuous double auction matching."""
    auction_id: str
    rfp_id: str
    category: PlasticCategory
    clearing_price_inr_per_kg: float = Field(..., ge=0)
    total_cleared_tons: float = Field(..., ge=0)
    winning_bids: list[Bid] = Field(default_factory=list)
    status: str = Field(default="completed", description="completed | partial | failed")
    matched_at: str = ""
