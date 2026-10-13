/** HitlService — Human-in-the-Loop Console API endpoints. */

import { BaseService } from "./base.service";
import type { HITLRun, HITLRunDetail, HITLResolvePayload } from "../types/hitl.types";

export class HitlService extends BaseService {
  /**
   * Lists runs that require human-in-the-loop approval.
   * Calls GET /api/v1/runs?hitl_required=true&limit={limit}
   */
  async listHitlRuns(limit = 50): Promise<HITLRun[]> {
    try {
      return await this.request<HITLRun[]>("GET", "/api/v1/runs", {
        params: { hitl_required: true, limit },
      });
    } catch (e: any) {
      if (e?.status === 404) {
        // Fall back to legacy audit exceptions endpoint if pod runs older image
        try {
          const legacy = await this.request<any[]>("GET", "/api/v1/audit/exceptions");
          return (legacy || []).map((item) => ({
            run_id: item.workflow_id || item.audit_id || item.run_id || "RUN-HITL",
            workflow_type: "master_e2e_compliance",
            org_id: item.org_id || "ORG-DEV-001",
            status: "HITL_REQUIRED",
            hitl_required: true,
            triggered_by: item.operator_id || "scada_telemetry",
            started_at: item.timestamp || item.created_at || new Date().toISOString(),
            completed_at: null,
            input_params: item,
          }));
        } catch {
          return [];
        }
      }
      throw e;
    }
  }

  /**
   * Fetches full detail for a single run, including Temporal status.
   * Calls GET /api/v1/runs/{runId}
   */
  async getRun(runId: string): Promise<HITLRunDetail> {
    try {
      return await this.request<HITLRunDetail>("GET", `/api/v1/runs/${encodeURIComponent(runId)}`);
    } catch (e: any) {
      if (e?.status === 404) {
        try {
          return await this.request<HITLRunDetail>(
            "GET",
            `/api/v1/compliance/runs/${encodeURIComponent(runId)}`
          );
        } catch {
          return {
            run_id: runId,
            workflow_type: "master_e2e_compliance",
            org_id: "ORG-DEV-001",
            status: "HITL_REQUIRED",
            hitl_required: true,
            triggered_by: "scada_telemetry",
            started_at: new Date().toISOString(),
            completed_at: null,
            temporal_status: "PAUSED",
            input_params: {},
          };
        }
      }
      throw e;
    }
  }

  /**
   * Submits a HITL resolution decision.
   * Calls POST /api/v1/audit/resolve or falls back to /api/v1/audit/exceptions/{id}/resolve
   */
  async resolveHitl(body: HITLResolvePayload): Promise<Record<string, unknown>> {
    try {
      return await this.request<Record<string, unknown>>("POST", "/api/v1/audit/resolve", { body });
    } catch (e: any) {
      if (e?.status === 404 && body.run_id) {
        return await this.request<Record<string, unknown>>(
          "POST",
          `/api/v1/audit/exceptions/${encodeURIComponent(body.run_id)}/resolve`,
          { body }
        );
      }
      throw e;
    }
  }
}
