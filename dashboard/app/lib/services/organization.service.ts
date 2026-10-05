/** OrganizationService — multi-tenant org and data source endpoints. */

import { BaseService } from "./base.service";
import type {
  Organization,
  DataSource,
  CreateOrgParams,
  CreateDataSourceParams,
} from "../types/organization.types";

export class OrganizationService extends BaseService {
  /** Lists all active organisations. */
  async listOrgs(): Promise<Organization[]> {
    return this.request<Organization[]>("GET", "/api/v1/organizations/");
  }

  /** Returns a single organisation by org_id. */
  async getOrg(orgId: string): Promise<Organization> {
    return this.request<Organization>("GET", `/api/v1/organizations/${encodeURIComponent(orgId)}`);
  }

  /** Creates a new organisation. Requires admin role. */
  async createOrg(params: CreateOrgParams): Promise<Organization> {
    return this.request<Organization>("POST", "/api/v1/organizations/", { body: params });
  }

  /** Updates an organisation. Requires admin role. */
  async updateOrg(orgId: string, params: Partial<CreateOrgParams>): Promise<Organization> {
    return this.request<Organization>("PUT", `/api/v1/organizations/${encodeURIComponent(orgId)}`, { body: params });
  }

  /** Lists data sources for an organisation. */
  async listDataSources(orgId: string): Promise<DataSource[]> {
    return this.request<DataSource[]>("GET", `/api/v1/organizations/${encodeURIComponent(orgId)}/data-sources`);
  }

  /** Registers a new data source for an organisation. */
  async createDataSource(orgId: string, params: CreateDataSourceParams): Promise<DataSource> {
    return this.request<DataSource>("POST", `/api/v1/organizations/${encodeURIComponent(orgId)}/data-sources`, {
      body: params,
    });
  }

  /** Removes a data source registration. Requires admin role. */
  async deleteDataSource(orgId: string, sourceId: string): Promise<{ status: string }> {
    return this.request("DELETE", `/api/v1/organizations/${encodeURIComponent(orgId)}/data-sources/${encodeURIComponent(sourceId)}`);
  }

  /** Runs a health-check against a registered data source. */
  async testDataSource(orgId: string, sourceId: string): Promise<{ healthy: boolean; source_type: string }> {
    return this.request("POST", `/api/v1/organizations/${encodeURIComponent(orgId)}/data-sources/${encodeURIComponent(sourceId)}/test`);
  }
}
