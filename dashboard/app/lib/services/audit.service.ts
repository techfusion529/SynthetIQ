/** AuditService — SCADA telemetry and quad-core fraud audit endpoints. */

import { BaseService } from "./base.service";
import type {
  ScadaLiveResponse,
  AuditVerdict,
  TriggerAuditParams,
} from "../types/audit.types";

export class AuditService extends BaseService {
  /**
   * Polls live SCADA telemetry and returns physics + Jev evaluation.
   * Called every 1200 ms by the Audit_Page oscilloscope.
   */
  async getLiveScada(mode: "GENUINE" | "RESISTIVE_SPOOF" = "GENUINE"): Promise<ScadaLiveResponse> {
    return this.request<ScadaLiveResponse>("GET", "/api/v1/audit/scada/live", {
      params: { mode },
    });
  }

  /**
   * Triggers a full quad-core fraud audit on the SCADA stream.
   * Returns the audit record with SHA-256 hash.
   */
  async triggerAudit(params: TriggerAuditParams): Promise<AuditVerdict> {
    return this.request<AuditVerdict>("POST", "/api/v1/audit/trigger", { body: params });
  }

  /** Returns all audit verdicts sorted by timestamp descending. */
  async listVerdicts(): Promise<AuditVerdict[]> {
    return this.request<AuditVerdict[]>("GET", "/api/v1/audit/verdicts");
  }

  /** Returns a specific audit verdict by audit_id. */
  async getVerdict(auditId: string): Promise<AuditVerdict> {
    return this.request<AuditVerdict>("GET", `/api/v1/audit/verdict/${encodeURIComponent(auditId)}`);
  }
}
