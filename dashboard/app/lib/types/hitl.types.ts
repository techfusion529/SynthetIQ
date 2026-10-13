/** HITL (Human-in-the-Loop) Console types. */

export interface HITLRun {
  run_id: string;
  org_id: string;
  workflow_type: string;
  status: string;
  hitl_required: boolean;
  triggered_by: string;
  started_at: string | null;
  completed_at: string | null;
  input_params: Record<string, unknown>;
}

export interface HITLRunDetail extends HITLRun {
  temporal_status?: string;
  error_message?: string;
  temporal_workflow_id?: string;
}

export interface HITLResolvePayload {
  run_id: string;
  audit_id: string;
  reason_code: string;
  override_tons?: number;
  notes: string;
  resolver_id: string;
}

export const REASON_CODES = [
  "DATA_VERIFIED_CORRECT",
  "DATA_CORRECTED_BY_OPERATOR",
  "SENSOR_CALIBRATION_ERROR",
  "MANUAL_MEASUREMENT_ACCEPTED",
  "FALSE_POSITIVE_TAMPER_ALERT",
  "ESCALATED_TO_COMPLIANCE_TEAM",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];
