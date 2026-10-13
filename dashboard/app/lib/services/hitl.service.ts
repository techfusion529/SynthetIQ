/** HitlService — Human-in-the-Loop Console API endpoints. */

import { BaseService } from "./base.service";
import type { HITLRun, HITLRunDetail, HITLResolvePayload } from "../types/hitl.types";

export class HitlService extends BaseService {
  /**
   * Lists runs that require human-in-the-loop approval.
   * Calls GET /api/v1/runs?hitl_required=true&limit={limit}
   */
  async listHitlRuns(limit = 50): Promise<HITLRun[]> {
    return this.request<HITLRun[]>("GET", "/api/v1/runs", {
      params: { hitl_required: true, limit },
    });
  }

  /**
   * Fetches full detail for a single run, including Temporal status.
   * Calls GET /api/v1/runs/{runId}
   */
  async getRun(runId: string): Promise<HITLRunDetail> {
    return this.request<HITLRunDetail>("GET", `/api/v1/runs/${encodeURIComponent(runId)}`);
  }

  /**
   * Submits a HITL resolution decision.
   * Calls POST /api/v1/audit/resolve
   */
  async resolveHitl(body: HITLResolvePayload): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("POST", "/api/v1/audit/resolve", { body });
  }
}
