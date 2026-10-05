/** ScheduleService — APScheduler per-org cron schedule endpoints. */

import { BaseService } from "./base.service";
import type { Schedule, SchedulerJob, CreateScheduleParams } from "../types/schedule.types";

export class ScheduleService extends BaseService {
  /** Lists all schedules. */
  async listSchedules(orgId?: string): Promise<Schedule[]> {
    return this.request<Schedule[]>("GET", "/api/v1/schedules/", {
      params: orgId ? { org_id: orgId } : undefined,
    });
  }

  /** Creates a new cron schedule. Requires admin role. */
  async createSchedule(params: CreateScheduleParams): Promise<Schedule> {
    return this.request<Schedule>("POST", "/api/v1/schedules/", { body: params });
  }

  /** Returns raw APScheduler job metadata for diagnostics. */
  async listJobs(): Promise<SchedulerJob[]> {
    return this.request<SchedulerJob[]>("GET", "/api/v1/schedules/jobs");
  }

  /** Returns a single schedule by schedule_id. */
  async getSchedule(scheduleId: string): Promise<Schedule> {
    return this.request<Schedule>("GET", `/api/v1/schedules/${encodeURIComponent(scheduleId)}`);
  }

  /** Pauses an active schedule. */
  async pauseSchedule(scheduleId: string): Promise<{ status: string }> {
    return this.request("POST", `/api/v1/schedules/${encodeURIComponent(scheduleId)}/pause`);
  }

  /** Resumes a paused schedule. */
  async resumeSchedule(scheduleId: string): Promise<{ status: string; next_run_at?: string }> {
    return this.request("POST", `/api/v1/schedules/${encodeURIComponent(scheduleId)}/resume`);
  }

  /** Deletes a schedule permanently. */
  async deleteSchedule(scheduleId: string): Promise<{ status: string }> {
    return this.request("DELETE", `/api/v1/schedules/${encodeURIComponent(scheduleId)}`);
  }
}
