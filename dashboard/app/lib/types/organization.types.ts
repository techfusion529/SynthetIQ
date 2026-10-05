/** Multi-tenant organization and data source types. */

export interface Organization {
  organization_id: string;
  org_id: string;
  name: string;
  industry_sector?: string;
  gstin?: string;
  address_line1?: string;
  city?: string;
  contact_email?: string;
  role?: "admin" | "compliance_officer" | "recycler";
  country?: string;
  annual_plastic_footprint_tons?: number;
  is_active: boolean;
  settings?: Record<string, unknown>;
  created_at?: string;
}

export type DataSourceType = "bigquery" | "postgresql" | "rest_api" | "csv" | "pubsub";
export type DataSourcePurpose = "erp_sales" | "scada_telemetry" | "regulatory" | "erp_po" | "cpcb_portal";

export interface DataSource {
  source_id: string;
  org_id: string;
  name: string;
  source_type: DataSourceType;
  purpose: DataSourcePurpose;
  description?: string;
  connection_config: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
}

export interface CreateOrgParams {
  name: string;
  gstin?: string;
  country?: string;
  industry_sector?: string;
  annual_plastic_footprint_tons?: number;
}

export interface CreateDataSourceParams {
  name: string;
  source_type: DataSourceType;
  purpose: DataSourcePurpose;
  description?: string;
  connection_config: Record<string, unknown>;
}
