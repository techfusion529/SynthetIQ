/** Double auction & liquidity types. */

export type BidStatus = "MATCHED" | "BIDDING" | "OUT_OF_CORRIDOR";

export interface Bid {
  bid_id: string;
  recycler_id: string;
  recycler_name: string;
  plant_id: string;
  plant_name: string;
  category: string;
  volume_tons: number;
  price_per_kg: number;
  status: BidStatus;
  timestamp: string; // ISO 8601
  /** The recycler's org ID — used for bid filtering by current org. */
  org_id?: string;
}

export interface Auction {
  auction_id: string;
  id: string;
  category: string;
  target_tons: number;
  statutory_rate_per_kg: number;
  floor_price_inr: number;
  ceiling_price_inr: number;
  clearing_price_inr: number;
  total_cleared_tons: number;
  status: string;
  winning_recyclers: string[];
  created_at: string;
  winner_org_id?: string;
  corridor_min?: number;
  corridor_max?: number;
}

export interface BroadcastRfpParams {
  company_id: string;
  category: string;
  target_tons: number;
}

export interface SubmitBidParams {
  volume_tons: number;
  price_per_kg: number;
}
