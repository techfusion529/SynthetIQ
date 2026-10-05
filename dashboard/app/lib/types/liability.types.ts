/** Liability & sourcing planning types. */

export interface CategoryBreakdown {
  cat_i_rigid: number;
  cat_ii_flexible: number;
  cat_iii_mlp: number;
  cat_iv_compostable: number;
  [key: string]: number;
}

export interface ConversionFactors {
  cat_i_rigid?: { mechanical: number; co_processing: number };
  cat_ii_flexible?: { mechanical: number; co_processing: number };
  cat_iii_mlp?: { mechanical: number; co_processing: number };
  cat_iv_compostable?: { mechanical: number; co_processing: number };
  [key: string]: { mechanical: number; co_processing: number } | undefined;
}

export interface LiabilityReport {
  company_id: string;
  fiscal_year: string;
  current_year_liability_tons: number;
  historic_debt_tons: number;
  amortized_debt_tons: number;
  already_fulfilled_tons: number;
  net_liability_tons: number;
  breakdown_by_category: CategoryBreakdown;
  conversion_factors?: ConversionFactors;
  confidence_score?: number;
  status?: string;
}

export interface LiabilityCalculateParams {
  company_id: string;
  fiscal_year: string;
  historic_debt_tons?: number;
}

export interface LiabilityCalculateResult {
  net_liability_tons: number;
  amortized_debt_tons: number;
  current_year_liability_tons: number;
  already_fulfilled_tons: number;
}
