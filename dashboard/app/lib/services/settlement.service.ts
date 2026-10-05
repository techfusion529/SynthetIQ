/** SettlementService — 80/20 escrow PO and Form-1 statutory dispatch endpoints. */

import { BaseService } from "./base.service";
import type { EscrowPO, Form1Payload, ApproveEscrowParams } from "../types/settlement.types";

export class SettlementService extends BaseService {
  /** Lists all escrow purchase orders. */
  async listPOs(): Promise<EscrowPO[]> {
    return this.request<EscrowPO[]>("GET", "/api/v1/settlement/pos");
  }

  /**
   * Returns a single PO by po_number with full financial details.
   * po_number is substituted into the path (path-segment injection rule).
   */
  async getPO(poNumber: string): Promise<EscrowPO> {
    return this.request<EscrowPO>("GET", `/api/v1/settlement/pos/${encodeURIComponent(poNumber)}`);
  }

  /** Human-in-the-Loop approval gate — signals Temporal for escrow release. */
  async approve(params: ApproveEscrowParams): Promise<{ status: string; audit_id: string; approved_by: string }> {
    return this.request("POST", "/api/v1/settlement/approve", { body: params });
  }

  /**
   * Dispatches Form-1 to the CPCB national portal.
   * Returns the full Form-1 payload including DSC signature and ACK number.
   */
  async dispatchForm1(poNumber: string): Promise<Form1Payload> {
    return this.request<Form1Payload>("POST", "/api/v1/settlement/form1/dispatch", {
      body: { po_number: poNumber },
    });
  }

  /** Lists all dispatched Form-1 statutory records. */
  async listForm1s(): Promise<Form1Payload[]> {
    return this.request<Form1Payload[]>("GET", "/api/v1/settlement/form1");
  }

  /**
   * Retrieves a previously dispatched Form-1 by form_id.
   * form_id is substituted into the path (path-segment injection rule).
   */
  async getForm1(formId: string): Promise<Form1Payload> {
    return this.request<Form1Payload>("GET", `/api/v1/settlement/form1/${encodeURIComponent(formId)}`);
  }
}

