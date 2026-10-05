/** End-to-end compliance run types. */

export interface E2EStep {
  step: number;
  name: string;
  service: string;
  status: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface E2ERunResult {
  run_id: string;
  temporal_workflow_id?: string;
  temporal_ui_url?: string;
  status: string;
  message: string;
  duration_seconds: number;
  company_id: string;
  category?: string;
  volume_tons?: number;
  audit_hash?: string;
  po_number?: string;
  portal_ack_number?: string;
  triggered_by?: string;
  steps: E2EStep[];
}

export interface RunE2EParams {
  company_id: string;
  fiscal_year?: string;
  category?: string;
  volume_tons?: number;
  simulate_spoof?: boolean;
}
