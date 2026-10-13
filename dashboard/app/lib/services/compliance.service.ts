/** ComplianceService — end-to-end compliance run endpoints. */

import { BaseService } from "./base.service";
import type { E2ERunResult, RunInput, E2EStep } from "../types/compliance.types";

export class ComplianceService extends BaseService {
  /**
   * Launches the full EPR compliance pipeline via the new Runs API.
   * Falls back to /api/v1/compliance/run-e2e if pod has not been redeployed.
   */
  async runE2E(input: RunInput): Promise<E2ERunResult> {
    try {
      return await this.request<E2ERunResult>("POST", "/api/v1/runs", { body: input });
    } catch (e: any) {
      if (e?.status === 404) {
        return await this.request<E2ERunResult>("POST", "/api/v1/compliance/run-e2e", {
          body: input.params || input,
        });
      }
      throw e;
    }
  }

  /** Returns all compliance runs, newest first. */
  async listRuns(): Promise<E2ERunResult[]> {
    try {
      return await this.request<E2ERunResult[]>("GET", "/api/v1/runs");
    } catch (e: any) {
      if (e?.status === 404) {
        try {
          return await this.request<E2ERunResult[]>("GET", "/api/v1/compliance/runs");
        } catch {
          return [];
        }
      }
      throw e;
    }
  }

  /** Returns a single compliance run by run_id. */
  async getRun(runId: string): Promise<E2ERunResult> {
    try {
      return await this.request<E2ERunResult>("GET", `/api/v1/runs/${encodeURIComponent(runId)}`);
    } catch (e: any) {
      if (e?.status === 404) {
        return await this.request<E2ERunResult>(
          "GET",
          `/api/v1/compliance/runs/${encodeURIComponent(runId)}`
        );
      }
      throw e;
    }
  }

  /**
   * Returns ordered steps for a specific compliance run.
   * Steps are ordered by the step field ascending.
   */
  async getRunSteps(runId: string): Promise<E2EStep[]> {
    try {
      return await this.request<E2EStep[]>("GET", `/api/v1/runs/${encodeURIComponent(runId)}/steps`);
    } catch (e: any) {
      if (e?.status === 404) {
        return await this.request<E2EStep[]>(
          "GET",
          `/api/v1/compliance/runs/${encodeURIComponent(runId)}/steps`
        );
      }
      throw e;
    }
  }
}
