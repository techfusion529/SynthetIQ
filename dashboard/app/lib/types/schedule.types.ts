/** APScheduler cron schedule types. */

export type WorkflowType =
  | "upstream_liability"
  | "auction_liquidity"
  | "quad_core_audit"
  | "settlement_dispatch"
  | "master_e2e"
  | "master_e2e_compliance";

export interface Schedule {
  schedule_id: string;
  org_id: string;
  name: string;
  description?: string;
  workflow_type: WorkflowType | string;
  cron_expression: string;
  frequency?: string;
  target_service?: string;
  status?: "ACTIVE" | "INACTIVE" | "PAUSED";
  workflow_params?: Record<string, unknown>;
  is_active: boolean;
  run_count?: number;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_status?: string;
  created_at?: string;
}

export interface SchedulerJob {
  id: string;
  name: string;
  next_run_time: string | null;
  trigger: string;
}

export interface CreateScheduleParams {
  org_id: string;
  workflow_type: WorkflowType | string;
  cron_expression: string;
  name?: string;
  workflow_params?: Record<string, unknown>;
}
