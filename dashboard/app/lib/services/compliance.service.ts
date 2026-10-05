/** ComplianceService — end-to-end compliance run endpoints. */

import { BaseService } from "./base.service";
import type { E2ERunResult, RunE2EParams, E2EStep } from "../types/compliance.types";

export class ComplianceService extends BaseService {
  /**
   * Launches the full 5-stage EPR compliance pipeline.
   * Injects company_id from the caller (CompanyContext).
   */
  async runE2E(params: RunE2EParams): Promise<E2ERunResult> {
    return this.request<E2ERunResult>("POST", "/api/v1/compliance/run-e2e", { body: params });
  }

  /** Returns all compliance runs, newest first. */
  async listRuns(): Promise<E2ERunResult[]> {
    return this.request<E2ERunResult[]>("GET", "/api/v1/compliance/runs");
  }

  /** Returns a single compliance run by run_id. */
  async getRun(runId: string): Promise<E2ERunResult> {
    return this.request<E2ERunResult>("GET", `/api/v1/compliance/runs/${encodeURIComponent(runId)}`);
  }

  /**
   * Returns ordered steps for a specific compliance run.
   * Steps are ordered by the step field ascending.
   */
  async getRunSteps(runId: string): Promise<E2EStep[]> {
    return this.request<E2EStep[]>("GET", `/api/v1/compliance/runs/${encodeURIComponent(runId)}/steps`);
  }
}
