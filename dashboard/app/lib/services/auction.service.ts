/** AuctionService — liquidity & continuous double auction endpoints. */

import { BaseService } from "./base.service";
import type { Auction, Bid, BroadcastRfpParams } from "../types/auction.types";

export class AuctionService extends BaseService {
  /** Lists all auctions sorted by created_at descending. */
  async listAuctions(): Promise<Auction[]> {
    return this.request<Auction[]>("GET", "/api/v1/auctions/");
  }

  /** Returns active/matching auctions, optionally filtered by company_id. */
  async listActive(companyId?: string): Promise<Auction[]> {
    return this.request<Auction[]>("GET", "/api/v1/auctions/active", {
      params: companyId ? { company_id: companyId } : undefined,
    });
  }

  /** Returns a single auction by auction_id. */
  async getAuction(auctionId: string): Promise<Auction> {
    return this.request<Auction>("GET", `/api/v1/auctions/${encodeURIComponent(auctionId)}`);
  }

  /**
   * Returns the live bid list for a specific auction.
   * Used by the Auction_Page order book with 10-second polling.
   */
  async getBids(auctionId: string): Promise<Bid[]> {
    return this.request<Bid[]>("GET", `/api/v1/auctions/${encodeURIComponent(auctionId)}/bids`);
  }

  /**
   * Broadcasts an RFP to the liquidity pool.
   * company_id is injected into the request body (body injection rule).
   */
  async broadcastRfp(params: BroadcastRfpParams): Promise<{ auction_id: string; workflow_id: string; status: string }> {
    return this.request("POST", "/api/v1/auctions/rfp", { body: params });
  }
}
