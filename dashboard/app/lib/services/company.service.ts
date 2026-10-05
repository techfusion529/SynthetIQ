/** CompanyService — enterprise PIBO company profile endpoints. */

import { BaseService } from "./base.service";
import type { Company } from "../types/company.types";

export class CompanyService extends BaseService {
  /**
   * Lists all onboarded companies, optionally filtered by company_id.
   * company_id filter returns empty list (not 404) when no match.
   */
  async listCompanies(companyIdFilter?: string): Promise<Company[]> {
    return this.request<Company[]>("GET", "/api/v1/companies/", {
      params: companyIdFilter ? { company_id: companyIdFilter } : undefined,
    });
  }

  /** Returns a single company profile by company_id. */
  async getCompany(companyId: string): Promise<Company> {
    return this.request<Company>("GET", `/api/v1/companies/${encodeURIComponent(companyId)}`);
  }

  /** Onboards a new company. Requires admin role. */
  async createCompany(payload: Omit<Company, "company_id"> & { company_id: string }): Promise<{ status: string; company: Company }> {
    return this.request("POST", "/api/v1/companies/", { body: payload });
  }
}
