/** ComplianceService — end-to-end compliance run endpoints. */

import { BaseService } from "./base.service";
import type { E2ERunResult, RunInput, E2EStep } from "../types/compliance.types";

export class ComplianceService extends BaseService {
  /**
   * Launches the full EPR compliance pipeline via the new Runs API.
   * Body must conform to RunInput: { type, params }.
   */
  async runE2E(input: RunInput): Promise<E2ERunResult> {
    return this.request<E2ERunResult>("POST", "/api/v1/runs", { body: input });
  }

  /** Returns all compliance runs, newest first. */
  async listRuns(): Promise<E2ERunResult[]> {
    return this.request<E2ERunResult[]>("GET", "/api/v1/runs");
  }

  /** Returns a single compliance run by run_id. */
  async getRun(runId: string): Promise<E2ERunResult> {
    return this.request<E2ERunResult>("GET", `/api/v1/runs/${encodeURIComponent(runId)}`);
  }

  /**
   * Returns ordered steps for a specific compliance run.
   * Steps are ordered by the step field ascending.
   */
  async getRunSteps(runId: string): Promise<E2EStep[]> {
    return this.request<E2EStep[]>("GET", `/api/v1/runs/${encodeURIComponent(runId)}/steps`);
  }
}
