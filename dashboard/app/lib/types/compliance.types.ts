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
  /** Temporal run ID returned by the new /runs endpoint. */
  temporal_run_id?: string;
  /** Whether this run requires human-in-the-loop approval. */
  hitl_required?: boolean;
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
  /** Step-by-step pipeline trace — not returned by the new /runs endpoint. */
  steps?: E2EStep[];
}

/** New RunInput shape matching POST /api/v1/runs. */
export interface RunInput {
  type: string;
  params: Record<string, unknown>;
}

export interface RunE2EParams {
  company_id: string;
  fiscal_year?: string;
  category?: string;
  volume_tons?: number;
  simulate_spoof?: boolean;
}
