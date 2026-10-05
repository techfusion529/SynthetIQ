/** LiabilityService — upstream liability report and calculate endpoints. */

import { BaseService } from "./base.service";
import type {
  LiabilityReport,
  LiabilityCalculateParams,
  LiabilityCalculateResult,
} from "../types/liability.types";

export class LiabilityService extends BaseService {
  /**
   * Fetches the current liability report for a company.
   * company_id is substituted into the path (path-segment injection rule).
   */
  async getReport(companyId: string, fiscalYear = "FY2026-27"): Promise<LiabilityReport> {
    return this.request<LiabilityReport>("GET", `/api/v1/liability/report/${encodeURIComponent(companyId)}`, {
      params: { fiscal_year: fiscalYear },
    });
  }

  /**
   * Calculates net liability with updated params (debounced slider trigger).
   * company_id is injected into the request body.
   */
  async calculate(params: LiabilityCalculateParams): Promise<LiabilityCalculateResult> {
    return this.request<LiabilityCalculateResult>("POST", "/api/v1/liability/calculate", { body: params });
  }
}
