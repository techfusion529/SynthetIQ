/** End-to-end compliance run types. */

export interface E2EStep {
  step: number;
  event_id?: string;
  name: string;
  service: string;
  role?: string;
  system?: string;
  status: string;
  data?: Record<string, unknown>;
  input?: Record<string, any>;
  output?: Record<string, any>;
  response?: Record<string, any>;
  timestamp?: string | number;
  runtime_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  tokens?: number;
  cost_usd?: number;
  cost_inr?: number;
}

export interface E2ERunEvent extends E2EStep {
  timestamp: string | number;
  runtime_ms: number;
  tokens: number;
  cost_usd: number;
  cost_inr: number;
}

export interface E2ERunEventsResponse {
  run_id: string;
  workflow_type?: string;
  status: string;
  temporal_workflow_id?: string;
  total_runtime_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  total_cost_inr: number;
  events: E2ERunEvent[];
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
  message?: string;
  duration_seconds: number;
  total_runtime_ms?: number;
  total_tokens?: number;
  total_cost_usd?: number;
  total_cost_inr?: number;
  company_id?: string;
  category?: string;
  volume_tons?: number;
  fiscal_year?: string;
  input_params?: Record<string, any>;
  audit_hash?: string;
  po_number?: string;
  portal_ack_number?: string;
  triggered_by?: string;
  started_at?: string;
  completed_at?: string;
  /** Step-by-step pipeline trace. */
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
