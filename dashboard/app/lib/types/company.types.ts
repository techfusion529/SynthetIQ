/** Company / PIBO entity types. */

export interface Company {
  company_id: string;
  name: string;
  gstin: string;
  industry_sector: string;
  annual_plastic_footprint_tons: number;
  erp_system?: string;
  registered_brands?: string[];
}
